# Template Creation and Customization Guide

This guide covers everything you need to know about creating, customizing, and managing templates for the Documentation Generator extension.

## Table of Contents

1. [Template Basics](#template-basics)
2. [Template Structure](#template-structure)
3. [Variables and Substitution](#variables-and-substitution)
4. [Built-in Variables](#built-in-variables)
5. [Advanced Template Features](#advanced-template-features)
6. [Template Management](#template-management)
7. [Best Practices](#best-practices)
8. [Template Examples](#template-examples)
9. [Troubleshooting Templates](#troubleshooting-templates)

## Template Basics

### What are Templates?

Templates are Markdown files with special syntax that the Documentation Generator uses to create consistent, structured documentation. They combine:

- **Static content**: Text that appears in every generated document
- **Variables**: Placeholders that get replaced with project-specific content
- **Metadata**: Configuration in the frontmatter section

### Template File Format

All templates must be Markdown files (`.md`) with YAML frontmatter:

```markdown
---
name: "Template Name"
description: "What this template generates"
variables:
  - name: "variableName"
    description: "What this variable represents"
    default: "default value"
---

# Template Content

Your template content goes here with {{variableName}} placeholders.
```

## Template Structure

### Required Frontmatter

Every template must include this minimal frontmatter:

```yaml
---
name: "My Template"           # Display name in VS Code
description: "Template description"  # Shown in template picker
---
```

### Full Frontmatter Schema

```yaml
---
name: "Complete Template Example"
description: "A comprehensive template demonstrating all features"
category: "Documentation"          # Optional: Groups templates
version: "1.0.0"                  # Optional: Template version
author: "Your Name"               # Optional: Template author
tags: ["api", "documentation"]    # Optional: Searchable tags
variables:
  - name: "projectName"
    description: "Name of the project"
    type: "string"                # string|number|boolean|array
    required: true                # Optional: defaults to false
    default: "{{folderName}}"     # Optional: default value
    validation: "^[a-zA-Z0-9-_]+$"  # Optional: regex validation
  - name: "includeTests"
    description: "Whether to include test documentation"
    type: "boolean"
    default: false
output:
  filename: "{{projectName}}-docs.md"  # Optional: custom filename
  directory: "docs/"               # Optional: output subdirectory
---
```

## Variables and Substitution

### Basic Variable Syntax

Variables use double curly braces: `{{variableName}}`

```markdown
# {{projectName}} Documentation

Welcome to {{projectName}}! This project was created on {{date}}.
```

### Variable Types

#### String Variables
```yaml
- name: "projectName"
  type: "string"
  default: "My Project"
```

#### Boolean Variables
```yaml
- name: "includeAPI"
  type: "boolean"
  default: true
```

Usage in template:
```markdown
{{#if includeAPI}}
## API Documentation
API endpoints are documented below.
{{/if}}
```

#### Array Variables
```yaml
- name: "features"
  type: "array"
  default: ["authentication", "database", "api"]
```

Usage in template:
```markdown
## Features
{{#each features}}
- {{this}}
{{/each}}
```

### Conditional Content

Use Handlebars-style conditionals:

```markdown
{{#if includeAPI}}
## API Documentation
This section covers the REST API endpoints.
{{/if}}

{{#unless isPrivate}}
## Public Documentation
This is public-facing documentation.
{{/unless}}
```

### Loops and Iteration

```markdown
## File Structure
{{#each fileList}}
- {{name}} ({{size}} bytes)
{{/each}}

## Dependencies
{{#each dependencies}}
### {{name}}
Version: {{version}}
Description: {{description}}
{{/each}}
```

## Built-in Variables

The extension automatically provides these variables:

### Project Context
- `{{folderName}}`: Name of selected folder
- `{{folderPath}}`: Full path to selected folder
- `{{workspaceName}}`: VS Code workspace name
- `{{workspacePath}}`: VS Code workspace path

### Time and Date
- `{{date}}`: Current date (YYYY-MM-DD)
- `{{time}}`: Current time (HH:MM:SS)
- `{{timestamp}}`: Unix timestamp
- `{{dateTime}}`: Full date and time (ISO 8601)

### File Analysis
- `{{fileList}}`: Array of files in the folder
- `{{fileCount}}`: Number of files
- `{{totalSize}}`: Total size of all files
- `{{fileTypes}}`: Array of unique file extensions

### Code Analysis
- `{{codeStructure}}`: AI-analyzed code structure
- `{{functions}}`: Detected functions and methods
- `{{classes}}`: Detected classes and interfaces
- `{{exports}}`: Detected exports and modules
- `{{dependencies}}`: Package dependencies
- `{{languages}}`: Programming languages detected

### Git Information (if available)
- `{{gitBranch}}`: Current git branch
- `{{gitCommit}}`: Latest commit hash
- `{{gitAuthor}}`: Last commit author
- `{{gitMessage}}`: Last commit message

### Examples of Built-in Variable Usage

```markdown
# {{folderName}} Documentation
*Generated on {{date}} at {{time}}*

## Project Overview
This documentation covers the {{folderName}} component located at `{{folderPath}}`.

## Files ({{fileCount}} total)
{{#each fileList}}
- **{{name}}** ({{extension}}) - {{size}} bytes
{{/each}}

## Code Structure
{{codeStructure}}

## Dependencies
{{#each dependencies}}
- {{name}} ({{version}})
{{/each}}
```

## Advanced Template Features

### Custom Helper Functions

Templates support custom helper functions for complex logic:

```markdown
{{capitalize projectName}}          # Capitalizes first letter
{{slugify "My Project Name"}}       # Converts to my-project-name
{{formatDate date "MMM DD, YYYY"}}  # Formats date
{{truncate description 100}}       # Truncates to 100 characters
{{join features ", "}}              # Joins array with separator
```

### Nested Variables

Access nested data structures:

```markdown
{{package.name}}                    # From package.json
{{package.version}}
{{package.dependencies.express}}

{{codeAnalysis.functions.0.name}}   # First function name
{{codeAnalysis.classes.length}}     # Number of classes
```

### Template Inheritance

Create base templates and extend them:

**base-template.md**:
```yaml
---
name: "Base Template"
description: "Base template for all docs"
isBase: true
---

# {{projectName}} Documentation

{{> header}}

## Content
{{> content}}

{{> footer}}
```

**api-template.md**:
```yaml
---
name: "API Documentation"
description: "API-specific documentation"
extends: "base-template"
---

{{#*inline "header"}}
*API Documentation for {{projectName}}*
{{/inline}}

{{#*inline "content"}}
## API Endpoints
{{#each endpoints}}
### {{method}} {{path}}
{{description}}
{{/each}}
{{/inline}}
```

### Template Includes

Include reusable template fragments:

**_common/header.md**:
```markdown
# {{projectName}}
*Generated: {{date}}*

> {{description}}
```

**main-template.md**:
```markdown
---
name: "Main Template"
---

{{> _common/header}}

## Main Content
Your main content here.
```

## Template Management

### Directory Structure

Organize templates in a clear hierarchy:

```
templates/
├── documentation/
│   ├── api.md
│   ├── user-guide.md
│   └── technical-spec.md
├── planning/
│   ├── prd.md
│   ├── project-brief.md
│   └── meeting-notes.md
├── _common/
│   ├── header.md
│   ├── footer.md
│   └── helpers.md
└── custom/
    ├── team-specific.md
    └── client-template.md
```

### Template Discovery

The extension finds templates in these locations (in order):

1. **Custom template directory** (from settings)
2. **Workspace templates** (`./templates/` in project root)
3. **User templates** (`~/.vscode/documentation-templates/`)
4. **Extension templates** (built-in defaults)

### Template Validation

Templates are automatically validated for:

- Valid YAML frontmatter
- Required fields (name, description)
- Variable syntax errors
- Circular dependencies
- Missing includes

### Version Management

Track template versions:

```yaml
---
name: "API Template"
version: "2.1.0"
changelog:
  - "2.1.0": "Added OpenAPI schema generation"
  - "2.0.0": "Restructured endpoint documentation"
  - "1.0.0": "Initial version"
---
```

## Best Practices

### Template Design

1. **Keep it simple**: Start with basic templates and add complexity gradually
2. **Use meaningful names**: Template and variable names should be self-explanatory
3. **Provide good defaults**: Variables should work without user input when possible
4. **Add descriptions**: Every variable should have a clear description
5. **Think reusability**: Design templates that work across different projects

### Variable Naming

```yaml
# Good
- name: "projectName"
- name: "includeTestDocs"
- name: "maintenanceContact"

# Avoid
- name: "n"
- name: "x"
- name: "thing"
```

### Content Organization

```markdown
# Structure your templates logically

## 1. Overview (always first)
Brief description of what's being documented.

## 2. Getting Started (for user-facing docs)
Quick start instructions.

## 3. Main Content (varies by template)
Core documentation content.

## 4. Reference (detailed information)
Comprehensive details and examples.

## 5. Appendix (optional)
Additional resources and links.
```

### Error Handling

Include fallbacks for missing data:

```markdown
{{#if description}}
{{description}}
{{else}}
No description available for this project.
{{/if}}

## Dependencies
{{#if dependencies.length}}
{{#each dependencies}}
- {{name}}: {{version}}
{{/each}}
{{else}}
No dependencies detected.
{{/if}}
```

## Template Examples

### Example 1: Simple Project README

```yaml
---
name: "Project README"
description: "Basic README.md template"
variables:
  - name: "projectDescription"
    description: "Brief description of the project"
    default: "A software project"
  - name: "installCommand"
    description: "Installation command"
    default: "npm install"
  - name: "includeContributing"
    type: "boolean"
    description: "Include contributing section"
    default: true
---

# {{projectName}}

{{projectDescription}}

## Installation

```bash
{{installCommand}}
```

## Usage

Add usage instructions here.

## File Structure

{{#each fileList}}
- {{name}}
{{/each}}

{{#if includeContributing}}
## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
{{/if}}

## License

This project is licensed under the MIT License.
```

### Example 2: API Documentation Template

```yaml
---
name: "API Documentation"
description: "REST API documentation template"
category: "API"
variables:
  - name: "baseUrl"
    description: "API base URL"
    default: "https://api.example.com"
  - name: "version"
    description: "API version"
    default: "v1"
  - name: "requiresAuth"
    type: "boolean"
    description: "Whether API requires authentication"
    default: true
---

# {{projectName}} API Documentation

## Base URL
```
{{baseUrl}}/{{version}}
```

{{#if requiresAuth}}
## Authentication
This API requires authentication. Include your API key in the header:
```
Authorization: Bearer YOUR_API_KEY
```
{{/if}}

## Endpoints

Based on the code analysis, the following endpoints were detected:

{{#each codeStructure.endpoints}}
### {{method}} {{path}}

{{description}}

**Parameters:**
{{#each parameters}}
- `{{name}}` ({{type}}) - {{description}}
{{/each}}

**Response:**
```json
{{responseExample}}
```

{{/each}}

## Error Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 400  | Bad Request |
| 401  | Unauthorized |
| 404  | Not Found |
| 500  | Internal Server Error |

## Code Examples

### JavaScript
```javascript
fetch('{{baseUrl}}/{{version}}/endpoint', {
  method: 'GET',
  headers: {
    {{#if requiresAuth}}'Authorization': 'Bearer YOUR_API_KEY',{{/if}}
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

### Python
```python
import requests

{{#if requiresAuth}}
headers = {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
}
{{else}}
headers = {'Content-Type': 'application/json'}
{{/if}}

response = requests.get('{{baseUrl}}/{{version}}/endpoint', headers=headers)
data = response.json()
```
```

### Example 3: Meeting Notes Template

```yaml
---
name: "Meeting Notes"
description: "Template for team meeting documentation"
category: "Planning"
variables:
  - name: "meetingType"
    description: "Type of meeting"
    default: "Team Standup"
  - name: "facilitator"
    description: "Meeting facilitator"
    default: "Team Lead"
  - name: "attendees"
    type: "array"
    description: "List of attendees"
    default: ["Team Member 1", "Team Member 2"]
  - name: "duration"
    description: "Meeting duration"
    default: "30 minutes"
output:
  filename: "meeting-notes-{{date}}.md"
  directory: "meetings/"
---

# {{meetingType}} - {{date}}

**Date:** {{date}} {{time}}
**Duration:** {{duration}}
**Facilitator:** {{facilitator}}

## Attendees
{{#each attendees}}
- {{this}}
{{/each}}

## Agenda Items

1. [ ] Previous action items review
2. [ ] Current sprint progress
3. [ ] Blockers and issues
4. [ ] Next steps

## Discussion Points

### Topic 1


### Topic 2


## Decisions Made

1.
2.
3.

## Action Items

| Action | Assignee | Due Date | Status |
|--------|----------|----------|--------|
|        |          |          | ⏳ Pending |
|        |          |          | ⏳ Pending |

## Next Meeting

**Date:** TBD
**Focus:** TBD

---
*Meeting notes generated on {{dateTime}}*
```

## Troubleshooting Templates

### Common Issues

#### Template Not Found
- Check template directory path in settings
- Verify file has `.md` extension
- Ensure frontmatter is valid YAML

#### Variable Not Substituted
- Check variable name spelling
- Verify variable is defined in frontmatter
- Test with simple variable first

#### Frontmatter Parsing Error
- Validate YAML syntax online
- Check for proper indentation
- Ensure `---` delimiters are on separate lines

#### Template Validation Failed
- Review error message in VS Code output panel
- Check for missing required fields
- Verify variable syntax

### Debugging Templates

Enable debug mode in settings:
```json
{
  "documentation-generator.debugMode": true,
  "documentation-generator.logLevel": "debug"
}
```

This will show:
- Template discovery process
- Variable substitution steps
- Code analysis results
- Generation timeline

### Testing Templates

Create a test project structure:
```
test-project/
├── src/
│   ├── api/
│   │   └── users.js
│   └── utils/
│       └── helpers.js
├── tests/
│   └── api.test.js
├── package.json
└── README.md
```

Use this to test how your templates handle:
- Different file structures
- Various programming languages
- Missing files or data
- Edge cases

### Template Performance

For better performance:
- Avoid complex loops in templates
- Use specific variables instead of analyzing all files
- Consider template caching for large projects
- Break complex templates into smaller includes

---

**Need help with templates?** Check our [Troubleshooting Guide](TROUBLESHOOTING.md) or open an issue on GitHub.