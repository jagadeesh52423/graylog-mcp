import { getActiveConnection, getActiveConnectionConfig, getConnections } from "../config.js";
import { graylogRequest } from "../events.js";

export const REDACTED = "[REDACTED]";
const SECRET_KEY = /^(webhook_url|api_key|api_secret|basic_auth)$|token|secret|password/i;
// Graylog's validate endpoint does dbService.get(dto.id) — a null id 500s with "hexString can not be null".
const PLACEHOLDER_ID = "000000000000000000000000";
const DEFS = "/events/definitions";
const NOTIFS = "/events/notifications";

const DEFINITION_DEFAULTS = {
    description: "",
    priority: 2,
    alert: true,
    config: {
        type: "aggregation-v1",
        query_parameters: [],
        filters: [],
        stream_categories: [],
        group_by: [],
        series: [],
        conditions: { expression: null },
        use_cron_scheduling: false,
        cron_expression: null,
        cron_timezone: null,
        event_limit: 100, // UI default; Graylog only validates >0 for filter-only (no series) definitions
    },
    field_spec: {},
    key_spec: [],
    notification_settings: { grace_period_ms: 0, backlog_size: 0 },
    notifications: [],
    storage: [{ type: "persist-to-streams-v1", streams: ["000000000000000000000002"] }],
};

const THRESHOLD_OPERATORS = [">", ">=", "<", "<=", "=="];

function errorResponse(text) {
    return { isError: true, content: [{ type: "text", text }] };
}

function ok(data) {
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// Also catches partially redacted strings, e.g. a URL whose userinfo was redacted.
const isRedacted = (v) => typeof v === "string" && v.includes(REDACTED);

// Arrays are replaced, not merged; REDACTED sentinels in the patch mean "unchanged" so they never reach a PUT.
export function deepMerge(base, patch) {
    if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
    const out = { ...base };
    for (const [key, value] of Object.entries(patch)) {
        if (isRedacted(value)) continue;
        out[key] = isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
    }
    return out;
}

export function redactSecrets(value, inSecret = false) {
    if (Array.isArray(value)) return value.map(v => redactSecrets(v, inSecret));
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactSecrets(v, inSecret || SECRET_KEY.test(k))]));
    }
    if (inSecret && (typeof value === "string" || typeof value === "number")) return REDACTED;
    // Strip credentials embedded in URLs (https://user:pass@host/...), keep the rest readable.
    return typeof value === "string" ? value.replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^/?#@\s]*@/gi, `$1${REDACTED}@`) : value;
}

function containsRedacted(value) {
    if (isRedacted(value)) return true;
    if (value !== null && typeof value === "object") return Object.values(value).some(containsRedacted);
    return false;
}

// GET returns EncryptedValue fields as {is_set}; PUT needs {keep_value:true} (or the patched {set_value}) or Graylog treats it as a new value.
export function keepEncryptedValues(value) {
    if (Array.isArray(value)) return value.map(keepEncryptedValues);
    if (!isPlainObject(value)) return value;
    if ("is_set" in value) {
        const { is_set, ...rest } = value;
        return Object.keys(rest).length ? rest : { keep_value: true };
    }
    return Object.fromEntries(Object.keys(value).map(k => [k, keepEncryptedValues(value[k])]));
}

export function thresholdToConditions({ type = "count", field = null, operator, value }) {
    if (!THRESHOLD_OPERATORS.includes(operator)) throw new Error(`threshold.operator must be one of ${THRESHOLD_OPERATORS.join(" ")}`);
    if (typeof value !== "number") throw new Error("threshold.value must be a number");
    if (type !== "count" && !field) throw new Error(`threshold.field is required for type "${type}"`);
    // Same id convention the Graylog UI uses ("count-", "avg-took_ms").
    const id = `${type}-${field ?? ""}`;
    return {
        series: [{ type, id, field }],
        conditions: {
            expression: {
                expr: operator,
                left: { expr: "number-ref", ref: id },
                right: { expr: "number", value },
            },
        },
    };
}

export function buildDefinition(definition, threshold) {
    const merged = deepMerge(DEFINITION_DEFAULTS, definition);
    if (threshold) merged.config = { ...merged.config, ...thresholdToConditions(threshold) };
    return merged;
}

export function requiresWriteConfirm(connectionName, connectionConfig) {
    if (typeof connectionConfig?.requireWriteConfirm === "boolean") return connectionConfig.requireWriteConfirm;
    return (connectionName ?? "").toLowerCase().split(/[^a-z0-9]+/).some(t => t === "prod" || t === "production");
}

export function describeHttpError(err, action) {
    const status = err.response?.status;
    if (!status) return `${action} failed: ${err.message}`;
    const body = err.response.data;
    let detail = typeof body === "string" ? body : (body?.message ?? "");
    if (body?.errors) detail += ` validation errors: ${JSON.stringify(body.errors)}`;
    if (status === 403) {
        return `${action} failed: HTTP 403 — the Graylog API token lacks permission for this operation ` +
            `(needs eventdefinitions:create/edit/delete or eventnotifications:create/edit/delete). ` +
            `This is a token-authority issue, not an MCP limitation. ${detail}`.trim();
    }
    return `${action} failed: HTTP ${status} ${detail}`.trim();
}

function handler(action, fn) {
    return async (request) => {
        const args = request.params.arguments || {};
        const config = getActiveConnectionConfig();
        if (!config) {
            const available = Object.keys(getConnections()).join(", ");
            return errorResponse(`No active connection. Use 'use_connection' first. Available: ${available || "none"}`);
        }
        const conn = { name: getActiveConnection(), config };
        const call = (method, path, opts) => graylogRequest(config.baseUrl, config.apiToken, method, path, opts);
        try {
            return await fn(args, conn, call);
        } catch (err) {
            return errorResponse(err.response ? describeHttpError(err, action) : `${action} failed: ${err.message}`);
        }
    };
}

function requireId(args) {
    if (typeof args.id !== "string" || !args.id) throw new Error("id is required");
    return encodeURIComponent(args.id);
}

async function gatedWrite(conn, args, call, method, path, body, params) {
    if (requiresWriteConfirm(conn.name, conn.config) && args.confirm !== "yes") {
        const summary = body === undefined ? "(no body)" : JSON.stringify(redactSecrets(body)).slice(0, 2000);
        return errorResponse(
            `Write blocked: connection "${conn.name}" requires confirmation. Re-run with confirm: "yes" to perform:\n` +
            `${method} ${params ? `${path}?${new URLSearchParams(params)}` : path}\nbody: ${summary}`
        );
    }
    const data = await call(method, path, { data: body, params });
    return ok(data === "" || data == null ? { message: `${method} ${path} succeeded` } : redactSecrets(data));
}

async function dryRunDefinition(call, dto) {
    const result = await call("POST", `${DEFS}/validate`, { data: { ...dto, id: dto.id ?? PLACEHOLDER_ID } });
    return result?.failed ? errorResponse(`Validation failed: ${JSON.stringify(result)}`) : ok({ dryRun: true, validation: result, definition: dto });
}

export const handleGetEventDefinition = handler("Get event definition", async (args, conn, call) =>
    ok(await call("GET", `${DEFS}/${requireId(args)}`)));

export const handleGetEventNotification = handler("Get event notification", async (args, conn, call) =>
    ok(redactSecrets(await call("GET", `${NOTIFS}/${requireId(args)}`))));

export const handleCreateEventDefinition = handler("Create event definition", async (args, conn, call) => {
    if (!isPlainObject(args.definition)) return errorResponse("definition is required (object)");
    if (containsRedacted(args.definition)) return errorResponse(`definition contains "${REDACTED}" placeholders; supply real values`);
    const dto = buildDefinition(args.definition, args.threshold);
    delete dto.id;
    if (args.dryRun) return dryRunDefinition(call, dto);
    const schedule = args.schedule ?? true;
    return gatedWrite(conn, args, call, "POST", DEFS, { entity: dto }, { schedule });
});

export const handleUpdateEventDefinition = handler("Update event definition", async (args, conn, call) => {
    const id = requireId(args);
    if (!isPlainObject(args.patch)) return errorResponse("patch is required (object)");
    const current = await call("GET", `${DEFS}/${id}`);
    const merged = { ...deepMerge(current, args.patch), id: current.id };
    if (args.threshold) merged.config = { ...merged.config, ...thresholdToConditions(args.threshold) };
    if (args.dryRun) return dryRunDefinition(call, merged);
    // PUT defaults schedule=true, which would silently re-enable a disabled definition.
    const schedule = merged.state !== "DISABLED";
    return gatedWrite(conn, args, call, "PUT", `${DEFS}/${id}`, merged, { schedule });
});

export const handleDeleteEventDefinition = handler("Delete event definition", async (args, conn, call) =>
    gatedWrite(conn, args, call, "DELETE", `${DEFS}/${requireId(args)}`));

export const handleSetEventDefinitionEnabled = handler("Set event definition enabled", async (args, conn, call) => {
    const id = requireId(args);
    if (typeof args.enabled !== "boolean") return errorResponse("enabled is required (boolean)");
    return gatedWrite(conn, args, call, "PUT", `${DEFS}/${id}/${args.enabled ? "schedule" : "unschedule"}`);
});

export const handleCreateEventNotification = handler("Create event notification", async (args, conn, call) => {
    const n = args.notification;
    if (!isPlainObject(n) || !n.title || !isPlainObject(n.config) || !n.config.type) {
        return errorResponse("notification is required: { title, description?, config: { type, ... } }");
    }
    if (containsRedacted(n)) return errorResponse(`notification contains "${REDACTED}" placeholders; supply real values`);
    const { id, ...dto } = { description: "", ...n };
    return gatedWrite(conn, args, call, "POST", NOTIFS, { entity: dto });
});

export const handleUpdateEventNotification = handler("Update event notification", async (args, conn, call) => {
    const id = requireId(args);
    if (!isPlainObject(args.patch)) return errorResponse("patch is required (object)");
    // Merge onto the raw (unredacted) GET so untouched secrets keep their real values.
    const current = await call("GET", `${NOTIFS}/${id}`);
    const merged = keepEncryptedValues({ ...deepMerge(current, args.patch), id: current.id });
    // Arrays are replaced wholesale by deepMerge, so placeholders inside them would reach the PUT.
    if (containsRedacted(merged)) return errorResponse(`patch contains "${REDACTED}" placeholders inside arrays; supply real values`);
    if (args.dryRun) return ok({ dryRun: true, notification: redactSecrets(merged) });
    return gatedWrite(conn, args, call, "PUT", `${NOTIFS}/${id}`, merged);
});

export const handleDeleteEventNotification = handler("Delete event notification", async (args, conn, call) =>
    gatedWrite(conn, args, call, "DELETE", `${NOTIFS}/${requireId(args)}`));

export const handleTestEventNotification = handler("Test event notification", async (args, conn, call) =>
    gatedWrite(conn, args, call, "POST", `${NOTIFS}/${requireId(args)}/test`));
