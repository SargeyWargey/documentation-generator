# Documentation Generator MCP Server

A Model Context Protocol (MCP) server that provides resources and tools for the Documentation Generator VS Code extension.

## Features

- **Folder Analysis**: Analyze project structure and extract context information
- **Template Management**: Manage documentation templates with metadata
- **Configuration**: Centralized configuration management
- **Generation History**: Track and analyze recent documentation generations
- **Project Metadata**: Extract comprehensive project information

## Installation

### Prerequisites

- Node.js 18 or later
- npm

### Quick Install

**Linux/macOS:**
```bash
chmod +x install.sh
./install.sh
```

**Windows:**
```cmd
install.bat
```

### Manual Installation

1. Install dependencies:
```bash
npm install
```

2. Build the TypeScript code:
```bash
npm run build
```

3. Create configuration directory:
```bash
mkdir -p ~/.documentation-generator/templates
```

## Usage

### Starting the Server

```bash
npm start
```

Or directly with Node.js:
```bash
node dist/index.js
```

### Development Mode

```bash
npm run dev
```

## Configuration

The server creates a configuration directory at `~/.documentation-generator/` containing:

- `config.json` - Server configuration
- `templates/` - Custom template directory
- `generations.json` - Generation history

## Resources

The server provides the following resources:

### Folder Context Resources
- `folder-context://<path>` - Complete folder analysis
- `file-content://<path>/<file>` - Individual file content

### Template Resources
- `template://<id>` - Template content
- `template-metadata://<id>` - Template metadata

### Configuration Resources
- `config://current` - Current configuration
- `config://default` - Default configuration
- `config://schema` - Configuration schema

### Generation History Resources
- `generation://summary` - Generation summary
- `generation://<id>` - Individual generation record
- `generation://metrics/daily` - Daily metrics
- `generation://metrics/templates` - Template usage metrics

### Project Metadata Resources
- `project-metadata://<workspace>` - Complete project metadata
- `project-overview://<workspace>` - Project overview
- `project-dependencies://<workspace>` - Dependency analysis

## Tools

The server provides the following tools:

### `analyze_folder`
Analyze a folder structure and extract context information.

**Parameters:**
- `folderPath` (string, required) - Path to the folder to analyze
- `excludePatterns` (array, optional) - Patterns to exclude from analysis

### `update_folder_context`
Update the context for a specific folder.

**Parameters:**
- `folderPath` (string, required) - Path to the folder
- `context` (object, required) - Context data to update

### `add_template`
Add or update a template.

**Parameters:**
- `templateId` (string, required) - Unique identifier for the template
- `template` (object, required) - Template data

### `record_generation`
Record a documentation generation event.

**Parameters:**
- `record` (object, required) - Generation record data

## Integration with Claude Code

Add this server to your Claude Code configuration:

```json
{
  "mcpServers": {
    "documentation-generator": {
      "command": "node",
      "args": ["/path/to/documentation-generator-mcp-server/dist/index.js"]
    }
  }
}
```

## Development

### Project Structure

```
src/
├── index.ts                    # Main server entry point
├── resources/                  # Resource providers
│   ├── ResourceManager.ts      # Resource management
│   ├── FolderAnalysisProvider.ts
│   ├── TemplateProvider.ts
│   ├── ConfigurationProvider.ts
│   ├── RecentGenerationsProvider.ts
│   └── ProjectMetadataProvider.ts
└── utils/
    └── Logger.ts               # Logging utilities
```

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request