# 🔍 Graylog MCP Server

An [MCP](https://modelcontextprotocol.io/) server that gives AI assistants direct access to your Graylog logs -- search, aggregate, analyze, and cluster log data through natural language.

## What It Does

This server exposes your Graylog instance(s) as MCP tools, so AI assistants like Claude, Cursor, and others can query logs on your behalf. Instead of context-switching to the Graylog UI, you describe what you're looking for and the assistant handles the rest.

**33 tools** covering:

- **Log search** -- full-text and field-filtered queries with pagination, exact/fuzzy matching, and configurable field selection
- **Contextual analysis** -- fetch surrounding messages around a specific log entry
- **Aggregations** -- histograms, field statistics, and two-dimensional field-over-time breakdowns
- **Log clustering** -- group similar messages into structural templates using Drain3, with persistent template libraries per connection
- **Events & alerting** -- search events; read, create, update, enable/disable, delete and test event definitions and notifications (write-gated, secrets redacted)
- **Saved searches** -- save, list, and reuse query configurations
- **Multi-connection** -- switch between Graylog instances (e.g., nonprod vs prod) within one session
- **Stream & field discovery** -- list streams, discover distinct field values

## Prerequisites

- **Node.js** 18+
- **Graylog** 6.x (tested on 6.2)
- A Graylog API token ([how to create one](https://go2docs.graylog.org/current/setting_up_graylog/rest_api_access_tokens.html))

## Installation

### Via npx (recommended)

No installation needed. Configure your MCP client to run:

```json
{
  "mcpServers": {
    "graylog": {
      "command": "npx",
      "args": ["graylog-mcp-server"]
    }
  }
}
```

### From source

```bash
git clone https://github.com/jagadeesh52423/graylog-mcp.git
cd graylog-mcp
npm install
```

Then point your MCP client to the local entry point:

```json
{
  "mcpServers": {
    "graylog": {
      "command": "node",
      "args": ["/absolute/path/to/graylog-mcp/src/index.js"]
    }
  }
}
```

## Configuration

Create `~/.graylog-mcp/config.json`:

```json
{
  "connections": {
    "nonprod": {
      "baseUrl": "http://graylog-nonprod:9000",
      "apiToken": "your_api_token",
      "requireWriteConfirm": false
    },
    "prod": {
      "baseUrl": "http://graylog-prod:9000",
      "apiToken": "your_prod_api_token",
      "defaultFields": ["timestamp", "message", "level", "source", "PODNAME"]
    }
  },
  "defaultFields": ["timestamp", "gl2_message_id", "source", "env", "level", "message", "logger_name"]
}
```

| Option | Scope | Description |
|---|---|---|
| `connections` | Root | Named Graylog instances, each with `baseUrl` and `apiToken` |
| `defaultFields` | Root | Global default fields returned in search results |
| `defaultFields` | Connection | Per-connection override (takes priority over global) |
| `requireWriteConfirm` | Connection | Write tools need `confirm: "yes"`. Default: `true` when the connection name contains `prod`/`production` as a whole token (`prod`, `PROD-eu` yes; `nonprod`, `preprod` no) |

If no `defaultFields` are set, all fields (`*`) are returned.

Override the config path with the `GRAYLOG_CONFIG_PATH` environment variable:

```json
{
  "mcpServers": {
    "graylog": {
      "command": "npx",
      "args": ["graylog-mcp-server"],
      "env": {
        "GRAYLOG_CONFIG_PATH": "/path/to/custom/config.json"
      }
    }
  }
}
```

### MCP Client Config Locations

| Client | Config file |
|---|---|
| Claude Code | `~/.claude/mcp.json` |
| Cursor | `~/.cursor/mcp.json` |
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |

## Usage

Once connected, talk to your AI assistant naturally. Some examples:

```
Connect to nonprod and show me error logs from the last hour
```

```
What are the top error sources in production over the past 6 hours?
```

```
Show me a histogram of level 3 errors over the past day, broken down by hour
```

```
Cluster the last 1000 error messages and show me the top patterns
```

```
Show me the messages surrounding log ID 01KH5PDR893AZJQBYJJ87AQTW5
```

### Time Ranges

Relative: `30m`, `1h`, `2d`, `1w`, `3M`, `1y`

Absolute: provide `from`/`to` as ISO timestamps (`2024-01-15T09:00:00Z`) or Unix millis.

Default is 15 minutes if unspecified.

## Available Tools

### Connection Management

| Tool | Description |
|---|---|
| `list_connections` | List configured Graylog connections |
| `use_connection` | Switch to a named connection |

### Log Search

| Tool | Description |
|---|---|
| `fetch_graylog_messages` | Search logs with query, filters, time range, pagination |
| `get_surrounding_messages` | Get messages around a specific log entry by ID or timestamp |
| `list_streams` | List available Graylog streams |
| `list_field_values` | Discover distinct values for a field (top N by count) |

### Aggregations

| Tool | Description |
|---|---|
| `get_log_histogram` | Time-bucketed message counts |
| `get_field_aggregation` | Group by field with metrics (count, sum, avg, min, max) |
| `get_field_time_aggregation` | Two-dimensional: field values over time intervals |
| `debug_histogram_query` | Debug helper for empty histogram results |

### Log Clustering

| Tool | Description |
|---|---|
| `cluster_log_messages` | Group similar messages into structural templates (Drain3) |
| `list_log_templates` | List learned templates for the active connection |
| `delete_log_template` | Remove a template |
| `rename_log_template` | Give a template a human-readable label |
| `export_log_templates` | Export template library as JSON |
| `import_log_templates` | Bulk import templates (merge or replace) |

Templates are persisted at `~/.graylog-mcp/templates/<connection>.json` and improve over time as more messages are clustered.

### Events

| Tool | Description |
|---|---|
| `search_events` | Search Graylog events with filters |
| `get_event_definitions` | List event definitions |
| `get_event_notifications` | List event notifications (secrets redacted) |
| `get_event_definition` | Get one event definition by id |
| `get_event_notification` | Get one notification by id (secrets redacted) |
| `create_event_definition` ✍️ | Create an alert; boilerplate defaulted, optional `threshold` shortcut, `schedule`, `dryRun` |
| `update_event_definition` ✍️ | Deep-merge a `patch` (arrays replaced) into an alert and PUT it; keeps enabled/disabled state; `dryRun` |
| `delete_event_definition` ✍️ | Delete an alert |
| `set_event_definition_enabled` ✍️ | Enable (schedule) / disable (unschedule) an alert |
| `create_event_notification` ✍️ | Create a notification (Slack, Teams, email, HTTP, ...) |
| `update_event_notification` ✍️ | Deep-merge a `patch` into a notification; untouched secrets are kept; `dryRun` |
| `delete_event_notification` ✍️ | Delete a notification |
| `test_event_notification` ✍️ | Send a real test message through a notification |

✍️ = writes to Graylog. On connections with `requireWriteConfirm` the call must include `confirm: "yes"`; without it the tool returns the method, path and (redacted) body it would send. `dryRun` never needs confirm — for definitions it calls Graylog's `/events/definitions/validate` (which checks the `config` block only).

Minimal alert: `{ definition: { title, config: { query, streams, search_within_ms, execute_every_ms } }, threshold: { type: "count", operator: ">", value: 10 } }`. `config.streams` is required on Graylog 7.
The `threshold` becomes `config.series` (`count-`) plus `config.conditions.expression`.

**Secret redaction**: notification reads replace `webhook_url`, `api_key`, `api_secret`, `basic_auth` and any key containing token/secret/password with `"[REDACTED]"`, and credentials embedded in any URL (`https://user:pass@host`) become `https://[REDACTED]@host`. Updates merge onto the raw stored object, so secrets you don't patch keep their real values, and patch values containing `"[REDACTED]"` are ignored. Encrypted fields (`basic_auth`, `api_secret`) read back as `{ "is_set": true }` rather than `"[REDACTED]"` and are changed with `{ "set_value": "..." }`.

A 403 from these tools means the API token lacks `eventdefinitions:*` / `eventnotifications:*` permission, not that the tool is unsupported.

### Saved Searches

| Tool | Description |
|---|---|
| `save_search` | Save a query configuration for reuse |
| `list_saved_searches` | List all saved searches |
| `get_saved_search` | Retrieve a saved search by name |
| `delete_saved_search` | Delete a saved search |

## Project Structure

```
src/
├── index.js                          Server bootstrap and request routing
├── config.js                         Connection config and field defaults
├── query.js                          Query building and Graylog API client
├── tools.js                          Tool schema definitions (33 tools)
├── timerange.js                      Flexible time range parsing
├── aggregations.js                   Histogram, field stats, time-series
├── events.js                         Graylog events API
├── saved-searches.js                 Persistent saved search store
├── clustering/
│   ├── index.js                      Strategy registry
│   ├── preprocess.js                 Message normalization and tokenization
│   ├── formatter.js                  Cluster response formatting
│   ├── template-store.js             Per-connection template persistence
│   └── strategies/
│       └── drain3.js                 Drain3 log clustering algorithm
└── tools/
    ├── cluster-errors.js             cluster_log_messages handler
    ├── template-mgmt.js              Template CRUD handlers
    └── event-admin.js                Event definition/notification write tools
```

### Adding a Clustering Algorithm

1. Create `src/clustering/strategies/<name>.js` implementing `hydrate`, `serialize`, and `cluster` (see `drain3.js`)
2. Register it in `src/clustering/index.js`
3. Pass `algorithm: "<name>"` to `cluster_log_messages`

## License

[MIT](LICENSE)
