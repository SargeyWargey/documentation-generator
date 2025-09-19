#!/bin/bash

# Documentation Generator MCP Server Installation Script

set -e

echo "Installing Documentation Generator MCP Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 18 or later."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js version 18 or later is required. Current version: $(node -v)"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install npm."
    exit 1
fi

echo "✓ Node.js $(node -v) found"
echo "✓ npm $(npm -v) found"

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the TypeScript code
echo "Building TypeScript code..."
npm run build

# Create symlink for global usage (optional)
if [ "$1" = "--global" ]; then
    echo "Creating global symlink..."
    npm link
    echo "✓ Global installation complete"
else
    echo "✓ Local installation complete"
    echo ""
    echo "To install globally, run: ./install.sh --global"
fi

# Create configuration directory
CONFIG_DIR="$HOME/.documentation-generator"
if [ ! -d "$CONFIG_DIR" ]; then
    echo "Creating configuration directory: $CONFIG_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$CONFIG_DIR/templates"
    echo "✓ Configuration directory created"
fi

# Create default templates directory
TEMPLATES_DIR="$CONFIG_DIR/templates"
if [ ! -f "$TEMPLATES_DIR/README.md" ]; then
    cat > "$TEMPLATES_DIR/README.md" << 'EOF'
# Custom Templates

This directory contains your custom documentation templates.

## Template Structure

Each template should be a Markdown file with YAML frontmatter:

```markdown
---
id: my-template
name: My Custom Template
description: A custom template for generating documentation
category: custom
version: 1.0.0
variables:
  - name: projectName
    type: string
    description: Name of the project
    required: true
  - name: author
    type: string
    description: Author of the project
    required: false
    default: "Unknown"
---

# {{projectName}}

This project was created by {{author}}.

## Overview

...
```

## Available Variables

Templates can use the following built-in variables:
- `{{folderPath}}` - Path to the analyzed folder
- `{{projectName}}` - Name of the project
- `{{projectType}}` - Detected project type
- `{{totalFiles}}` - Total number of files
- `{{dependencies}}` - List of dependencies
- `{{summary}}` - Project summary

EOF
    echo "✓ Default templates directory created"
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "Next steps:"
echo "1. Configure your VS Code extension to use this MCP server"
echo "2. Add the server to your Claude Code configuration"
echo "3. Start generating documentation!"
echo ""
echo "Server path: $(pwd)/dist/index.js"
echo "Configuration: $CONFIG_DIR"
echo ""