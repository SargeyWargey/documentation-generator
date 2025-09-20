# Claude Code Integration Requirements

This document details the requirements, setup, and configuration for integrating the Documentation Generator extension with Claude Code Pro.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Integration Methods](#integration-methods)
4. [Slash Commands Integration](#slash-commands-integration)
5. [MCP Server Integration](#mcp-server-integration)
6. [Configuration](#configuration)
7. [Authentication](#authentication)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Overview

The Documentation Generator extension requires **Claude Code Pro** for AI-powered documentation generation. The extension supports two integration methods:

1. **Slash Commands** (Default): Creates dynamic commands in `.claude/commands/`
2. **MCP Server**: Provides real-time communication via MCP protocol

Both methods enable the extension to leverage Claude Code Pro's AI capabilities for intelligent code analysis and documentation generation.

## Prerequisites

### Required Software

- **Claude Code Pro**: Active subscription required
- **VS Code**: Version 1.104.0 or higher
- **Node.js**: Version 18+ (for MCP server mode)
- **Git**: For project management (recommended)

### Claude Code Pro Verification

Before using the extension, verify Claude Code Pro is working:

1. **Test basic functionality**:
   ```
   /help
   ```

2. **Verify code analysis capabilities**:
   ```
   Analyze this code file and explain what it does
   ```

3. **Check file access**:
   - Claude Code Pro should be able to read project files
   - Verify workspace permissions are granted

### VS Code Configuration

Ensure VS Code is properly configured:

```json
{
  "claude.enabled": true,
  "claude.apiKey": "your-api-key",
  "claude.workspace.autoLoad": true
}
```

## Integration Methods

### Method Comparison

| Feature | Slash Commands | MCP Server |
|---------|---------------|------------|
| **Setup Complexity** | Simple | Moderate |
| **Performance** | Good | Excellent |
| **Real-time Updates** | No | Yes |
| **Resource Sharing** | Limited | Full |
| **Offline Testing** | Limited | Yes |
| **Best For** | Most users | Advanced workflows |

### Choosing Integration Method

**Use Slash Commands when**:
- You want simple setup
- You generate documentation occasionally
- You don't need real-time updates
- You're new to the extension

**Use MCP Server when**:
- You need real-time communication
- You generate documentation frequently
- You want advanced resource sharing
- You're building automated workflows

## Slash Commands Integration

### How It Works

1. **Command Generation**: Extension creates temporary command files
2. **File Placement**: Commands saved to `.claude/commands/`
3. **Automatic Execution**: Claude Code Pro detects and runs commands
4. **Result Processing**: Extension processes generated documentation
5. **Cleanup**: Temporary files are removed after use

### Setup Process

1. **Verify directory structure**:
   ```bash
   mkdir -p .claude/commands
   ```

2. **Check permissions**:
   ```bash
   chmod 755 .claude/commands
   ```

3. **Test command creation**:
   - Right-click any folder
   - Select "Generate Documentation" > "Help Documentation"
   - Check `.claude/commands/` for generated files

### Command File Format

The extension generates command files like this:

```yaml
# .claude/commands/documentation-generator-help-20240120-143052.md
name: generate-help-docs
description: Generate help documentation for selected folder

# Context
Analyze the folder at: /path/to/selected/folder

# Analysis Required
- File structure and organization
- Code patterns and architecture
- API endpoints and functions
- Dependencies and integrations
- Configuration files
- Existing documentation

# Template Variables
- folderName: selected-folder
- folderPath: /path/to/selected/folder
- date: 2024-01-20
- time: 14:30:52

# Generate Documentation
Create comprehensive help documentation following this template:

[Template content with variables]

# Output Instructions
- Save as: help-docs-selected-folder-2024-01-20.md
- Location: In the analyzed folder
- Format: Markdown with proper structure
```

### Configuration Options

```json
{
  "documentation-generator.claudeIntegrationMethod": "slash-commands",
  "documentation-generator.commandCleanupDelay": 30000,
  "documentation-generator.commandTimeout": 120000,
  "documentation-generator.commandDirectory": ".claude/commands"
}
```

## MCP Server Integration

### How It Works

1. **Server Launch**: MCP server starts when extension activates
2. **Protocol Connection**: Uses stdio/TCP for communication
3. **Resource Providers**: Share project context in real-time
4. **Bidirectional Communication**: Extension and Claude communicate directly
5. **Resource Updates**: Context updates automatically as you work

### Setup Process

1. **Install MCP server dependencies**:
   ```bash
   cd extension/mcp-server
   npm install
   ```

2. **Configure Claude Code Pro**:
   ```json
   {
     "mcpServers": {
       "documentation-generator": {
         "command": "node",
         "args": ["/path/to/extension/mcp-server/server.js"],
         "env": {
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```

3. **Test connection**:
   ```bash
   # In VS Code terminal
   node mcp-server/server.js --test
   ```

### MCP Server Architecture

```typescript
// Resource providers available through MCP
interface MCPResourceProviders {
  folderContext: FolderContextProvider;      // Selected folder analysis
  templateLibrary: TemplateProvider;         // Available templates
  projectMetadata: ProjectMetadataProvider;  // Workspace information
  recentGenerations: HistoryProvider;        // Generation history
  configuration: ConfigurationProvider;      // Extension settings
}

// Example resource
interface FolderContextResource {
  uri: string;
  name: string;
  description: string;
  mimeType: "application/json";
  content: {
    path: string;
    structure: FileTreeNode[];
    analysis: CodeAnalysis;
    dependencies: Dependency[];
    metadata: ProjectMetadata;
  };
}
```

### MCP Protocol Messages

```typescript
// Resource discovery
{
  "method": "resources/list",
  "params": {}
}

// Resource content
{
  "method": "resources/read",
  "params": {
    "uri": "folder-context://current-selection"
  }
}

// Tool execution
{
  "method": "tools/call",
  "params": {
    "name": "generate-documentation",
    "arguments": {
      "folderPath": "/path/to/folder",
      "template": "help-docs",
      "variables": {}
    }
  }
}
```

### Configuration Options

```json
{
  "documentation-generator.claudeIntegrationMethod": "mcp-server",
  "documentation-generator.mcpServerPort": 3000,
  "documentation-generator.mcpServerHost": "localhost",
  "documentation-generator.mcpServerTimeout": 30000,
  "documentation-generator.mcpResourceCaching": true
}
```

## Configuration

### Extension Settings

Complete configuration reference:

```json
{
  // Integration method
  "documentation-generator.claudeIntegrationMethod": "slash-commands",

  // Template settings
  "documentation-generator.templateDirectory": "",
  "documentation-generator.outputNamePattern": "generated-docs-{template}-{date}",

  // Claude Code integration
  "documentation-generator.commandTimeout": 120000,
  "documentation-generator.commandCleanupDelay": 30000,
  "documentation-generator.mcpServerPort": 3000,
  "documentation-generator.mcpServerHost": "localhost",

  // UI preferences
  "documentation-generator.autoRefreshSidebar": true,
  "documentation-generator.showProgressNotifications": true,

  // Performance
  "documentation-generator.maxAnalysisDepth": 5,
  "documentation-generator.excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/.git/**"
  ],

  // Debug
  "documentation-generator.debugMode": false,
  "documentation-generator.logLevel": "info"
}
```

### Workspace Configuration

For team-specific settings, create `.vscode/settings.json`:

```json
{
  "documentation-generator.templateDirectory": "./docs/templates",
  "documentation-generator.outputNamePattern": "{folder}-{template}",
  "documentation-generator.claudeIntegrationMethod": "mcp-server",
  "documentation-generator.excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    "**/vendor/**"
  ]
}
```

### Claude Code Pro Configuration

#### For Slash Commands

Ensure Claude Code Pro can access:
- Project files (read permissions)
- `.claude/commands/` directory
- Extension-generated command files

#### For MCP Server

Add server configuration to Claude Code Pro:

```json
{
  "mcpServers": {
    "documentation-generator": {
      "command": "node",
      "args": [
        "/path/to/vscode/extensions/documentation-generator/mcp-server/server.js"
      ],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      },
      "timeout": 30000,
      "restart": true
    }
  }
}
```

## Authentication

### Claude Code Pro Authentication

The extension relies on Claude Code Pro's existing authentication:

1. **API Key**: Configured in Claude Code Pro settings
2. **Workspace Access**: Granted through Claude Code Pro permissions
3. **No Additional Auth**: Extension doesn't require separate authentication

### Security Considerations

1. **Local Processing**: All analysis happens locally
2. **No External APIs**: Extension only communicates with Claude Code Pro
3. **File Access**: Limited to VS Code workspace
4. **Temporary Files**: Commands are cleaned up automatically

### Permission Requirements

The extension needs these permissions:

- **File System**: Read project files and write documentation
- **VS Code API**: Access workspace, commands, and UI
- **Claude Code Pro**: Communication via commands or MCP
- **Network**: Only for MCP server mode (localhost)

## Best Practices

### Performance Optimization

1. **Use exclusion patterns**:
   ```json
   {
     "documentation-generator.excludePatterns": [
       "**/node_modules/**",
       "**/dist/**",
       "**/build/**",
       "**/.git/**",
       "**/coverage/**"
     ]
   }
   ```

2. **Limit analysis depth**:
   ```json
   {
     "documentation-generator.maxAnalysisDepth": 3
   }
   ```

3. **Choose appropriate integration method**:
   - Use slash commands for occasional use
   - Use MCP server for frequent generation

### Security Best Practices

1. **Review generated commands** before they execute
2. **Use workspace-specific settings** for team configurations
3. **Keep Claude Code Pro updated** to latest version
4. **Monitor file permissions** on `.claude/commands/`

### Workflow Optimization

1. **Organize templates** in version control
2. **Use meaningful folder names** for better analysis
3. **Include README files** for additional context
4. **Document template variables** clearly

### Team Collaboration

1. **Share template directory**:
   ```json
   {
     "documentation-generator.templateDirectory": "./shared-templates"
   }
   ```

2. **Standardize output patterns**:
   ```json
   {
     "documentation-generator.outputNamePattern": "docs/{folder}-{template}"
   }
   ```

3. **Version control settings**:
   - Include `.vscode/settings.json`
   - Share custom templates
   - Document team conventions

## Troubleshooting

### Common Integration Issues

#### Slash Commands Not Executing

**Symptoms**:
- Commands created but not executed
- No documentation generated
- No errors shown

**Solutions**:
1. **Check Claude Code Pro status**:
   ```bash
   # Verify Claude Code Pro is running
   ps aux | grep claude
   ```

2. **Verify command directory permissions**:
   ```bash
   ls -la .claude/commands/
   chmod 755 .claude/commands/
   ```

3. **Test manual command execution**:
   - Open generated command file
   - Copy content to Claude Code Pro
   - Execute manually

#### MCP Server Connection Failed

**Symptoms**:
- "MCP server not responding" errors
- Timeout errors in VS Code output
- Extension falls back to slash commands

**Solutions**:
1. **Check Node.js installation**:
   ```bash
   node --version  # Should be 18+
   npm --version
   ```

2. **Test MCP server standalone**:
   ```bash
   cd mcp-server
   node server.js --test
   ```

3. **Verify Claude Code Pro MCP configuration**:
   - Check server path is correct
   - Verify environment variables
   - Test with minimal configuration

#### Authentication Errors

**Symptoms**:
- "Claude Code Pro not accessible" errors
- Permission denied errors
- API key errors

**Solutions**:
1. **Verify Claude Code Pro setup**:
   - Check API key configuration
   - Test basic Claude functionality
   - Verify workspace permissions

2. **Check VS Code integration**:
   - Restart VS Code
   - Reload Claude Code Pro
   - Check extension activation

### Debug Mode

Enable comprehensive debugging:

```json
{
  "documentation-generator.debugMode": true,
  "documentation-generator.logLevel": "debug"
}
```

Debug information includes:
- Integration method selection
- Command generation process
- MCP server communication
- Template processing steps
- Error stack traces

### Log Analysis

Check VS Code Output panel for:

```
[INFO] Documentation Generator: Using slash commands integration
[DEBUG] Command created: .claude/commands/doc-gen-20240120-143052.md
[INFO] Waiting for Claude Code Pro execution...
[DEBUG] Command executed successfully
[INFO] Documentation saved to: api-docs-2024-01-20.md
```

### Performance Monitoring

Monitor these metrics:
- Command execution time
- File analysis duration
- Memory usage during generation
- Claude Code Pro response time

---

**Need integration help?** Check the [Troubleshooting Guide](TROUBLESHOOTING.md) or open an issue with your specific configuration details.