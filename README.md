# Documentation Generator for VS Code

A powerful VS Code extension that automates technical documentation generation through intelligent folder analysis and template-based content creation, integrated with Claude Code Pro.

## 🚀 Features

- **📋 Multiple Document Types**: Generate Help Documentation, PRDs, Technical Specifications, Meeting Summaries, and Custom Documentation
- **🔍 Smart Folder Analysis**: Automatically analyzes project structure, code patterns, functions, and dependencies
- **📝 Template-Based Generation**: Uses customizable templates with variable substitution for consistent documentation
- **🤖 Claude Code Pro Integration**: Seamlessly integrates with Claude Code Pro via slash commands and MCP server
- **🎨 Custom Templates**: Create and manage your own documentation templates
- **⚡ Quick Access**: Right-click any folder to generate documentation instantly
- **🔧 Configurable Output**: Customize naming patterns and output locations
- **📊 Progress Tracking**: Real-time progress indicators during generation

### Available Document Types

- **📋 Help Documentation**: API docs, getting started guides, troubleshooting, and FAQs
- **📊 PRD (Product Requirements)**: Feature requirements, user stories, and acceptance criteria
- **⚙️ Technical Specifications**: Architecture analysis, API specs, and integration docs
- **🤝 Meeting Summaries**: Action items, decisions, and follow-up tracking
- **📝 Custom Documentation**: Use your own templates for specialized docs

## 📋 Requirements

- **VS Code**: Version 1.104.0 or higher
- **Claude Code Pro**: Active subscription for AI-powered documentation generation
- **Node.js**: For MCP server functionality (if using MCP integration method)

## 🛠️ Installation

1. Install from VS Code Marketplace (when published)
2. Or install from VSIX:
   ```bash
   code --install-extension documentation-generator-0.0.1.vsix
   ```

## 🚀 Quick Start

1. **Open any project** in VS Code
2. **Right-click a folder** in the Explorer
3. **Select "Generate Documentation"** from the context menu
4. **Choose a document type** (Help Docs, PRD, Tech Spec, etc.)
5. **Wait for generation** - the extension will analyze your folder and create documentation using Claude Code Pro

### Keyboard Shortcuts

- `Ctrl+Shift+D` (`Cmd+Shift+D` on Mac): Generate Documentation for selected folder
- `Ctrl+Shift+T` (`Cmd+Shift+T` on Mac): Select Template
- `Ctrl+Shift+,` (`Cmd+Shift+,` on Mac): Open Extension Settings

## ⚙️ Extension Settings

This extension contributes the following settings:

* `documentation-generator.templateDirectory`: Custom template directory path (default: "")
* `documentation-generator.outputNamePattern`: Pattern for output file naming using {template}, {date}, {folder} variables (default: "generated-docs-{template}-{date}")
* `documentation-generator.claudeIntegrationMethod`: Method for Claude Code integration - "slash-commands" or "mcp-server" (default: "slash-commands")
* `documentation-generator.autoRefreshSidebar`: Automatically refresh sidebar when templates change (default: true)
* `documentation-generator.showProgressNotifications`: Show progress notifications during generation (default: true)

## 🎨 Custom Templates

### Creating Templates

1. Create a new `.md` file in your templates directory
2. Add frontmatter with template metadata:
   ```yaml
   ---
   name: "My Custom Template"
   description: "Custom documentation template"
   variables:
     - name: "projectName"
       description: "Name of the project"
       default: "{{folderName}}"
   ---
   ```
3. Write your template content using variables like `{{projectName}}`

### Template Variables

Built-in variables available in all templates:
- `{{folderName}}`: Name of the selected folder
- `{{folderPath}}`: Full path to the selected folder
- `{{date}}`: Current date
- `{{time}}`: Current time
- `{{fileList}}`: List of files in the folder
- `{{codeStructure}}`: Analyzed code structure and patterns

## 🔧 Claude Code Integration

The extension supports two integration methods with Claude Code Pro:

### Slash Commands (Default)
- Creates temporary slash commands in `.claude/commands/`
- Commands are executed automatically when generated
- Best for simple, one-time documentation generation

### MCP Server
- Provides real-time communication with Claude Code Pro
- Enables more sophisticated context sharing
- Better for interactive documentation workflows

To switch integration methods, update the `claudeIntegrationMethod` setting.

## 📁 Project Structure

```
documentation-generator/
├── src/
│   ├── commands/          # Slash command generators
│   ├── generators/        # Document type generators
│   ├── mcp/              # MCP server implementation
│   ├── providers/        # VS Code providers (sidebar, context menu)
│   ├── templates/        # Template management
│   ├── ui/               # UI components
│   └── utils/            # Utility services
├── templates/            # Default templates
└── resources/           # Static resources
```

## 🧪 Development

### Building from Source

```bash
# Clone the repository
git clone <repository-url>
cd documentation-generator

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm run test

# Format code
npm run format

# Lint code
npm run lint
```

### Running in Development

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new VS Code window

## 🐛 Known Issues

- Template validation may not catch all edge cases
- Large folders (10,000+ files) may experience slower analysis
- MCP server integration requires additional setup for some Claude Code Pro configurations

## 📋 Troubleshooting

### Extension Not Loading
- Check VS Code version (requires 1.104.0+)
- Verify extension is enabled in Extensions view
- Restart VS Code if needed

### Documentation Generation Fails
- Ensure Claude Code Pro is active and accessible
- Check folder permissions for selected directory
- Verify template syntax if using custom templates

### MCP Server Issues
- Check Node.js installation
- Verify MCP server configuration in Claude Code Pro
- Review VS Code Developer Console for errors

## 🔄 Release Notes

### 0.0.1 (Initial Release)
- Core documentation generation functionality
- Support for Help Docs, PRDs, Technical Specs, and Meeting Summaries
- Claude Code Pro integration via slash commands
- Custom template support
- Folder context menu integration
- Configurable output patterns

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Code style and standards
- Testing requirements
- Pull request process
- Issue reporting

## 📞 Support

- **Issues**: Report bugs and feature requests on [GitHub Issues](https://github.com/your-org/documentation-generator/issues)
- **Discussions**: Join discussions on [GitHub Discussions](https://github.com/your-org/documentation-generator/discussions)
- **Documentation**: Full documentation available in the [docs](./docs/) folder

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Enjoy generating better documentation with less effort!** 🎉
