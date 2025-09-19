# Documentation Generator MCP Communication Protocol

This document describes the communication protocol between the Documentation Generator VS Code extension and the MCP server.

## Overview

The Documentation Generator uses the Model Context Protocol (MCP) for communication between the VS Code extension and a standalone Node.js server. This enables:

- Real-time resource sharing with Claude Code Pro
- Centralized project analysis and caching
- Template management and synchronization
- Generation history tracking
- Cross-session persistence

## Protocol Stack

```
┌─────────────────────────┐
│    Claude Code Pro      │
├─────────────────────────┤
│    VS Code Extension    │
├─────────────────────────┤
│      MCP Client         │
├─────────────────────────┤
│    JSON-RPC over stdio  │
├─────────────────────────┤
│      MCP Server         │
├─────────────────────────┤
│   Resource Providers    │
└─────────────────────────┘
```

## Connection Flow

1. **Extension Activation**: VS Code extension starts MCP client
2. **Server Launch**: Client spawns MCP server process via Node.js
3. **Initialization**: Client sends `initialize` request with capabilities
4. **Resource Discovery**: Client lists available resources
5. **Normal Operation**: Resource reads, tool calls, and notifications
6. **Graceful Shutdown**: Client stops server on extension deactivation

## Message Format

All messages follow the JSON-RPC 2.0 specification over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "method": "method_name",
  "params": { ... }
}
```

## Initialization

### Client → Server

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "resources": true
    },
    "clientInfo": {
      "name": "Documentation Generator",
      "version": "1.0.0"
    }
  }
}
```

### Server → Client

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "resources": {},
      "tools": {}
    },
    "serverInfo": {
      "name": "documentation-generator",
      "version": "1.0.0"
    }
  }
}
```

## Resource Protocol

### Listing Resources

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/list"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "resources": [
      {
        "uri": "folder-context://path%2Fto%2Fproject",
        "name": "Project Context",
        "description": "Complete project analysis",
        "mimeType": "application/json"
      }
    ]
  }
}
```

### Reading Resources

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/read",
  "params": {
    "uri": "folder-context://path%2Fto%2Fproject"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "contents": [
      {
        "uri": "folder-context://path%2Fto%2Fproject",
        "mimeType": "application/json",
        "text": "{ \"projectName\": \"example\", ... }"
      }
    ]
  }
}
```

## Tool Protocol

### Available Tools

#### 1. analyze_folder

Analyzes a folder structure and extracts project context.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "analyze_folder",
    "arguments": {
      "folderPath": "/path/to/project",
      "excludePatterns": ["node_modules", ".git"]
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Folder analysis completed for: /path/to/project\n\nAnalysis Summary:\n{...}"
      }
    ]
  }
}
```

#### 2. update_folder_context

Updates cached folder context data.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "update_folder_context",
    "arguments": {
      "folderPath": "/path/to/project",
      "context": { ... }
    }
  }
}
```

#### 3. add_template

Adds or updates a documentation template.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "add_template",
    "arguments": {
      "templateId": "custom-api-docs",
      "template": {
        "id": "custom-api-docs",
        "metadata": { ... },
        "content": "# API Documentation\n..."
      }
    }
  }
}
```

#### 4. record_generation

Records a documentation generation event.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "record_generation",
    "arguments": {
      "record": {
        "id": "gen_123",
        "templateId": "api-docs",
        "projectPath": "/path/to/project",
        "success": true,
        "timestamp": "2024-01-01T00:00:00Z"
      }
    }
  }
}
```

## Resource Types

### 1. Folder Context Resources

- **URI Pattern**: `folder-context://<encoded-path>`
- **Content**: Complete project analysis including file structure, dependencies, and code patterns
- **MIME Type**: `application/json`

### 2. File Content Resources

- **URI Pattern**: `file-content://<encoded-folder>/<encoded-file>`
- **Content**: Individual file contents from analyzed projects
- **MIME Type**: Based on file extension

### 3. Template Resources

- **URI Pattern**: `template://<template-id>`
- **Content**: Template markdown content
- **MIME Type**: `text/markdown`

### 4. Template Metadata Resources

- **URI Pattern**: `template-metadata://<template-id>`
- **Content**: Template configuration and variables
- **MIME Type**: `application/json`

### 5. Configuration Resources

- **URI Pattern**: `config://current`, `config://default`, `config://schema`
- **Content**: Server configuration data
- **MIME Type**: `application/json`

### 6. Generation History Resources

- **URI Pattern**: `generation://<generation-id>`, `generation://summary`
- **Content**: Documentation generation records and metrics
- **MIME Type**: `application/json`

### 7. Project Metadata Resources

- **URI Pattern**: `project-metadata://<encoded-workspace>`
- **Content**: Comprehensive workspace analysis
- **MIME Type**: `application/json`

## Error Handling

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "details": "Additional error information"
    }
  }
}
```

### Common Error Codes

- `-32700`: Parse error (Invalid JSON)
- `-32600`: Invalid Request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32000`: Server error (Resource not found)
- `-32001`: Server error (Provider error)
- `-32002`: Server error (Cache error)

### Retry Strategy

The client implements automatic retry with exponential backoff:

1. **Initial Failure**: Retry immediately
2. **Second Failure**: Wait 1 second, retry
3. **Third Failure**: Wait 2 seconds, retry
4. **Final Failure**: Wait 4 seconds, give up

### Reconnection Logic

If the server process exits unexpectedly:

1. Client detects process exit
2. Attempts reconnection up to 3 times
3. Uses exponential backoff (1s, 2s, 4s)
4. Emits reconnection events for UI feedback
5. Falls back to local providers if reconnection fails

## Event Broadcasting

The extension uses an internal event system for real-time updates:

### Folder Selection Events

```typescript
interface FolderSelectionEvent {
  folderPath: string;
  workspaceName: string;
  timestamp: Date;
  selectionSource: 'contextMenu' | 'sidebar' | 'command' | 'api';
}
```

### Template Selection Events

```typescript
interface TemplateSelectionEvent {
  templateId: string;
  templateName: string;
  category: string;
  timestamp: Date;
  selectionSource: 'ui' | 'api' | 'default';
}
```

### Resource Update Events

```typescript
interface ResourceUpdateEvent {
  resourceType: string;
  resourceUri?: string;
  action: 'created' | 'updated' | 'deleted' | 'refreshed';
  timestamp: Date;
  source: string;
}
```

## Caching Strategy

### Resource Cache

- **TTL**: 5 minutes for resource content
- **Size**: Maximum 1000 entries
- **Persistence**: Disk-backed for folder analysis
- **Invalidation**: Manual and automatic on changes

### List Cache

- **TTL**: 2 minutes for resource lists
- **Size**: Maximum 100 entries
- **Persistence**: Memory only
- **Invalidation**: On any resource change

### Cache Keys

- Folder contexts: `folder-context:<path>`
- Templates: `template:<id>`
- Configurations: `config:<type>`
- Project metadata: `project-metadata:<workspace>`

## Performance Considerations

### Resource Loading

- Lazy loading of resource content
- Cached responses for repeated requests
- Parallel processing where possible
- Streaming for large responses

### Memory Management

- Automatic cache cleanup
- Configurable cache limits
- Memory usage monitoring
- Graceful degradation under pressure

### Network Optimization

- Request batching where possible
- Compression for large payloads
- Connection pooling
- Request deduplication

## Security Considerations

### File System Access

- Configurable exclusion patterns
- Path traversal protection
- Permission checking
- Safe file reading

### Resource Isolation

- URI validation
- Provider sandboxing
- Error containment
- Resource limits

## Monitoring and Debugging

### Logging Levels

- **ERROR**: Critical failures
- **WARN**: Recoverable issues
- **INFO**: Important events
- **DEBUG**: Detailed tracing (when enabled)

### Metrics Collection

- Request/response times
- Cache hit/miss ratios
- Error rates by type
- Resource usage statistics

### Debug Tools

- Protocol message logging
- Cache inspection
- Resource provider status
- Connection state monitoring

## Future Extensions

The protocol is designed to be extensible for future features:

- Streaming resource updates
- Batch operations
- Webhook notifications
- Plugin architecture
- Multi-tenant support