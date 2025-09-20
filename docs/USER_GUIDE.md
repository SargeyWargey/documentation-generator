# Documentation Generator - User Guide

A comprehensive guide to using the Documentation Generator extension for VS Code with Claude Code Pro.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Document Types](#document-types)
4. [Custom Templates](#custom-templates)
5. [Advanced Features](#advanced-features)
6. [Best Practices](#best-practices)
7. [Examples](#examples)

## Getting Started

### First Time Setup

1. **Install the Extension**
   - Search for "Documentation Generator" in VS Code Extensions
   - Click Install and restart VS Code

2. **Verify Claude Code Pro**
   - Ensure you have an active Claude Code Pro subscription
   - Test Claude Code Pro is working in your VS Code instance

3. **Open a Project**
   - Open any project folder in VS Code
   - The extension works best with structured codebases

### Quick Test

To verify everything is working:

1. Right-click any folder in your project
2. Select "Generate Documentation" > "📋 Help Documentation"
3. Watch for progress notifications
4. Check for generated documentation file

## Basic Usage

### Method 1: Context Menu (Recommended)

1. **Right-click on any folder** in the VS Code Explorer
2. **Select "Generate Documentation"** from the context menu
3. **Choose a document type** from the submenu:
   - 📋 Help Documentation
   - 📊 PRD (Product Requirements)
   - ⚙️ Technical Specification
   - 🤝 Meeting Summary
   - 📝 Custom Documentation

4. **Wait for generation** (typically 10-30 seconds)
5. **Find your generated document** in the folder

### Method 2: Keyboard Shortcuts

- `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac): Generate documentation for currently selected folder
- `Ctrl+Shift+T` (Windows/Linux) or `Cmd+Shift+T` (Mac): Open template selector
- `Ctrl+Shift+,` (Windows/Linux) or `Cmd+Shift+,` (Mac): Open extension settings

### Method 3: Command Palette

1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type "Documentation Generator"
3. Select the desired command

### Method 4: Sidebar Panel

1. Click the Documentation Generator icon in the Activity Bar
2. Use the sidebar panel to access quick actions
3. Browse recent generations and templates

## Document Types

### 📋 Help Documentation

**Best for**: API documentation, user guides, troubleshooting

**Generated content includes**:
- Getting started instructions
- API reference from code analysis
- Common usage patterns
- Troubleshooting guides
- FAQ section
- Code examples

**Example output**:
```markdown
# MyProject Help Documentation

## Getting Started
This project provides a REST API for managing user accounts...

## API Reference
### GET /api/users
Returns a list of all users...

## Troubleshooting
### Common Issues
1. **Connection refused**: Check that the server is running...
```

### 📊 PRD (Product Requirements Document)

**Best for**: Feature planning, stakeholder communication

**Generated content includes**:
- Executive summary
- Feature requirements extracted from code
- User stories derived from functionality
- Acceptance criteria from tests
- Success metrics suggestions
- Technical dependencies

**Example output**:
```markdown
# MyProject - Product Requirements Document

## Executive Summary
This document outlines the requirements for the user authentication system...

## User Stories
- As a user, I want to log in securely so that I can access my account
- As an admin, I want to manage user permissions...

## Acceptance Criteria
- Login must complete within 2 seconds
- Password must meet security requirements...
```

### ⚙️ Technical Specification

**Best for**: Architecture documentation, development planning

**Generated content includes**:
- System architecture overview
- API specifications
- Database schema documentation
- Integration points
- Security considerations
- Performance requirements

**Example output**:
```markdown
# MyProject - Technical Specification

## Architecture Overview
The system follows a microservices architecture with...

## API Specification
### Authentication Service
Endpoint: `/auth`
Methods: POST, GET, DELETE...

## Database Schema
### Users Table
- id: PRIMARY KEY, UUID
- email: VARCHAR(255), UNIQUE...
```

### 🤝 Meeting Summary

**Best for**: Team meetings, decision tracking

**Generated content includes**:
- Meeting overview
- Key decisions made
- Action items assigned
- Follow-up tasks
- Attendee list
- Next steps

### 📝 Custom Documentation

**Best for**: Specialized documentation needs

**Uses your custom templates** to generate documentation tailored to your specific requirements.

## Custom Templates

### Creating Your First Template

1. **Create a template file** (e.g., `my-template.md`)
2. **Add frontmatter**:
   ```yaml
   ---
   name: "My Custom Template"
   description: "Template for project onboarding docs"
   variables:
     - name: "projectName"
       description: "Name of the project"
       default: "{{folderName}}"
     - name: "maintainer"
       description: "Project maintainer"
       default: "Team Lead"
   ---
   ```

3. **Write your template content**:
   ```markdown
   # {{projectName}} - Onboarding Guide

   Welcome to {{projectName}}! This guide will help you get started.

   ## Project Overview
   {{projectName}} is maintained by {{maintainer}}.

   ## File Structure
   {{fileList}}

   ## Code Analysis
   {{codeStructure}}
   ```

4. **Save in your templates directory**

### Built-in Variables

All templates have access to these variables:

- `{{folderName}}`: Selected folder name
- `{{folderPath}}`: Full path to folder
- `{{date}}`: Current date (YYYY-MM-DD)
- `{{time}}`: Current time (HH:MM:SS)
- `{{fileList}}`: Formatted list of files in folder
- `{{codeStructure}}`: AI-analyzed code structure
- `{{dependencies}}`: Detected dependencies

### Template Directory Setup

1. **Set custom template directory**:
   - Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
   - Search for "documentation generator"
   - Set "Template Directory" to your templates folder

2. **Default locations** (if not set):
   - `./templates/` in your workspace
   - `~/.vscode/documentation-templates/`

## Advanced Features

### Output Naming Patterns

Customize how generated files are named:

**Default pattern**: `generated-docs-{template}-{date}`

**Available variables**:
- `{template}`: Template name
- `{date}`: Current date
- `{folder}`: Folder name
- `{time}`: Current time

**Examples**:
- `{folder}-docs-{date}` → `api-docs-2024-01-15`
- `{template}-{folder}` → `prd-authentication`
- `docs/{date}/{template}` → `docs/2024-01-15/help`

### Integration Methods

#### Slash Commands (Default)
- Automatically creates temporary commands in `.claude/commands/`
- Best for most users
- No additional setup required

#### MCP Server
- Enables real-time communication with Claude Code Pro
- Better for advanced workflows
- Requires MCP server configuration

To switch methods:
1. Open VS Code Settings
2. Find "Claude Integration Method"
3. Choose "mcp-server" for advanced features

### Progress Notifications

Control how much feedback you receive:

- **Show Progress Notifications**: On/Off
- **Auto Refresh Sidebar**: On/Off

## Best Practices

### For Best Results

1. **Use meaningful folder names** - helps with context analysis
2. **Include README files** - provides additional context
3. **Keep code well-commented** - improves analysis quality
4. **Organize files logically** - better structural analysis

### Template Best Practices

1. **Use descriptive variable names**
2. **Provide good default values**
3. **Include clear descriptions**
4. **Test templates on different projects**
5. **Version your templates**

### Project Organization

```
my-project/
├── src/                    # Source code
├── docs/                   # Generated documentation
│   ├── help/
│   ├── specs/
│   └── prds/
├── templates/              # Custom templates
│   ├── my-custom.md
│   └── team-specific.md
└── .claude/               # Claude commands (auto-generated)
```

## Examples

### Example 1: REST API Documentation

**Scenario**: Generate help docs for a Node.js Express API

**Steps**:
1. Right-click `src/api/` folder
2. Select "Generate Documentation" > "📋 Help Documentation"
3. Wait for generation

**Generated content**:
```markdown
# API Documentation

## Endpoints

### GET /api/users
Retrieves all users from the database.

**Response**:
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Authentication
All endpoints require a valid JWT token...
```

### Example 2: Feature PRD

**Scenario**: Create PRD for new authentication feature

**Steps**:
1. Right-click `src/auth/` folder
2. Select "Generate Documentation" > "📊 PRD (Product Requirements)"
3. Review and edit generated PRD

**Generated content**:
```markdown
# Authentication System - PRD

## Objective
Implement secure user authentication with JWT tokens and OAuth2 support.

## User Stories
- As a new user, I want to create an account with email/password
- As a returning user, I want to log in securely
- As a user, I want to reset my password if forgotten

## Success Metrics
- Login completion rate > 95%
- Authentication response time < 200ms
- Password reset success rate > 90%
```

### Example 3: Custom Template

**Scenario**: Create deployment guide template

**Template** (`deployment-guide.md`):
```yaml
---
name: "Deployment Guide"
description: "Step-by-step deployment instructions"
variables:
  - name: "environment"
    description: "Target environment"
    default: "production"
  - name: "version"
    description: "Version being deployed"
    default: "1.0.0"
---

# {{projectName}} Deployment Guide

## Version: {{version}}
## Environment: {{environment}}
## Date: {{date}}

## Pre-deployment Checklist
- [ ] Tests passing
- [ ] Database migrations ready
- [ ] Environment variables configured

## Deployment Steps
Based on the project structure:
{{codeStructure}}

## Files to Deploy
{{fileList}}

## Post-deployment Verification
- [ ] Health check endpoint responding
- [ ] Key features working
- [ ] Monitoring alerts configured
```

**Usage**:
1. Right-click deployment folder
2. Select "📝 Custom Documentation"
3. Choose "Deployment Guide" template
4. Generated guide with project-specific details

## Troubleshooting

See the main [Troubleshooting Guide](TROUBLESHOOTING.md) for common issues and solutions.

## Next Steps

- Explore [Template Creation Guide](TEMPLATE_GUIDE.md)
- Read [Claude Code Integration](CLAUDE_INTEGRATION.md)
- Check [Developer Documentation](CONTRIBUTING.md)

---

**Need help?** Open an issue on GitHub or check our FAQ section.