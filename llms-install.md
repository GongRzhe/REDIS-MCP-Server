# Redis MCP Installation Guide

This guide will help you install and configure the Redis MCP server for managing Redis database operations.

## Requirements

- Node.js and npm installed
- Access to a Redis instance
- Local configuration directory

## Installation Steps

1. Install the Redis MCP server using one of these methods:

   ```bash
   # Using npx 
   npx @gongrzhe/server-redis-mcp@1.0.0 redis://your-redis-host:port

   # Global installation
   npm install -g @gongrzhe/server-redis-mcp@1.0.0
   ```

2. Configure the MCP server in your settings file:
   - For VSCode Cline: `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
   - For Claude desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or appropriate path for other OS

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

3. After configuration, verify the connection:
   ```
   1. Use list command to check Redis connectivity
   2. Try setting and getting a test key-value pair
   3. Verify proper access permissions
   ```

## Troubleshooting

If you encounter any issues during installation, check for:

1. Connection errors:
   - Verify Redis server is running and accessible
   - Check host and port configuration
   - Confirm network connectivity and firewall settings

2. Permission issues:
   - Verify Redis authentication requirements
   - Check Redis ACL configurations
   - Ensure proper connection string format

3. Configuration problems:
   - Validate JSON syntax in config files
   - Confirm correct file paths and permissions
   - Check Node.js and npm versions

## Security Notes

- Use strong Redis authentication if enabled
- Configure proper network security
- Regularly update Redis MCP server version
- Follow Redis security best practices
- Keep connection strings secure

## Usage

After installation, you can use these tools:
- Set key-value pairs with optional expiration
- Get values by key
- Delete keys (single or multiple)
- List keys matching patterns

## Available Tools

1. set
   - Purpose: Set a Redis key-value pair
   - Parameters:
     - key (string): Redis key
     - value (string): Value to store
     - expireSeconds (number, optional): Expiration time

2. get
   - Purpose: Retrieve value by key
   - Parameters:
     - key (string): Redis key to retrieve

3. delete
   - Purpose: Remove keys from Redis
   - Parameters:
     - key (string or string[]): Key(s) to delete

4. list
   - Purpose: List matching Redis keys
   - Parameters:
     - pattern (string, optional): Match pattern