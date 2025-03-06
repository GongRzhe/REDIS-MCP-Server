#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createClient, RedisFlushModes } from './redis-types.js';
// Configuration constants
const DEFAULT_REDIS_URL = "redis://localhost:6379";
const DEFAULT_TIMEOUT = 5000; // 5 seconds
const MAX_RETRY_COUNT = 3;
const SCAN_BATCH_SIZE = 100;
// Command line arguments
const args = process.argv.slice(2);
const REDIS_URL = args[0] || DEFAULT_REDIS_URL;
// Parse additional options from command line
const redisOptions = {
    url: REDIS_URL,
    socket: {
        connectTimeout: DEFAULT_TIMEOUT,
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000), // Exponential backoff
    }
};
// Check for TLS flag
if (args.includes("--tls")) {
    redisOptions.socket = {
        ...redisOptions.socket,
        tls: true
    };
}
// Check for username/password
const authIndex = args.findIndex(arg => arg === "--auth");
if (authIndex !== -1 && args.length > authIndex + 2) {
    const username = args[authIndex + 1];
    const password = args[authIndex + 2];
    redisOptions.username = username;
    redisOptions.password = password;
}
// Create Redis client with options
const redisClient = createClient(redisOptions);
// Define Zod schemas for all operations
// String operations
const SetArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    value: z.string(),
    expireSeconds: z.number().positive().optional(),
});
const GetArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
});
const DeleteArgumentsSchema = z.object({
    key: z.union([
        z.string().min(1, "Key must not be empty"),
        z.array(z.string().min(1, "Key must not be empty")).min(1, "Must provide at least one key")
    ]),
});
const ListArgumentsSchema = z.object({
    pattern: z.string().default("*"),
    count: z.number().positive().default(SCAN_BATCH_SIZE),
    cursor: z.string().default("0"),
});
const ExpireArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    seconds: z.number().int().nonnegative(),
});
const TtlArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
});
// String increment/decrement operations
const IncrArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
});
const IncrByArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    increment: z.number().int(),
});
const DecrArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
});
const DecrByArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    decrement: z.number().int(),
});
// Multi-key operations
const MGetArgumentsSchema = z.object({
    keys: z.array(z.string().min(1, "Key must not be empty")).min(1, "Must provide at least one key"),
});
const MSetArgumentsSchema = z.object({
    keyValues: z.array(z.object({
        key: z.string().min(1, "Key must not be empty"),
        value: z.string(),
    })).min(1, "Must provide at least one key-value pair"),
});
// Hash operations
const HSetArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    field: z.string().min(1, "Field must not be empty"),
    value: z.string(),
});
const HMSetArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    fieldValues: z.array(z.object({
        field: z.string().min(1, "Field must not be empty"),
        value: z.string(),
    })).min(1, "Must provide at least one field-value pair"),
});
const HGetArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    field: z.string().min(1, "Field must not be empty"),
});
const HMGetArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    fields: z.array(z.string().min(1, "Field must not be empty")).min(1, "Must provide at least one field"),
});
const HDelArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    field: z.union([
        z.string().min(1, "Field must not be empty"),
        z.array(z.string().min(1, "Field must not be empty")).min(1, "Must provide at least one field")
    ]),
});
const HGetAllArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
});
const HExistsArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    field: z.string().min(1, "Field must not be empty"),
});
const HIncrByArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    field: z.string().min(1, "Field must not be empty"),
    increment: z.number().int(),
});
const HKeysArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
});
const HValsArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
});
const HLenArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
});
// List operations
const LPushArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    value: z.union([
        z.string(),
        z.array(z.string()).min(1, "Must provide at least one value")
    ]),
});
const RPushArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    value: z.union([
        z.string(),
        z.array(z.string()).min(1, "Must provide at least one value")
    ]),
});
const LPopArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    count: z.number().int().positive().optional(),
});
const RPopArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    count: z.number().int().positive().optional(),
});
const LRangeArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    start: z.number().int(),
    stop: z.number().int(),
});
const LLenArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
});
const LSetArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    index: z.number().int(),
    value: z.string(),
});
const LRemArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    count: z.number().int(),
    value: z.string(),
});
// Set operations
const SAddArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    member: z.union([
        z.string(),
        z.array(z.string()).min(1, "Must provide at least one member")
    ]),
});
const SRemArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    member: z.union([
        z.string(),
        z.array(z.string()).min(1, "Must provide at least one member")
    ]),
});
const SMembersArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
});
const SIsMemberArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    member: z.string(),
});
const SCardArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
});
const SInterArgumentsSchema = z.object({
    keys: z.array(z.string().min(1, "Key must not be empty")).min(2, "Must provide at least two keys"),
});
const SUnionArgumentsSchema = z.object({
    keys: z.array(z.string().min(1, "Key must not be empty")).min(2, "Must provide at least two keys"),
});
const SDiffArgumentsSchema = z.object({
    keys: z.array(z.string().min(1, "Key must not be empty")).min(2, "Must provide at least two keys"),
});
// Sorted set operations
const ZAddArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    members: z.array(z.object({
        score: z.number(),
        member: z.string(),
    })).min(1, "Must provide at least one scored member"),
});
const ZRemArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    member: z.union([
        z.string(),
        z.array(z.string()).min(1, "Must provide at least one member")
    ]),
});
const ZRangeArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    min: z.number().int(),
    max: z.number().int(),
    withScores: z.boolean().default(false),
});
const ZRangeByScoreArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    min: z.number(),
    max: z.number(),
    withScores: z.boolean().default(false),
});
const ZRankArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    member: z.string(),
});
const ZScoreArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    member: z.string(),
});
const ZCardArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
});
const ZCountArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    min: z.number(),
    max: z.number(),
});
// Pub/Sub operations
const PublishArgumentsSchema = z.object({
    channel: z.string().min(1, "Channel must not be empty"),
    message: z.string(),
});
// Streams operations
const XAddArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    id: z.string().default("*"),
    fields: z.array(z.object({
        name: z.string().min(1, "Field name must not be empty"),
        value: z.string(),
    })).min(1, "Must provide at least one field"),
});
const XRangeArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    start: z.string().default("-"),
    end: z.string().default("+"),
    count: z.number().int().positive().optional(),
});
const XReadArgumentsSchema = z.object({
    streams: z.array(z.object({
        key: z.string().min(1, "Key must not be empty"),
        id: z.string().default("$"),
    })).min(1, "Must provide at least one stream"),
    count: z.number().int().positive().optional(),
    block: z.number().int().nonnegative().optional(),
});
// JSON operations (for RedisJSON)
const JsonSetArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    path: z.string().default("."),
    json: z.any(),
});
const JsonGetArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    path: z.string().default("."),
});
const JsonTypeArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    path: z.string().default("."),
});
const JsonArrAppendArgumentsSchema = z.object({
    key: z.string().min(1, "Key must not be empty"),
    path: z.string(),
    value: z.any(),
});
// Transaction support
const TransactionArgumentsSchema = z.object({
    commands: z.array(z.object({
        command: z.string().min(1, "Command must not be empty"),
        args: z.array(z.any()).default([]),
    })).min(1, "Must provide at least one command"),
});
// Monitoring and management
const InfoArgumentsSchema = z.object({
    section: z.string().optional(),
});
const SelectArgumentsSchema = z.object({
    db: z.number().int().nonnegative(),
});
const FlushDbArgumentsSchema = z.object({
    async: z.boolean().default(false),
});
// Testing tools
const PingArgumentsSchema = z.object({
    message: z.string().optional(),
});
const EchoArgumentsSchema = z.object({
    message: z.string(),
});
// Create server instance
const server = new Server({
    name: "redis",
    version: "2.0.0"
});
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            // String operations
            {
                name: "set",
                description: "Set a Redis key-value pair with optional expiration",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key",
                        },
                        value: {
                            type: "string",
                            description: "Value to store",
                        },
                        expireSeconds: {
                            type: "number",
                            description: "Optional expiration time in seconds",
                        },
                    },
                    required: ["key", "value"],
                },
            },
            {
                name: "get",
                description: "Get value by key from Redis",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key to retrieve",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "delete",
                description: "Delete one or more keys from Redis",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            oneOf: [
                                { type: "string" },
                                { type: "array", items: { type: "string" } }
                            ],
                            description: "Key or array of keys to delete",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "scan",
                description: "Iteratively list Redis keys matching a pattern",
                inputSchema: {
                    type: "object",
                    properties: {
                        pattern: {
                            type: "string",
                            description: "Pattern to match keys (default: *)",
                        },
                        count: {
                            type: "number",
                            description: `Number of keys to return per batch (default: ${SCAN_BATCH_SIZE})`,
                        },
                        cursor: {
                            type: "string",
                            description: "Cursor for pagination (default: 0)",
                        },
                    },
                },
            },
            {
                name: "expire",
                description: "Set expiration time for a key",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key",
                        },
                        seconds: {
                            type: "number",
                            description: "Expiration time in seconds",
                        },
                    },
                    required: ["key", "seconds"],
                },
            },
            {
                name: "ttl",
                description: "Get remaining time to live for a key",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key",
                        },
                    },
                    required: ["key"],
                },
            },
            // Increment/Decrement operations
            {
                name: "incr",
                description: "Increment numeric value of a key by 1",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key to increment",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "incrby",
                description: "Increment numeric value of a key by specified amount",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key to increment",
                        },
                        increment: {
                            type: "number",
                            description: "Amount to increment by",
                        },
                    },
                    required: ["key", "increment"],
                },
            },
            {
                name: "decr",
                description: "Decrement numeric value of a key by 1",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key to decrement",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "decrby",
                description: "Decrement numeric value of a key by specified amount",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key to decrement",
                        },
                        decrement: {
                            type: "number",
                            description: "Amount to decrement by",
                        },
                    },
                    required: ["key", "decrement"],
                },
            },
            // Multi-key operations
            {
                name: "mget",
                description: "Get multiple values by their keys",
                inputSchema: {
                    type: "object",
                    properties: {
                        keys: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of Redis keys to retrieve",
                        },
                    },
                    required: ["keys"],
                },
            },
            {
                name: "mset",
                description: "Set multiple key-value pairs in a single operation",
                inputSchema: {
                    type: "object",
                    properties: {
                        keyValues: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    key: { type: "string" },
                                    value: { type: "string" },
                                },
                                required: ["key", "value"],
                            },
                            description: "Array of key-value pairs to set",
                        },
                    },
                    required: ["keyValues"],
                },
            },
            // Hash operations
            {
                name: "hset",
                description: "Set field in a Redis hash",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                        field: {
                            type: "string",
                            description: "Field name within the hash",
                        },
                        value: {
                            type: "string",
                            description: "Value to store for the field",
                        },
                    },
                    required: ["key", "field", "value"],
                },
            },
            {
                name: "hmset",
                description: "Set multiple fields in a Redis hash",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                        fieldValues: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    field: { type: "string" },
                                    value: { type: "string" },
                                },
                                required: ["field", "value"],
                            },
                            description: "Array of field-value pairs to set",
                        },
                    },
                    required: ["key", "fieldValues"],
                },
            },
            {
                name: "hget",
                description: "Get field value from a Redis hash",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                        field: {
                            type: "string",
                            description: "Field name to retrieve",
                        },
                    },
                    required: ["key", "field"],
                },
            },
            {
                name: "hmget",
                description: "Get multiple field values from a Redis hash",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                        fields: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of field names to retrieve",
                        },
                    },
                    required: ["key", "fields"],
                },
            },
            {
                name: "hdel",
                description: "Delete field(s) from a Redis hash",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                        field: {
                            oneOf: [
                                { type: "string" },
                                { type: "array", items: { type: "string" } }
                            ],
                            description: "Field or array of fields to delete",
                        },
                    },
                    required: ["key", "field"],
                },
            },
            {
                name: "hgetall",
                description: "Get all fields and values from a Redis hash",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "hexists",
                description: "Check if field exists in a Redis hash",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                        field: {
                            type: "string",
                            description: "Field name to check",
                        },
                    },
                    required: ["key", "field"],
                },
            },
            {
                name: "hincrby",
                description: "Increment numeric value of a hash field by specified amount",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                        field: {
                            type: "string",
                            description: "Field name to increment",
                        },
                        increment: {
                            type: "number",
                            description: "Amount to increment by",
                        },
                    },
                    required: ["key", "field", "increment"],
                },
            },
            {
                name: "hkeys",
                description: "Get all field names from a Redis hash",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "hvals",
                description: "Get all values from a Redis hash",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "hlen",
                description: "Get the number of fields in a Redis hash",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis hash key",
                        },
                    },
                    required: ["key"],
                },
            },
            // List operations
            {
                name: "lpush",
                description: "Prepend value(s) to a Redis list",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                        value: {
                            oneOf: [
                                { type: "string" },
                                { type: "array", items: { type: "string" } }
                            ],
                            description: "Value or array of values to prepend",
                        },
                    },
                    required: ["key", "value"],
                },
            },
            {
                name: "rpush",
                description: "Append value(s) to a Redis list",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                        value: {
                            oneOf: [
                                { type: "string" },
                                { type: "array", items: { type: "string" } }
                            ],
                            description: "Value or array of values to append",
                        },
                    },
                    required: ["key", "value"],
                },
            },
            {
                name: "lpop",
                description: "Remove and get the first element(s) from a Redis list",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                        count: {
                            type: "number",
                            description: "Number of elements to pop (optional)",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "rpop",
                description: "Remove and get the last element(s) from a Redis list",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                        count: {
                            type: "number",
                            description: "Number of elements to pop (optional)",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "lrange",
                description: "Get a range of elements from a Redis list",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                        start: {
                            type: "number",
                            description: "Start index (0-based)",
                        },
                        stop: {
                            type: "number",
                            description: "Stop index (inclusive)",
                        },
                    },
                    required: ["key", "start", "stop"],
                },
            },
            {
                name: "llen",
                description: "Get the length of a Redis list",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "lset",
                description: "Set the value of an element in a Redis list by its index",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                        index: {
                            type: "number",
                            description: "Index of the element to set",
                        },
                        value: {
                            type: "string",
                            description: "Value to set",
                        },
                    },
                    required: ["key", "index", "value"],
                },
            },
            {
                name: "lrem",
                description: "Remove elements from a Redis list by value",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis list key",
                        },
                        count: {
                            type: "number",
                            description: "Number of occurrences to remove (0: all, positive: from head, negative: from tail)",
                        },
                        value: {
                            type: "string",
                            description: "Value to remove",
                        },
                    },
                    required: ["key", "count", "value"],
                },
            },
            // Set operations
            {
                name: "sadd",
                description: "Add member(s) to a Redis set",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis set key",
                        },
                        member: {
                            oneOf: [
                                { type: "string" },
                                { type: "array", items: { type: "string" } }
                            ],
                            description: "Member or array of members to add",
                        },
                    },
                    required: ["key", "member"],
                },
            },
            {
                name: "srem",
                description: "Remove member(s) from a Redis set",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis set key",
                        },
                        member: {
                            oneOf: [
                                { type: "string" },
                                { type: "array", items: { type: "string" } }
                            ],
                            description: "Member or array of members to remove",
                        },
                    },
                    required: ["key", "member"],
                },
            },
            {
                name: "smembers",
                description: "Get all members from a Redis set",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis set key",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "sismember",
                description: "Check if member exists in a Redis set",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis set key",
                        },
                        member: {
                            type: "string",
                            description: "Member to check",
                        },
                    },
                    required: ["key", "member"],
                },
            },
            {
                name: "scard",
                description: "Get the number of members in a Redis set",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis set key",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "sinter",
                description: "Intersect multiple Redis sets",
                inputSchema: {
                    type: "object",
                    properties: {
                        keys: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of Redis set keys to intersect",
                        },
                    },
                    required: ["keys"],
                },
            },
            {
                name: "sunion",
                description: "Union multiple Redis sets",
                inputSchema: {
                    type: "object",
                    properties: {
                        keys: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of Redis set keys to union",
                        },
                    },
                    required: ["keys"],
                },
            },
            {
                name: "sdiff",
                description: "Difference between multiple Redis sets",
                inputSchema: {
                    type: "object",
                    properties: {
                        keys: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of Redis set keys (first key - all others)",
                        },
                    },
                    required: ["keys"],
                },
            },
            // Sorted set operations
            {
                name: "zadd",
                description: "Add scored member(s) to a Redis sorted set",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis sorted set key",
                        },
                        members: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    score: { type: "number" },
                                    member: { type: "string" },
                                },
                                required: ["score", "member"],
                            },
                            description: "Array of scored members to add",
                        },
                    },
                    required: ["key", "members"],
                },
            },
            {
                name: "zrem",
                description: "Remove member(s) from a Redis sorted set",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis sorted set key",
                        },
                        member: {
                            oneOf: [
                                { type: "string" },
                                { type: "array", items: { type: "string" } }
                            ],
                            description: "Member or array of members to remove",
                        },
                    },
                    required: ["key", "member"],
                },
            },
            {
                name: "zrange",
                description: "Get range of members from a Redis sorted set by index",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis sorted set key",
                        },
                        min: {
                            type: "number",
                            description: "Minimum index",
                        },
                        max: {
                            type: "number",
                            description: "Maximum index",
                        },
                        withScores: {
                            type: "boolean",
                            description: "Include scores in output (default: false)",
                        },
                    },
                    required: ["key", "min", "max"],
                },
            },
            {
                name: "zrangebyscore",
                description: "Get range of members from a Redis sorted set by score",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis sorted set key",
                        },
                        min: {
                            type: "number",
                            description: "Minimum score",
                        },
                        max: {
                            type: "number",
                            description: "Maximum score",
                        },
                        withScores: {
                            type: "boolean",
                            description: "Include scores in output (default: false)",
                        },
                    },
                    required: ["key", "min", "max"],
                },
            },
            {
                name: "zrank",
                description: "Get rank of member in a Redis sorted set (0-based)",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis sorted set key",
                        },
                        member: {
                            type: "string",
                            description: "Member to get rank for",
                        },
                    },
                    required: ["key", "member"],
                },
            },
            {
                name: "zscore",
                description: "Get score of member in a Redis sorted set",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis sorted set key",
                        },
                        member: {
                            type: "string",
                            description: "Member to get score for",
                        },
                    },
                    required: ["key", "member"],
                },
            },
            {
                name: "zcard",
                description: "Get the number of members in a Redis sorted set",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis sorted set key",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "zcount",
                description: "Count members in a Redis sorted set with scores within a range",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis sorted set key",
                        },
                        min: {
                            type: "number",
                            description: "Minimum score",
                        },
                        max: {
                            type: "number",
                            description: "Maximum score",
                        },
                    },
                    required: ["key", "min", "max"],
                },
            },
            // Pub/Sub operations
            {
                name: "publish",
                description: "Publish a message to a Redis channel",
                inputSchema: {
                    type: "object",
                    properties: {
                        channel: {
                            type: "string",
                            description: "Channel name",
                        },
                        message: {
                            type: "string",
                            description: "Message to publish",
                        },
                    },
                    required: ["channel", "message"],
                },
            },
            // Streams operations
            {
                name: "xadd",
                description: "Add an entry to a Redis stream",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis stream key",
                        },
                        id: {
                            type: "string",
                            description: "Entry ID (default: *, auto-generated)",
                        },
                        fields: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    value: { type: "string" },
                                },
                                required: ["name", "value"],
                            },
                            description: "Array of name-value pairs",
                        },
                    },
                    required: ["key", "fields"],
                },
            },
            {
                name: "xrange",
                description: "Get entries from a Redis stream within an ID range",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis stream key",
                        },
                        start: {
                            type: "string",
                            description: "Start ID (default: -, earliest)",
                        },
                        end: {
                            type: "string",
                            description: "End ID (default: +, latest)",
                        },
                        count: {
                            type: "number",
                            description: "Maximum number of entries to return",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "xread",
                description: "Block and read entries from Redis streams",
                inputSchema: {
                    type: "object",
                    properties: {
                        streams: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    key: { type: "string" },
                                    id: { type: "string" },
                                },
                                required: ["key", "id"],
                            },
                            description: "Array of streams with IDs to read from",
                        },
                        count: {
                            type: "number",
                            description: "Maximum number of entries to return per stream",
                        },
                        block: {
                            type: "number",
                            description: "Block for milliseconds (0: indefinitely)",
                        },
                    },
                    required: ["streams"],
                },
            },
            // JSON operations (for RedisJSON)
            {
                name: "json_set",
                description: "Set JSON at path in Redis (requires RedisJSON)",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key",
                        },
                        path: {
                            type: "string",
                            description: "Path to set (default: ., root)",
                        },
                        json: {
                            type: "object",
                            description: "JSON data to set",
                        },
                    },
                    required: ["key", "json"],
                },
            },
            {
                name: "json_get",
                description: "Get JSON from path in Redis (requires RedisJSON)",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key",
                        },
                        path: {
                            type: "string",
                            description: "Path to get (default: ., root)",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "json_type",
                description: "Get type of JSON at path in Redis (requires RedisJSON)",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key",
                        },
                        path: {
                            type: "string",
                            description: "Path to check (default: ., root)",
                        },
                    },
                    required: ["key"],
                },
            },
            {
                name: "json_arrappend",
                description: "Append to JSON array in Redis (requires RedisJSON)",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Redis key",
                        },
                        path: {
                            type: "string",
                            description: "Path to array",
                        },
                        value: {
                            type: "object",
                            description: "Value to append",
                        },
                    },
                    required: ["key", "path", "value"],
                },
            },
            // Transaction support
            {
                name: "transaction",
                description: "Execute multiple Redis commands atomically",
                inputSchema: {
                    type: "object",
                    properties: {
                        commands: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    command: { type: "string" },
                                    args: { type: "array" },
                                },
                                required: ["command"],
                            },
                            description: "Array of commands to execute atomically",
                        },
                    },
                    required: ["commands"],
                },
            },
            // Monitoring and management
            {
                name: "info",
                description: "Get information and statistics about Redis server",
                inputSchema: {
                    type: "object",
                    properties: {
                        section: {
                            type: "string",
                            description: "Optional section (e.g., 'server', 'clients', 'memory')",
                        },
                    },
                },
            },
            {
                name: "select",
                description: "Select Redis logical database by index",
                inputSchema: {
                    type: "object",
                    properties: {
                        db: {
                            type: "number",
                            description: "Database index",
                        },
                    },
                    required: ["db"],
                },
            },
            {
                name: "flushdb",
                description: "Remove all keys from the current database",
                inputSchema: {
                    type: "object",
                    properties: {
                        async: {
                            type: "boolean",
                            description: "Asynchronous flush (default: false)",
                        },
                    },
                },
            },
            // Testing tools
            {
                name: "ping",
                description: "Test connection to Redis server",
                inputSchema: {
                    type: "object",
                    properties: {
                        message: {
                            type: "string",
                            description: "Optional message to include in response",
                        },
                    },
                },
            },
            {
                name: "echo",
                description: "Echo message back from Redis server",
                inputSchema: {
                    type: "object",
                    properties: {
                        message: {
                            type: "string",
                            description: "Message to echo",
                        },
                    },
                    required: ["message"],
                },
            },
            {
                name: "list",
                description: "List Redis keys matching a pattern",
                inputSchema: {
                    type: "object",
                    properties: {
                        pattern: {
                            type: "string",
                            description: "Pattern to match keys (default: *)",
                        },
                    },
                },
            },
        ],
    };
});
// Helper function to handle retry for operations
async function withRetry(operation, maxRetries = MAX_RETRY_COUNT) {
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (e) {
            const error = e;
            lastError = error;
            // Only retry certain types of errors (connection issues)
            if (!error.message.includes("connection") && !error.message.includes("timeout")) {
                throw error;
            }
            // Wait before retrying (with exponential backoff)
            const waitTime = Math.min(100 * Math.pow(2, attempt), 2000);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    throw lastError;
}
// Helper function to format error messages
function formatError(error) {
    if (error instanceof z.ZodError) {
        return `Invalid arguments: ${error.errors
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join(", ")}`;
    }
    return error instanceof Error ? error.message : String(error);
}
// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        // String operations
        if (name === "set") {
            const { key, value, expireSeconds } = SetArgumentsSchema.parse(args);
            await withRetry(async () => {
                if (expireSeconds !== undefined) {
                    await redisClient.setEx(key, expireSeconds, value);
                }
                else {
                    await redisClient.set(key, value);
                }
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully set key: ${key}`,
                    },
                ],
            };
        }
        else if (name === "get") {
            const { key } = GetArgumentsSchema.parse(args);
            const value = await withRetry(async () => {
                return await redisClient.get(key);
            });
            if (value === null) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Key not found: ${key}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: value,
                    },
                ],
            };
        }
        else if (name === "delete") {
            const { key } = DeleteArgumentsSchema.parse(args);
            if (Array.isArray(key)) {
                const deletedCount = await withRetry(async () => {
                    return await redisClient.del(key);
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully deleted ${deletedCount} key(s)`,
                        },
                    ],
                };
            }
            else {
                const deletedCount = await withRetry(async () => {
                    return await redisClient.del(key);
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: deletedCount ? `Successfully deleted key: ${key}` : `Key not found: ${key}`,
                        },
                    ],
                };
            }
        }
        else if (name === "scan") {
            const { pattern, count, cursor } = ListArgumentsSchema.parse(args);
            const result = await withRetry(async () => {
                return await redisClient.scan(parseInt(cursor), {
                    MATCH: pattern,
                    COUNT: count
                });
            });
            const [nextCursor, keys] = result;
            return {
                content: [
                    {
                        type: "text",
                        text: keys.length > 0
                            ? `Found keys (cursor: ${nextCursor}):\n${keys.join('\n')}`
                            : `No keys found matching pattern (cursor: ${nextCursor})`,
                    },
                ],
            };
        }
        else if (name === "expire") {
            const { key, seconds } = ExpireArgumentsSchema.parse(args);
            const result = await withRetry(async () => {
                return await redisClient.expire(key, seconds);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: result ? `Expiration set for key: ${key}` : `Key not found: ${key}`,
                    },
                ],
            };
        }
        else if (name === "ttl") {
            const { key } = TtlArgumentsSchema.parse(args);
            const ttl = await withRetry(async () => {
                return await redisClient.ttl(key);
            });
            if (ttl === -2) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Key not found: ${key}`,
                        },
                    ],
                };
            }
            else if (ttl === -1) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Key exists but has no expiration: ${key}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `Time to live: ${ttl} seconds`,
                    },
                ],
            };
        }
        // Increment/Decrement operations
        else if (name === "incr") {
            const { key } = IncrArgumentsSchema.parse(args);
            const newValue = await withRetry(async () => {
                return await redisClient.incr(key);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Incremented key: ${key}, new value: ${newValue}`,
                    },
                ],
            };
        }
        else if (name === "incrby") {
            const { key, increment } = IncrByArgumentsSchema.parse(args);
            const newValue = await withRetry(async () => {
                return await redisClient.incrBy(key, increment);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Incremented key: ${key} by ${increment}, new value: ${newValue}`,
                    },
                ],
            };
        }
        else if (name === "decr") {
            const { key } = DecrArgumentsSchema.parse(args);
            const newValue = await withRetry(async () => {
                return await redisClient.decr(key);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Decremented key: ${key}, new value: ${newValue}`,
                    },
                ],
            };
        }
        else if (name === "decrby") {
            const { key, decrement } = DecrByArgumentsSchema.parse(args);
            const newValue = await withRetry(async () => {
                return await redisClient.decrBy(key, decrement);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Decremented key: ${key} by ${decrement}, new value: ${newValue}`,
                    },
                ],
            };
        }
        // Multi-key operations
        else if (name === "mget") {
            const { keys } = MGetArgumentsSchema.parse(args);
            const values = await withRetry(async () => {
                return await redisClient.mGet(keys);
            });
            const result = {};
            keys.forEach((key, index) => {
                result[key] = values[index];
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        else if (name === "mset") {
            const { keyValues } = MSetArgumentsSchema.parse(args);
            const keyValueArray = [];
            keyValues.forEach(({ key, value }) => {
                keyValueArray.push(key, value);
            });
            await withRetry(async () => {
                await redisClient.mSet(keyValueArray);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully set ${keyValues.length} key(s)`,
                    },
                ],
            };
        }
        // Hash operations
        else if (name === "hset") {
            const { key, field, value } = HSetArgumentsSchema.parse(args);
            await withRetry(async () => {
                await redisClient.hSet(key, field, value);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully set field '${field}' in hash: ${key}`,
                    },
                ],
            };
        }
        else if (name === "hmset") {
            const { key, fieldValues } = HMSetArgumentsSchema.parse(args);
            const fieldValueObj = {};
            fieldValues.forEach(({ field, value }) => {
                fieldValueObj[field] = value;
            });
            await withRetry(async () => {
                await redisClient.hSet(key, fieldValueObj);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully set ${fieldValues.length} field(s) in hash: ${key}`,
                    },
                ],
            };
        }
        else if (name === "hget") {
            const { key, field } = HGetArgumentsSchema.parse(args);
            const value = await withRetry(async () => {
                return await redisClient.hGet(key, field);
            });
            if (value === null) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Field '${field}' not found in hash: ${key}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: value,
                    },
                ],
            };
        }
        else if (name === "hmget") {
            const { key, fields } = HMGetArgumentsSchema.parse(args);
            const values = await withRetry(async () => {
                return await redisClient.hmGet(key, fields);
            });
            const result = {};
            fields.forEach((field, index) => {
                result[field] = values[index];
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        else if (name === "hdel") {
            const { key, field } = HDelArgumentsSchema.parse(args);
            let deletedCount;
            if (Array.isArray(field)) {
                deletedCount = await withRetry(async () => {
                    return await redisClient.hDel(key, ...field);
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully deleted ${deletedCount} field(s) from hash: ${key}`,
                        },
                    ],
                };
            }
            else {
                deletedCount = await withRetry(async () => {
                    return await redisClient.hDel(key, field);
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: deletedCount ? `Successfully deleted field '${field}' from hash: ${key}` : `Field '${field}' not found in hash: ${key}`,
                        },
                    ],
                };
            }
        }
        else if (name === "hgetall") {
            const { key } = HGetAllArgumentsSchema.parse(args);
            const hashData = await withRetry(async () => {
                return await redisClient.hGetAll(key);
            });
            if (Object.keys(hashData).length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Hash not found or empty: ${key}`,
                        },
                    ],
                };
            }
            const formattedData = JSON.stringify(hashData, null, 2);
            return {
                content: [
                    {
                        type: "text",
                        text: formattedData,
                    },
                ],
            };
        }
        else if (name === "hexists") {
            const { key, field } = HExistsArgumentsSchema.parse(args);
            const exists = await withRetry(async () => {
                return await redisClient.hExists(key, field);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: exists ? `Field '${field}' exists in hash: ${key}` : `Field '${field}' does not exist in hash: ${key}`,
                    },
                ],
            };
        }
        else if (name === "hincrby") {
            const { key, field, increment } = HIncrByArgumentsSchema.parse(args);
            const newValue = await withRetry(async () => {
                return await redisClient.hIncrBy(key, field, increment);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Incremented field '${field}' in hash: ${key} by ${increment}, new value: ${newValue}`,
                    },
                ],
            };
        }
        else if (name === "hkeys") {
            const { key } = HKeysArgumentsSchema.parse(args);
            const fields = await withRetry(async () => {
                return await redisClient.hKeys(key);
            });
            if (fields.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Hash not found or empty: ${key}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `Fields in hash ${key}:\n${fields.join('\n')}`,
                    },
                ],
            };
        }
        else if (name === "hvals") {
            const { key } = HValsArgumentsSchema.parse(args);
            const values = await withRetry(async () => {
                return await redisClient.hVals(key);
            });
            if (values.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Hash not found or empty: ${key}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `Values in hash ${key}:\n${values.join('\n')}`,
                    },
                ],
            };
        }
        else if (name === "hlen") {
            const { key } = HLenArgumentsSchema.parse(args);
            const length = await withRetry(async () => {
                return await redisClient.hLen(key);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Number of fields in hash ${key}: ${length}`,
                    },
                ],
            };
        }
        // List operations
        else if (name === "lpush") {
            const { key, value } = LPushArgumentsSchema.parse(args);
            const listLength = await withRetry(async () => {
                if (Array.isArray(value)) {
                    return await redisClient.lPush(key, value);
                }
                else {
                    return await redisClient.lPush(key, [value]);
                }
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully pushed to list: ${key}, new length: ${listLength}`,
                    },
                ],
            };
        }
        else if (name === "rpush") {
            const { key, value } = RPushArgumentsSchema.parse(args);
            const listLength = await withRetry(async () => {
                if (Array.isArray(value)) {
                    return await redisClient.rPush(key, value);
                }
                else {
                    return await redisClient.rPush(key, [value]);
                }
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully pushed to list: ${key}, new length: ${listLength}`,
                    },
                ],
            };
        }
        else if (name === "lpop") {
            const { key, count } = LPopArgumentsSchema.parse(args);
            const result = await withRetry(async () => {
                if (count !== undefined) {
                    return await redisClient.lPopCount(key, count);
                }
                else {
                    return await redisClient.lPop(key);
                }
            });
            if (result === null) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `List empty or not found: ${key}`,
                        },
                    ],
                };
            }
            if (Array.isArray(result)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Popped ${result.length} elements:\n${result.join('\n')}`,
                        },
                    ],
                };
            }
            else {
                return {
                    content: [
                        {
                            type: "text",
                            text: result,
                        },
                    ],
                };
            }
        }
        else if (name === "rpop") {
            const { key, count } = RPopArgumentsSchema.parse(args);
            const result = await withRetry(async () => {
                if (count !== undefined) {
                    return await redisClient.rPopCount(key, count);
                }
                else {
                    return await redisClient.rPop(key);
                }
            });
            if (result === null) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `List empty or not found: ${key}`,
                        },
                    ],
                };
            }
            if (Array.isArray(result)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Popped ${result.length} elements:\n${result.join('\n')}`,
                        },
                    ],
                };
            }
            else {
                return {
                    content: [
                        {
                            type: "text",
                            text: result,
                        },
                    ],
                };
            }
        }
        else if (name === "lrange") {
            const { key, start, stop } = LRangeArgumentsSchema.parse(args);
            const elements = await withRetry(async () => {
                return await redisClient.lRange(key, start, stop);
            });
            if (elements.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No elements found in range or list not found: ${key}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `Elements in range [${start}, ${stop}]:\n${elements.join('\n')}`,
                    },
                ],
            };
        }
        else if (name === "llen") {
            const { key } = LLenArgumentsSchema.parse(args);
            const length = await withRetry(async () => {
                return await redisClient.lLen(key);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Length of list ${key}: ${length}`,
                    },
                ],
            };
        }
        else if (name === "lset") {
            const { key, index, value } = LSetArgumentsSchema.parse(args);
            try {
                await withRetry(async () => {
                    await redisClient.lSet(key, index, value);
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully set element at index ${index} in list: ${key}`,
                        },
                    ],
                };
            }
            catch (e) {
                const error = e;
                if (error.message.includes("index out of range") || error.message.includes("no such key")) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error: Either list ${key} does not exist or index ${index} is out of range`,
                            },
                        ],
                    };
                }
                throw error;
            }
        }
        else if (name === "lrem") {
            const { key, count, value } = LRemArgumentsSchema.parse(args);
            const removedCount = await withRetry(async () => {
                return await redisClient.lRem(key, count, value);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Removed ${removedCount} occurrences of '${value}' from list: ${key}`,
                    },
                ],
            };
        }
        // Set operations
        else if (name === "sadd") {
            const { key, member } = SAddArgumentsSchema.parse(args);
            const addedCount = await withRetry(async () => {
                if (Array.isArray(member)) {
                    return await redisClient.sAdd(key, member);
                }
                else {
                    return await redisClient.sAdd(key, [member]);
                }
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Added ${addedCount} new member(s) to set: ${key}`,
                    },
                ],
            };
        }
        else if (name === "srem") {
            const { key, member } = SRemArgumentsSchema.parse(args);
            const removedCount = await withRetry(async () => {
                if (Array.isArray(member)) {
                    return await redisClient.sRem(key, member);
                }
                else {
                    return await redisClient.sRem(key, [member]);
                }
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Removed ${removedCount} member(s) from set: ${key}`,
                    },
                ],
            };
        }
        else if (name === "smembers") {
            const { key } = SMembersArgumentsSchema.parse(args);
            const members = await withRetry(async () => {
                return await redisClient.sMembers(key);
            });
            if (members.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set empty or not found: ${key}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `Members in set ${key}:\n${members.join('\n')}`,
                    },
                ],
            };
        }
        else if (name === "sismember") {
            const { key, member } = SIsMemberArgumentsSchema.parse(args);
            const isMember = await withRetry(async () => {
                return await redisClient.sIsMember(key, member);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: isMember ? `'${member}' is a member of set: ${key}` : `'${member}' is not a member of set: ${key}`,
                    },
                ],
            };
        }
        else if (name === "scard") {
            const { key } = SCardArgumentsSchema.parse(args);
            const count = await withRetry(async () => {
                return await redisClient.sCard(key);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Number of members in set ${key}: ${count}`,
                    },
                ],
            };
        }
        else if (name === "sinter") {
            const { keys } = SInterArgumentsSchema.parse(args);
            const intersection = await withRetry(async () => {
                return await redisClient.sInter(keys);
            });
            if (intersection.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No common members found in the intersection of sets: ${keys.join(', ')}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `Common members in sets [${keys.join(', ')}]:\n${intersection.join('\n')}`,
                    },
                ],
            };
        }
        else if (name === "sunion") {
            const { keys } = SUnionArgumentsSchema.parse(args);
            const union = await withRetry(async () => {
                return await redisClient.sUnion(keys);
            });
            if (union.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `All sets are empty or not found: ${keys.join(', ')}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `All members in sets [${keys.join(', ')}]:\n${union.join('\n')}`,
                    },
                ],
            };
        }
        else if (name === "sdiff") {
            const { keys } = SDiffArgumentsSchema.parse(args);
            const difference = await withRetry(async () => {
                return await redisClient.sDiff(keys);
            });
            if (difference.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No difference found between sets: ${keys.join(', ')}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `Members in ${keys[0]} that are not in other sets:\n${difference.join('\n')}`,
                    },
                ],
            };
        }
        // Sorted set operations
        else if (name === "zadd") {
            const { key, members } = ZAddArgumentsSchema.parse(args);
            const scoreMembers = members.map(({ score, member }) => ({
                score,
                value: member
            }));
            const addedCount = await withRetry(async () => {
                return await redisClient.zAdd(key, scoreMembers);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Added ${addedCount} new member(s) to sorted set: ${key}`,
                    },
                ],
            };
        }
        else if (name === "zrem") {
            const { key, member } = ZRemArgumentsSchema.parse(args);
            const removedCount = await withRetry(async () => {
                if (Array.isArray(member)) {
                    return await redisClient.zRem(key, member);
                }
                else {
                    return await redisClient.zRem(key, [member]);
                }
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Removed ${removedCount} member(s) from sorted set: ${key}`,
                    },
                ],
            };
        }
        else if (name === "zrange") {
            const { key, min, max, withScores } = ZRangeArgumentsSchema.parse(args);
            const options = {};
            if (withScores) {
                options.WITHSCORES = true;
            }
            const result = await withRetry(async () => {
                return await redisClient.zRange(key, min, max, options);
            });
            if (result.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No members found in range or sorted set not found: ${key}`,
                        },
                    ],
                };
            }
            if (withScores) {
                // Convert array to object with score-member pairs
                const formattedResult = {};
                for (let i = 0; i < result.length; i += 2) {
                    const member = result[i];
                    const score = result[i + 1];
                    formattedResult[member] = parseFloat(score);
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(formattedResult, null, 2),
                        },
                    ],
                };
            }
            else {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Members in range [${min}, ${max}]:\n${result.join('\n')}`,
                        },
                    ],
                };
            }
        }
        else if (name === "zrangebyscore") {
            const { key, min, max, withScores } = ZRangeByScoreArgumentsSchema.parse(args);
            const options = {};
            if (withScores) {
                options.WITHSCORES = true;
            }
            const result = await withRetry(async () => {
                return await redisClient.zRangeByScore(key, min, max, options);
            });
            if (result.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No members found in score range or sorted set not found: ${key}`,
                        },
                    ],
                };
            }
            if (withScores) {
                // Convert array to object with score-member pairs
                const formattedResult = {};
                for (let i = 0; i < result.length; i += 2) {
                    const member = result[i];
                    const score = result[i + 1];
                    formattedResult[member] = parseFloat(score);
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(formattedResult, null, 2),
                        },
                    ],
                };
            }
            else {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Members with scores between ${min} and ${max}:\n${result.join('\n')}`,
                        },
                    ],
                };
            }
        }
        else if (name === "zrank") {
            const { key, member } = ZRankArgumentsSchema.parse(args);
            const rank = await withRetry(async () => {
                return await redisClient.zRank(key, member);
            });
            if (rank === null) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Member '${member}' not found in sorted set: ${key}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `Rank of '${member}' in sorted set ${key}: ${rank}`,
                    },
                ],
            };
        }
        else if (name === "zscore") {
            const { key, member } = ZScoreArgumentsSchema.parse(args);
            const score = await withRetry(async () => {
                return await redisClient.zScore(key, member);
            });
            if (score === null) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Member '${member}' not found in sorted set: ${key}`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `Score of '${member}' in sorted set ${key}: ${score}`,
                    },
                ],
            };
        }
        else if (name === "zcard") {
            const { key } = ZCardArgumentsSchema.parse(args);
            const count = await withRetry(async () => {
                return await redisClient.zCard(key);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Number of members in sorted set ${key}: ${count}`,
                    },
                ],
            };
        }
        else if (name === "zcount") {
            const { key, min, max } = ZCountArgumentsSchema.parse(args);
            const count = await withRetry(async () => {
                return await redisClient.zCount(key, min, max);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Number of members with scores between ${min} and ${max} in sorted set ${key}: ${count}`,
                    },
                ],
            };
        }
        // Pub/Sub operations
        else if (name === "publish") {
            const { channel, message } = PublishArgumentsSchema.parse(args);
            const subscriberCount = await withRetry(async () => {
                return await redisClient.publish(channel, message);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Message published to channel: ${channel}, received by ${subscriberCount} subscriber(s)`,
                    },
                ],
            };
        }
        // Streams operations
        else if (name === "xadd") {
            const { key, id, fields } = XAddArgumentsSchema.parse(args);
            const fieldsObject = {};
            fields.forEach(({ name, value }) => {
                fieldsObject[name] = value;
            });
            const entryId = await withRetry(async () => {
                return await redisClient.xAdd(key, id, fieldsObject);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Entry added to stream: ${key}, ID: ${entryId}`,
                    },
                ],
            };
        }
        else if (name === "xrange") {
            const { key, start, end, count } = XRangeArgumentsSchema.parse(args);
            const rangeOptions = count ? { COUNT: count } : undefined;
            const entries = await withRetry(async () => {
                return await redisClient.xRange(key, start, end, rangeOptions);
            });
            if (entries.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No entries found in range or stream not found: ${key}`,
                        },
                    ],
                };
            }
            const formattedEntries = entries.map((entry) => {
                return {
                    id: entry.id,
                    fields: entry.message
                };
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(formattedEntries, null, 2),
                    },
                ],
            };
        }
        else if (name === "xread") {
            const { streams, count, block } = XReadArgumentsSchema.parse(args);
            const streamEntries = {};
            streams.forEach(({ key, id }) => {
                streamEntries[key] = id;
            });
            const xreadOptions = {};
            if (count !== undefined) {
                xreadOptions.COUNT = count;
            }
            if (block !== undefined) {
                xreadOptions.BLOCK = block;
            }
            const result = await withRetry(async () => {
                // The Redis library API might be different, this is a type workaround
                return await redisClient.xRead(xreadOptions, streamEntries);
            });
            if (!result || result.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No new entries found in streams: ${streams.map(s => s.key).join(', ')}`,
                        },
                    ],
                };
            }
            const formattedResults = {};
            result.forEach((stream) => {
                const streamName = stream.name;
                formattedResults[streamName] = stream.messages.map((msg) => ({
                    id: msg.id,
                    fields: msg.message
                }));
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(formattedResults, null, 2),
                    },
                ],
            };
        }
        // JSON operations
        else if (name === "json_set") {
            const { key, path, json } = JsonSetArgumentsSchema.parse(args);
            try {
                await withRetry(async () => {
                    // Type workaround for RedisJSON module
                    await redisClient.json.set(key, path, json);
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully set JSON at key: ${key}, path: ${path}`,
                        },
                    ],
                };
            }
            catch (e) {
                const error = e;
                if (error.message.includes("unknown command")) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Error: RedisJSON module is not loaded on the server. This feature requires RedisJSON.",
                            },
                        ],
                    };
                }
                throw error;
            }
        }
        else if (name === "json_get") {
            const { key, path } = JsonGetArgumentsSchema.parse(args);
            try {
                const result = await withRetry(async () => {
                    // Type workaround for RedisJSON module
                    return await redisClient.json.get(key, { path });
                });
                if (result === null) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `JSON not found at key: ${key}, path: ${path}`,
                            },
                        ],
                    };
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            catch (e) {
                const error = e;
                if (error.message.includes("unknown command")) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Error: RedisJSON module is not loaded on the server. This feature requires RedisJSON.",
                            },
                        ],
                    };
                }
                throw error;
            }
        }
        else if (name === "json_type") {
            const { key, path } = JsonTypeArgumentsSchema.parse(args);
            try {
                const type = await withRetry(async () => {
                    // Type workaround for RedisJSON module
                    return await redisClient.json.type(key, path);
                });
                if (type === null) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `JSON not found at key: ${key}, path: ${path}`,
                            },
                        ],
                    };
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: `Type of JSON at key: ${key}, path: ${path} is: ${type}`,
                        },
                    ],
                };
            }
            catch (e) {
                const error = e;
                if (error.message.includes("unknown command")) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Error: RedisJSON module is not loaded on the server. This feature requires RedisJSON.",
                            },
                        ],
                    };
                }
                throw error;
            }
        }
        else if (name === "json_arrappend") {
            const { key, path, value } = JsonArrAppendArgumentsSchema.parse(args);
            try {
                const newLength = await withRetry(async () => {
                    // Type workaround for RedisJSON module
                    return await redisClient.json.arrAppend(key, path, value);
                });
                if (newLength === null) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Array not found at key: ${key}, path: ${path}`,
                            },
                        ],
                    };
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully appended to array, new length: ${newLength}`,
                        },
                    ],
                };
            }
            catch (e) {
                const error = e;
                if (error.message.includes("unknown command")) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Error: RedisJSON module is not loaded on the server. This feature requires RedisJSON.",
                            },
                        ],
                    };
                }
                throw error;
            }
        }
        // Transaction support
        else if (name === "transaction") {
            const { commands } = TransactionArgumentsSchema.parse(args);
            try {
                const multi = redisClient.multi();
                commands.forEach(({ command, args: cmdArgs }) => {
                    const methodName = command.toLowerCase();
                    if (typeof multi[methodName] !== "function") {
                        throw new Error(`Unknown command: ${command}`);
                    }
                    multi[methodName](...cmdArgs);
                });
                const results = await withRetry(async () => {
                    return await multi.exec();
                });
                // Format results
                const formattedResults = {};
                commands.forEach(({ command }, index) => {
                    formattedResults[`${index + 1}: ${command}`] = results[index];
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Transaction completed with ${commands.length} command(s):\n${JSON.stringify(formattedResults, null, 2)}`,
                        },
                    ],
                };
            }
            catch (e) {
                const error = e;
                return {
                    content: [
                        {
                            type: "text",
                            text: `Transaction failed: ${error.message}`,
                        },
                    ],
                };
            }
        }
        // Monitoring and management
        else if (name === "info") {
            const { section } = InfoArgumentsSchema.parse(args);
            const info = await withRetry(async () => {
                return await redisClient.info(section);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: info,
                    },
                ],
            };
        }
        else if (name === "select") {
            const { db } = SelectArgumentsSchema.parse(args);
            await withRetry(async () => {
                await redisClient.select(db);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully selected database: ${db}`,
                    },
                ],
            };
        }
        else if (name === "flushdb") {
            const { async } = FlushDbArgumentsSchema.parse(args);
            await withRetry(async () => {
                if (async) {
                    await redisClient.flushDb(RedisFlushModes.ASYNC);
                }
                else {
                    await redisClient.flushDb();
                }
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully flushed current database (async: ${async})`,
                    },
                ],
            };
        }
        // Testing tools
        else if (name === "ping") {
            const { message } = PingArgumentsSchema.parse(args);
            const response = await withRetry(async () => {
                return await redisClient.ping(message);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: message ? response : "PONG",
                    },
                ],
            };
        }
        else if (name === "echo") {
            const { message } = EchoArgumentsSchema.parse(args);
            const response = await withRetry(async () => {
                return await redisClient.echo(message);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: response,
                    },
                ],
            };
        }
        else if (name === "list") {
            const { pattern } = ListArgumentsSchema.parse(args);
            const keys = await redisClient.keys(pattern);
            return {
                content: [
                    {
                        type: "text",
                        text: keys.length > 0
                            ? `Found keys:\n${keys.join('\n')}`
                            : "No keys found matching pattern",
                    },
                ],
            };
        }
        else {
            throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${formatError(error)}`,
                },
            ],
        };
    }
});
// Start the server
async function main() {
    try {
        // Connect to Redis
        redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err.message);
            // Don't exit the process on every Redis error
            // Only log the error and allow reconnection
        });
        console.error(`Attempting to connect to Redis at ${REDIS_URL}...`);
        await redisClient.connect();
        console.error(`Connected to Redis successfully at ${REDIS_URL}`);
        // Set up graceful shutdown
        const closeGracefully = async () => {
            console.error('Shutting down gracefully...');
            try {
                await redisClient.quit();
                console.error('Redis connection closed.');
                process.exit(0);
            }
            catch (err) {
                console.error('Error during shutdown:', err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        };
        // Listen for termination signals
        process.on('SIGINT', closeGracefully);
        process.on('SIGTERM', closeGracefully);
        process.on('SIGHUP', closeGracefully);
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("Redis MCP Server running on stdio");
    }
    catch (error) {
        console.error("Error during startup:", error instanceof Error ? error.message : String(error));
        try {
            await redisClient.quit();
        }
        catch (err) {
            // Ignore error during quit
        }
        process.exit(1);
    }
}
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error instanceof Error ? error.message : String(error));
    // Don't exit the process on unhandled rejection
    // Just log the error and continue
});
main().catch((error) => {
    console.error("Fatal error in main():", error instanceof Error ? error.message : String(error));
    redisClient.quit().finally(() => process.exit(1));
});
