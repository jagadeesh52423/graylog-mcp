// Offline checks for src/tools/event-admin.js. Run: node test-event-admin.js
import assert from "assert/strict";
import { writeFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import axios from "axios";

const dir = mkdtempSync(join(tmpdir(), "graylog-mcp-test-"));
process.env.GRAYLOG_CONFIG_PATH = join(dir, "config.json");
writeFileSync(process.env.GRAYLOG_CONFIG_PATH, JSON.stringify({
    connections: {
        prod: { baseUrl: "http://fake", apiToken: "t" },
        nonprod: { baseUrl: "http://fake", apiToken: "t", requireWriteConfirm: false },
    },
}));

const { setActiveConnection } = await import("./src/config.js");
const ea = await import("./src/tools/event-admin.js");

// threshold -> series + expression (shape matches existing prod definitions)
assert.deepEqual(ea.thresholdToConditions({ operator: ">=", value: 1 }), {
    series: [{ type: "count", id: "count-", field: null }],
    conditions: { expression: { expr: ">=", left: { expr: "number-ref", ref: "count-" }, right: { expr: "number", value: 1 } } },
});
assert.equal(ea.thresholdToConditions({ type: "avg", field: "took_ms", operator: "<", value: 5 }).series[0].id, "avg-took_ms");
assert.throws(() => ea.thresholdToConditions({ operator: "!=", value: 1 }));
assert.throws(() => ea.thresholdToConditions({ type: "avg", operator: ">", value: 1 }));

// defaults fill, user values win, threshold overrides series/conditions
const def = ea.buildDefinition(
    { title: "x", config: { query: "q", streams: ["s"], search_within_ms: 60000, execute_every_ms: 60000 } },
    { operator: ">", value: 10 },
);
assert.equal(def.config.type, "aggregation-v1");
assert.deepEqual(def.config.group_by, []);
assert.deepEqual(def.key_spec, []);
assert.deepEqual(def.notification_settings, { grace_period_ms: 0, backlog_size: 0 });
assert.equal(def.storage[0].type, "persist-to-streams-v1");
assert.equal(def.config.query, "q");
// filter-only definitions (no series) are rejected by Graylog with "Event limit must be greater than 0"
assert.ok(ea.buildDefinition({ title: "f", config: { query: "q", streams: ["s"] } }).config.event_limit > 0);
assert.equal(def.config.conditions.expression.right.value, 10);

// deep merge: nested objects merged, arrays replaced, REDACTED ignored
const merged = ea.deepMerge(
    { a: { b: 1, c: [1, 2] }, d: [1, 2, 3], secret: "real" },
    { a: { c: [9] }, d: [7], secret: ea.REDACTED },
);
assert.deepEqual(merged, { a: { b: 1, c: [9] }, d: [7], secret: "real" });

// redaction incl. nested, keys by pattern, encrypted {is_set} left intact
const red = ea.redactSecrets({
    notifications: [{ config: {
        webhook_url: "https://hooks", channel: "#c", api_key: "k", basic_auth: { is_set: true },
        nested: { auth_token: "t", my_password: 1, ok: "fine" },
    } }],
});
const rc = red.notifications[0].config;
assert.equal(rc.webhook_url, ea.REDACTED);
assert.equal(rc.api_key, ea.REDACTED);
assert.deepEqual(rc.basic_auth, { is_set: true });
assert.equal(rc.nested.auth_token, ea.REDACTED);
assert.equal(rc.nested.my_password, ea.REDACTED);
assert.equal(rc.channel, "#c");
assert.equal(rc.nested.ok, "fine");
assert.equal(ea.redactSecrets({ url: "https://u:p@h.io/x?a=1" }).url, `https://${ea.REDACTED}@h.io/x?a=1`);
assert.equal(ea.redactSecrets({ url: "https://h.io/x" }).url, "https://h.io/x");
assert.equal(ea.redactSecrets({ body: "see https://u:p@a.io and ftp://x@b.io/p@q" }).body, `see https://${ea.REDACTED}@a.io and ftp://${ea.REDACTED}@b.io/p@q`);

// confirm gate decision
assert.equal(ea.requiresWriteConfirm("prod", {}), true);
assert.equal(ea.requiresWriteConfirm("PROD-eu", {}), true);
assert.equal(ea.requiresWriteConfirm("prod_v2", {}), true);
assert.equal(ea.requiresWriteConfirm("production", {}), true);
assert.equal(ea.requiresWriteConfirm("nonprod", {}), false);
assert.equal(ea.requiresWriteConfirm("preprod", {}), false);
assert.equal(ea.requiresWriteConfirm("staging", {}), false);
assert.equal(ea.requiresWriteConfirm("prod", { requireWriteConfirm: false }), false);
assert.equal(ea.requiresWriteConfirm("dev", { requireWriteConfirm: true }), true);

// update merges onto the raw GET, never PUTs a redaction, encrypted values become keep_value
const raw = {
    id: "n1", title: "old", description: "",
    config: { type: "http-notification-v1", url: "https://u:p@real", api_key: "real-key", basic_auth: { is_set: true }, api_secret: { is_set: true }, skip_tls_verification: false },
};
const calls = [];
axios.request = async (cfg) => {
    calls.push(cfg);
    return { data: cfg.method === "GET" ? structuredClone(raw) : cfg.data };
};
const req = (args) => ({ params: { arguments: args } });

setActiveConnection("nonprod");
let res = await ea.handleUpdateEventNotification(req({ id: "n1", patch: { title: "new", config: { api_key: ea.REDACTED, url: `https://${ea.REDACTED}@real`, api_secret: { set_value: "s" } } } }));
assert.ok(!res.isError, res.content[0].text);
const put = calls.find(c => c.method === "PUT");
assert.equal(put.url, "http://fake/api/events/notifications/n1");
assert.equal(put.data.title, "new");
assert.equal(put.data.config.api_key, "real-key");
assert.deepEqual(put.data.config.basic_auth, { keep_value: true });
assert.deepEqual(put.data.config.api_secret, { set_value: "s" });
assert.equal(put.data.config.url, "https://u:p@real");
assert.ok(!JSON.stringify(put.data).includes(ea.REDACTED));
assert.ok(!res.content[0].text.includes("real-key"), "response must be redacted");
calls.length = 0;
res = await ea.handleUpdateEventNotification(req({ id: "n1", patch: { config: { headers: [ea.REDACTED] } } }));
assert.equal(res.isError, true);
assert.ok(!calls.some(c => c.method === "PUT"), "redacted array value must never be PUT");

// gated connection: no confirm -> isError describing the write, nothing sent
setActiveConnection("prod");
calls.length = 0;
res = await ea.handleDeleteEventDefinition(req({ id: "d1" }));
assert.equal(res.isError, true);
assert.match(res.content[0].text, /DELETE \/events\/definitions\/d1/);
assert.equal(calls.length, 0);
res = await ea.handleDeleteEventDefinition(req({ id: "d1", confirm: "yes" }));
assert.ok(!res.isError);
assert.equal(calls[0].method, "DELETE");

// update definition preserves DISABLED state (PUT defaults schedule=true)
axios.request = async (cfg) => {
    calls.push(cfg);
    return { data: cfg.method === "GET" ? { id: "d2", state: "DISABLED", title: "t", config: { query: "a" } } : cfg.data };
};
calls.length = 0;
await ea.handleUpdateEventDefinition(req({ id: "d2", patch: { title: "t2" }, confirm: "yes" }));
assert.deepEqual(calls.find(c => c.method === "PUT").params, { schedule: false });

// 403 mapping
const msg = ea.describeHttpError({ response: { status: 403, data: { message: "nope" } } }, "Create event definition");
assert.match(msg, /lacks permission/);

console.log("test-event-admin: all checks passed");
