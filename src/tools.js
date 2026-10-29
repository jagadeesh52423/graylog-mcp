const WRITE_NOTE = " WRITES to Graylog; on protected connections (requireWriteConfirm, default for connection names with a 'prod' or 'production' token) needs confirm: \"yes\" — without it, returns what would be written.";
const ID = { type: "string", description: "Graylog entity id" };
const CONFIRM = { type: "string", description: "Set to \"yes\" to authorize the write on protected connections." };
const DRY_RUN = { type: "boolean", description: "Validate via Graylog (POST /events/definitions/validate) and return the resulting object; writes nothing, no confirm needed." };
const THRESHOLD = {
    type: "object",
    description: "Shortcut condition, translated into config.series + config.conditions. e.g. { type: \"count\", operator: \">\", value: 10 }",
    properties: {
        type: { type: "string", description: "Series function. Default 'count'; others (avg, sum, min, max, card) need field." },
        field: { type: "string" },
        operator: { type: "string", enum: [">", ">=", "<", "<=", "=="] },
        value: { type: "number" },
    },
    required: ["operator", "value"],
};

export const toolDefinitions = [
    {
        name: "list_connections",
        description: "List all available Graylog connections configured in ~/.graylog-mcp/config.json",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "use_connection",
        description: "Connect to a specific Graylog instance by name. Must be called before fetching messages.",
        inputSchema: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "The connection name as defined in ~/.graylog-mcp/config.json",
                },
            },
            required: ["name"],
        },
    },
    {
        name: "fetch_graylog_messages",
        description: "Fetch messages from the active Graylog connection. Use 'use_connection' first to select a connection.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The query to search for, with the respective fields and values",
                },
                timeRange: {
                    type: "string",
                    description: "Time range (e.g., '1h', '2d', '30m') or use from/to for absolute range",
                },
                from: {
                    type: "string",
                    description: "Start time for absolute range (ISO string or timestamp)",
                },
                to: {
                    type: "string",
                    description: "End time for absolute range (ISO string or timestamp)",
                },
                searchTimeRangeInSeconds: {
                    type: "number",
                    description: "[DEPRECATED] Use timeRange instead. Time range in seconds",
                },
                pageSize: {
                    type: "number",
                    description: "Number of messages per page. Default: 50",
                },
                page: {
                    type: "number",
                    description: "Page number (starts at 1). Default: 1",
                },
                fields: {
                    type: "string",
                    description: "Comma-separated field names to return, or '*' for all fields. Default: returns key fields only (timestamp, gl2_message_id, source, env, level, message, logger_name, thread_name, PODNAME)",
                },
                filters: {
                    type: "object",
                    description: "Field filters (e.g. {\"env\": \"marketplace_loki\", \"level\": 7, \"source\": \"prefr-management\"})",
                },
                exactMatch: {
                    type: "boolean",
                    description: "If true (default), wraps the query in quotes for exact match. Set to false for fuzzy/wildcard search.",
                },
                streamIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional stream IDs to scope the search. Use 'list_streams' to get available stream IDs.",
                },
            },
        },
    },
    {
        name: "get_surrounding_messages",
        description: "Get messages surrounding a specific message. Provide messageId (preferred) or messageTimestamp to identify the target message.",
        inputSchema: {
            type: "object",
            properties: {
                messageId: {
                    type: "string",
                    description: "gl2_message_id of the target message (preferred). The timestamp will be looked up automatically.",
                },
                messageTimestamp: {
                    type: "string",
                    description: "ISO timestamp of the target message (fallback if messageId is not available)",
                },
                surroundingSeconds: {
                    type: "number",
                    description: "Time window in seconds (± around the timestamp). Default: 5",
                },
                query: {
                    type: "string",
                    description: "Additional query filter to narrow context",
                },
                filters: {
                    type: "object",
                    description: "Field filters (e.g. {\"env\": \"marketplace_loki\", \"level\": 7})",
                },
                exactMatch: {
                    type: "boolean",
                    description: "If true (default), wraps the query in quotes for exact match. Set to false for fuzzy/wildcard search.",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of messages to return. Default: 50",
                },
                fields: {
                    type: "string",
                    description: "Comma-separated field names to return, or '*' for all fields. Default: returns key fields only (timestamp, gl2_message_id, source, env, level, message, logger_name, thread_name, PODNAME)",
                },
                streamIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional stream IDs to scope the search. Use 'list_streams' to get available stream IDs.",
                },
            },
        },
    },
    {
        name: "list_streams",
        description: "List all available Graylog streams in the active connection.",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "list_field_values",
        description: "List distinct values of a field with message counts. Useful for discovering available sources, environments, logger names, etc. Results are sorted by count descending.",
        inputSchema: {
            type: "object",
            properties: {
                field: {
                    type: "string",
                    description: "The field to get distinct values for (e.g. 'source', 'env', 'logger_name', 'level')",
                },
                query: {
                    type: "string",
                    description: "Query to scope the results (e.g. search within specific messages)",
                },
                filters: {
                    type: "object",
                    description: "Field filters to narrow scope (e.g. {\"env\": \"marketplace_loki\"})",
                },
                exactMatch: {
                    type: "boolean",
                    description: "If true (default), wraps the query in quotes for exact match. Set to false for fuzzy/wildcard search.",
                },
                timeRange: {
                    type: "string",
                    description: "Time range (e.g., '1h', '2d', '30m') or use from/to for absolute range",
                },
                from: {
                    type: "string",
                    description: "Start time for absolute range (ISO string or timestamp)",
                },
                to: {
                    type: "string",
                    description: "End time for absolute range (ISO string or timestamp)",
                },
                timeRangeInSeconds: {
                    type: "number",
                    description: "[DEPRECATED] Use timeRange instead. Time range in seconds. Default: 3600 (1 hour)",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of distinct values to return. Default: 20",
                },
                streamIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional stream IDs to scope the search. Use 'list_streams' to get available stream IDs.",
                },
            },
            required: ["field"],
        },
    },
    {
        name: "get_log_histogram",
        description: "Get a time-based histogram of log messages. Shows message counts over time intervals.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Query to filter messages",
                },
                filters: {
                    type: "object",
                    description: "Field filters (e.g. {\"env\": \"production\", \"level\": 3})",
                },
                exactMatch: {
                    type: "boolean",
                    description: "If true (default), wraps the query in quotes for exact match.",
                },
                timeRange: {
                    type: "string",
                    description: "Time range (e.g., '1h', '2d', '30m') or use from/to for absolute range",
                },
                from: {
                    type: "string",
                    description: "Start time for absolute range (ISO string or timestamp)",
                },
                to: {
                    type: "string",
                    description: "End time for absolute range (ISO string or timestamp)",
                },
                interval: {
                    type: "string",
                    description: "Time interval for buckets (e.g., '1m', '5m', '1h', 'auto'). Default: 'auto'",
                },
                metrics: {
                    type: "array",
                    items: { type: "string", enum: ["count", "sum", "avg", "min", "max"] },
                    description: "Metrics to calculate per time bucket. Default: ['count']. Use with valueField for numeric aggregations.",
                },
                valueField: {
                    type: "string",
                    description: "Numeric field for sum/avg/min/max calculations (e.g., 'latencies_request'). Required when metrics include non-count metrics.",
                },
                streamIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional stream IDs to scope the search. Use 'list_streams' to get available stream IDs.",
                },
            },
        },
    },
    {
        name: "get_field_aggregation",
        description: "Aggregate log messages by field values with statistics. Get counts, sums, averages, etc. for field values.",
        inputSchema: {
            type: "object",
            properties: {
                field: {
                    type: "string",
                    description: "Field to aggregate on (e.g., 'source', 'env', 'logger_name', 'level')",
                },
                query: {
                    type: "string",
                    description: "Query to filter messages",
                },
                filters: {
                    type: "object",
                    description: "Field filters (e.g. {\"env\": \"production\"})",
                },
                exactMatch: {
                    type: "boolean",
                    description: "If true (default), wraps the query in quotes for exact match.",
                },
                timeRange: {
                    type: "string",
                    description: "Time range (e.g., '1h', '2d', '30m') or use from/to for absolute range",
                },
                from: {
                    type: "string",
                    description: "Start time for absolute range (ISO string or timestamp)",
                },
                to: {
                    type: "string",
                    description: "End time for absolute range (ISO string or timestamp)",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of field values to return. Default: 20",
                },
                metrics: {
                    type: "array",
                    items: { type: "string", enum: ["count", "sum", "avg", "min", "max"] },
                    description: "Metrics to calculate. Default: ['count']",
                },
                valueField: {
                    type: "string",
                    description: "Numeric field for sum/avg/min/max calculations (required for non-count metrics)",
                },
                streamIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional stream IDs to scope the search. Use 'list_streams' to get available stream IDs.",
                },
            },
            required: ["field"],
        },
    },
    {
        name: "get_field_time_aggregation",
        description: "Two-dimensional aggregation: field values over time. Shows how field values change over time intervals.",
        inputSchema: {
            type: "object",
            properties: {
                field: {
                    type: "string",
                    description: "Field to aggregate on (e.g., 'source', 'env', 'level')",
                },
                query: {
                    type: "string",
                    description: "Query to filter messages",
                },
                filters: {
                    type: "object",
                    description: "Field filters (e.g. {\"env\": \"production\"})",
                },
                exactMatch: {
                    type: "boolean",
                    description: "If true (default), wraps the query in quotes for exact match.",
                },
                timeRange: {
                    type: "string",
                    description: "Time range (e.g., '1h', '2d', '30m') or use from/to for absolute range",
                },
                from: {
                    type: "string",
                    description: "Start time for absolute range (ISO string or timestamp)",
                },
                to: {
                    type: "string",
                    description: "End time for absolute range (ISO string or timestamp)",
                },
                interval: {
                    type: "string",
                    description: "Time interval for buckets (e.g., '1m', '5m', '1h', 'auto'). Default: 'auto'",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of field values to return. Default: 10",
                },
                streamIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional stream IDs to scope the search. Use 'list_streams' to get available stream IDs.",
                },
            },
            required: ["field"],
        },
    },
    {
        name: "debug_histogram_query",
        description: "Debug helper to test if the histogram query finds any messages at all. Use this if histogram returns empty buckets.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Query to test",
                },
                filters: {
                    type: "object",
                    description: "Field filters to test",
                },
                exactMatch: {
                    type: "boolean",
                    description: "If true (default), wraps the query in quotes for exact match.",
                },
                timeRange: {
                    type: "string",
                    description: "Time range (e.g., '1h', '30m', '2d')",
                },
                from: {
                    type: "string",
                    description: "Start time for absolute range",
                },
                to: {
                    type: "string",
                    description: "End time for absolute range",
                },
                streamIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional stream IDs to scope the search. Use 'list_streams' to get available stream IDs.",
                },
            },
        },
    },
    {
        name: "save_search",
        description: "Save a named search query for later reuse. Saves query parameters so you don't have to re-type complex searches.",
        inputSchema: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "A unique name for this saved search",
                },
                query: {
                    type: "string",
                    description: "The query to save",
                },
                filters: {
                    type: "object",
                    description: "Field filters (e.g. {\"env\": \"production\", \"level\": 3})",
                },
                timeRange: {
                    type: "string",
                    description: "Time range (e.g., '1h', '2d', '30m')",
                },
                from: {
                    type: "string",
                    description: "Start time for absolute range (ISO string or timestamp)",
                },
                to: {
                    type: "string",
                    description: "End time for absolute range (ISO string or timestamp)",
                },
                fields: {
                    type: "string",
                    description: "Comma-separated field names to return, or '*' for all fields",
                },
                streamIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional stream IDs to scope the search",
                },
                exactMatch: {
                    type: "boolean",
                    description: "If true, wraps the query in quotes for exact match",
                },
                pageSize: {
                    type: "number",
                    description: "Number of messages per page",
                },
            },
            required: ["name"],
        },
    },
    {
        name: "list_saved_searches",
        description: "List all saved searches.",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_saved_search",
        description: "Load and execute a saved search by name. Optional overrides can be provided to adjust the search at execution time.",
        inputSchema: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "The name of the saved search to execute",
                },
                page: {
                    type: "number",
                    description: "Page number (starts at 1). Default: 1",
                },
                pageSize: {
                    type: "number",
                    description: "Override the saved page size",
                },
                timeRange: {
                    type: "string",
                    description: "Override the saved time range (e.g., '1h', '2d')",
                },
                from: {
                    type: "string",
                    description: "Override the saved start time",
                },
                to: {
                    type: "string",
                    description: "Override the saved end time",
                },
            },
            required: ["name"],
        },
    },
    {
        name: "delete_saved_search",
        description: "Delete a saved search by name.",
        inputSchema: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "The name of the saved search to delete",
                },
            },
            required: ["name"],
        },
    },
    {
        name: "search_events",
        description: "Search Graylog events and alerts. Use 'use_connection' first to select a connection.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search query for events",
                },
                timeRange: {
                    type: "string",
                    description: "Time range (e.g., '1h', '2d', '30m') or use from/to for absolute range",
                },
                from: {
                    type: "string",
                    description: "Start time for absolute range (ISO string or timestamp)",
                },
                to: {
                    type: "string",
                    description: "End time for absolute range (ISO string or timestamp)",
                },
                alerts: {
                    type: "string",
                    enum: ["only", "include", "exclude"],
                    description: "Filter by alert status. 'only' = only alerts, 'include' = alerts + events, 'exclude' = only non-alert events. Default: include",
                },
                eventDefinitionIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Filter by specific event definition IDs",
                },
                page: {
                    type: "number",
                    description: "Page number (starts at 1). Default: 1",
                },
                perPage: {
                    type: "number",
                    description: "Number of results per page. Default: 25",
                },
                sortBy: {
                    type: "string",
                    description: "Field to sort by. Default: timestamp",
                },
                sortDirection: {
                    type: "string",
                    enum: ["asc", "desc"],
                    description: "Sort direction. Default: desc",
                },
            },
        },
    },
    {
        name: "get_event_definitions",
        description: "Get Graylog event definitions. Use 'use_connection' first to select a connection.",
        inputSchema: {
            type: "object",
            properties: {
                page: {
                    type: "number",
                    description: "Page number (starts at 1). Default: 1",
                },
                perPage: {
                    type: "number",
                    description: "Number of results per page. Default: 25",
                },
                query: {
                    type: "string",
                    description: "Search query to filter event definitions",
                },
            },
        },
    },
    {
        name: "get_event_notifications",
        description: "Get Graylog event notifications (secrets such as webhook_url/api_key are redacted). Use 'use_connection' first to select a connection.",
        inputSchema: {
            type: "object",
            properties: {
                page: {
                    type: "number",
                    description: "Page number (starts at 1). Default: 1",
                },
                perPage: {
                    type: "number",
                    description: "Number of results per page. Default: 25",
                },
            },
        },
    },
    {
        name: "get_event_definition",
        description: "Get a single Graylog event definition (alert) by id.",
        inputSchema: { type: "object", properties: { id: ID }, required: ["id"] },
    },
    {
        name: "create_event_definition",
        description: "Create a Graylog event definition (alert). Boilerplate fields are defaulted; minimal input is title, config.query, config.streams, config.search_within_ms, config.execute_every_ms and a condition (threshold or config.series+conditions)." + WRITE_NOTE,
        inputSchema: {
            type: "object",
            properties: {
                definition: { type: "object", description: "EventDefinitionDto shape (see get_event_definition output). Omitted boilerplate is filled with defaults." },
                threshold: THRESHOLD,
                schedule: { type: "boolean", description: "Enable (schedule) the definition after creating. Default true." },
                dryRun: DRY_RUN,
                confirm: CONFIRM,
            },
            required: ["definition"],
        },
    },
    {
        name: "update_event_definition",
        description: "Update a Graylog event definition: fetches it, deep-merges patch (arrays replaced), PUTs the full object. Enabled/disabled state is preserved." + WRITE_NOTE,
        inputSchema: {
            type: "object",
            properties: {
                id: ID,
                patch: { type: "object", description: "Partial EventDefinitionDto to merge. Arrays replace existing arrays." },
                threshold: THRESHOLD,
                dryRun: DRY_RUN,
                confirm: CONFIRM,
            },
            required: ["id", "patch"],
        },
    },
    {
        name: "delete_event_definition",
        description: "Delete a Graylog event definition." + WRITE_NOTE,
        inputSchema: { type: "object", properties: { id: ID, confirm: CONFIRM }, required: ["id"] },
    },
    {
        name: "set_event_definition_enabled",
        description: "Enable (schedule) or disable (unschedule) a Graylog event definition." + WRITE_NOTE,
        inputSchema: {
            type: "object",
            properties: { id: ID, enabled: { type: "boolean", description: "true = schedule, false = unschedule" }, confirm: CONFIRM },
            required: ["id", "enabled"],
        },
    },
    {
        name: "get_event_notification",
        description: "Get a single Graylog event notification by id (secrets redacted).",
        inputSchema: { type: "object", properties: { id: ID }, required: ["id"] },
    },
    {
        name: "create_event_notification",
        description: "Create a Graylog event notification (slack-notification-v1, teams-notification-v2, email-notification-v1, http-notification-v1, ...)." + WRITE_NOTE,
        inputSchema: {
            type: "object",
            properties: {
                notification: { type: "object", description: "{ title, description?, config: { type, ...type-specific fields } }" },
                confirm: CONFIRM,
            },
            required: ["notification"],
        },
    },
    {
        name: "update_event_notification",
        description: "Update a Graylog event notification: deep-merges patch onto the stored (unredacted) notification, so secrets you don't change are kept. Encrypted fields (basic_auth, api_secret) take { set_value: \"...\" } to change." + WRITE_NOTE,
        inputSchema: {
            type: "object",
            properties: {
                id: ID,
                patch: { type: "object", description: "Partial notification to merge. \"[REDACTED]\" values are ignored (treated as unchanged)." },
                dryRun: { type: "boolean", description: "Return the merged (redacted) notification without writing." },
                confirm: CONFIRM,
            },
            required: ["id", "patch"],
        },
    },
    {
        name: "delete_event_notification",
        description: "Delete a Graylog event notification." + WRITE_NOTE,
        inputSchema: { type: "object", properties: { id: ID, confirm: CONFIRM }, required: ["id"] },
    },
    {
        name: "test_event_notification",
        description: "Send a test alert through an existing notification (delivers a real Slack/Teams/email/HTTP message)." + WRITE_NOTE,
        inputSchema: { type: "object", properties: { id: ID, confirm: CONFIRM }, required: ["id"] },
    },
    {
        name: "cluster_log_messages",
        description: "Cluster similar log messages into Drain3-style templates. Fetches messages with the same args as fetch_graylog_messages, then groups them by structural similarity. Templates are persisted per connection and reused across calls.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Query string (same as fetch_graylog_messages)" },
                filters: { type: "object", description: "Field filters" },
                timeRange: { type: "string", description: "Time range (e.g. '1h', '30m')" },
                from: { type: "string", description: "Absolute start time (ISO)" },
                to: { type: "string", description: "Absolute end time (ISO)" },
                streamIds: { type: "array", items: { type: "string" }, description: "Optional stream IDs" },
                exactMatch: { type: "boolean", description: "Wrap query in quotes (default true)" },
                sampleSize: { type: "number", description: "Max messages to fetch & cluster. Default 1000, max 10000." },
                field: { type: "string", description: "Field to cluster on. Default 'message'." },
                algorithm: { type: "string", description: "Clustering algorithm. Default 'drain3'." },
                minClusterSize: { type: "number", description: "Singletons collapsed under '_misc' cluster. Default 2." },
                readOnly: { type: "boolean", description: "If true, do not update template library. Default false." },
                includeSamples: { type: "number", description: "Sample messages per cluster (first/middle/last by time). Default 3." },
                similarityThreshold: { type: "number", description: "Drain3 similarity threshold 0-1. Default 0.6. Lower = more aggressive merging." },
                maxChildren: { type: "number", description: "Max templates per length bucket (LRU evict beyond this). Default 100." },
            },
        },
    },
    {
        name: "list_log_templates",
        description: "List learned log templates for the active connection.",
        inputSchema: {
            type: "object",
            properties: {
                limit: { type: "number", description: "Max templates to return. Default 50." },
                sortBy: { type: "string", enum: ["count", "last_seen", "first_seen"], description: "Sort key. Default 'count'." },
                filterLabel: { type: "string", description: "Only return templates with this label." },
            },
        },
    },
    {
        name: "delete_log_template",
        description: "Delete a learned log template by ID.",
        inputSchema: {
            type: "object",
            properties: {
                templateId: { type: "string", description: "Template ID (e.g. tpl_a3f1b2)" },
            },
            required: ["templateId"],
        },
    },
    {
        name: "rename_log_template",
        description: "Set or update a human-readable label for a template.",
        inputSchema: {
            type: "object",
            properties: {
                templateId: { type: "string", description: "Template ID" },
                label: { type: "string", description: "Human-readable label (e.g. 'AuthFailure')" },
            },
            required: ["templateId", "label"],
        },
    },
    {
        name: "export_log_templates",
        description: "Export all learned templates for the active connection as JSON.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "import_log_templates",
        description: "Import templates into the active connection's library.",
        inputSchema: {
            type: "object",
            properties: {
                templates: { type: "object", description: "Map of templateId → template object" },
                mode: { type: "string", enum: ["merge", "replace"], description: "merge keeps existing; replace wipes first. Default 'merge'." },
            },
            required: ["templates"],
        },
    },
];
