# Redis MCP Server (@gongrzhe/server-redis-mcp@1.0.0)

![](https://badge.mcpx.dev?type=server 'MCP Server')
[![smithery badge](https://smithery.ai/badge/@gongrzhe/server-redis-mcp)](https://smithery.ai/server/@gongrzhe/server-redis-mcp)

A Redis Model Context Protocol (MCP) server implementation for interacting with Redis databases. This server enables LLMs to interact with Redis key-value stores through a set of standardized tools.

## Installation & Usage

### Installing via Smithery

To install Redis MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@gongrzhe/server-redis-mcp):

```bash
npx -y @smithery/cli install @gongrzhe/server-redis-mcp --client claude
```

### Installing Manually
```bash
# Using npx with specific version (recommended)
npx @gongrzhe/server-redis-mcp@1.0.0 redis://your-redis-host:port

# Example:
npx @gongrzhe/server-redis-mcp@1.0.0 redis://localhost:6379
```

Or install globally:

```bash
# Install specific version globally
npm install -g @gongrzhe/server-redis-mcp@1.0.0

# Run after global installation
@gongrzhe/server-redis-mcp redis://your-redis-host:port
```

## Components

### Tools

- **set**
  - Set a Redis key-value pair with optional expiration
  - Input:
    - `key` (string): Redis key
    - `value` (string): Value to store
    - `expireSeconds` (number, optional): Expiration time in seconds

- **get**
  - Get value by key from Redis
  - Input: `key` (string): Redis key to retrieve

- **delete**
  - Delete one or more keys from Redis
  - Input: `key` (string | string[]): Key or array of keys to delete

- **list**
  - List Redis keys matching a pattern
  - Input: `pattern` (string, optional): Pattern to match keys (default: *)

## Configuration

### Usage with Claude Desktop

To use this server with the Claude Desktop app, add the following configuration to the "mcpServers" section of your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "redis": {
      "command": "npx",
      "args": [
        "@gongrzhe/server-redis-mcp@1.0.0",
        "redis://localhost:6379"
      ]
    }
  }
}
```

Alternatively, you can use the node command directly if you have the package installed:

```json
{
  "mcpServers": {
    "redis": {
      "command": "node",
      "args": [
        "path/to/build/index.js",
        "redis://10.1.210.223:6379"
      ]
    }
  }
}
```

### Docker Usage

When using Docker:
* For macOS, use `host.docker.internal` if the Redis server is running on the host network
* Redis URL can be specified as an argument, defaults to "redis://localhost:6379"

```json
{
  "mcpServers": {
    "redis": {
      "command": "docker",
      "args": [
        "run", 
        "-i", 
        "--rm", 
        "mcp/redis", 
        "redis://host.docker.internal:6379"
      ]
    }
  }
}
```

## Development

### Building from Source

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

### Docker Build

```bash
docker build -t mcp/redis .
```

## License

This MCP server is licensed under the ISC License. For more details, please see the LICENSE file in the project repository.
