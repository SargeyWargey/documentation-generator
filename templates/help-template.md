---
name: "Help Documentation Template"
description: "Comprehensive user guide template for software projects"
category: "documentation"
version: "1.0.0"
author: "Documentation Generator"
tags: ["help", "user-guide", "documentation", "getting-started"]
variables:
  - name: "projectName"
    type: "string"
    required: true
    description: "Name of the project or software"
    validation:
      minLength: 1
      maxLength: 100
  - name: "projectDescription"
    type: "string"
    required: true
    description: "Brief description of what the project does"
    validation:
      minLength: 10
      maxLength: 500
  - name: "installationSteps"
    type: "array"
    required: false
    description: "Step-by-step installation instructions"
    default: []
  - name: "mainFeatures"
    type: "array"
    required: true
    description: "List of main features with name and description"
    validation:
      minItems: 1
  - name: "apiEndpoints"
    type: "array"
    required: false
    description: "API endpoints with method, endpoint, and description"
    default: []
  - name: "commonIssues"
    type: "array"
    required: false
    description: "Common issues with their solutions"
    default: []
  - name: "faq"
    type: "array"
    required: false
    description: "Frequently asked questions with answers"
    default: []
  - name: "contactInfo"
    type: "string"
    required: false
    description: "Contact information for support"
    default: ""
  - name: "version"
    type: "string"
    required: false
    description: "Current version of the project"
    default: "1.0.0"
  - name: "lastUpdated"
    type: "date"
    required: false
    description: "Date when documentation was last updated"
    default: "{{currentDate}}"
---

# {{projectName}} - User Guide

**Version**: {{version}}
**Last Updated**: {{lastUpdated}}

## Overview

{{projectDescription}}

## Getting Started

### Installation

{{#if installationSteps}}
Follow these steps to install {{projectName}}:

{{#installationSteps}}
{{@index}}. {{.}}
{{/installationSteps}}
{{else}}
Installation instructions will be provided here.
{{/if}}

### Quick Start

1. Install {{projectName}} following the instructions above
2. Configure your settings
3. Start using the main features listed below

## Features

{{projectName}} provides the following key features:

{{#mainFeatures}}
### {{name}}

{{description}}

{{#if usage}}
**Usage:**
```
{{usage}}
```
{{/if}}

{{#if examples}}
**Examples:**
{{#examples}}
- {{.}}
{{/examples}}
{{/if}}

{{/mainFeatures}}

## API Reference

{{#if apiEndpoints}}
This section documents the available API endpoints for {{projectName}}.

{{#apiEndpoints}}
### {{method}} {{endpoint}}

{{description}}

{{#if parameters}}
**Parameters:**
{{#parameters}}
- `{{name}}` ({{type}}) - {{description}}{{#if required}} *Required*{{/if}}
{{/parameters}}
{{/if}}

{{#if requestExample}}
**Request Example:**
```json
{{requestExample}}
```
{{/if}}

{{#if responseExample}}
**Response Example:**
```json
{{responseExample}}
```
{{/if}}

---

{{/apiEndpoints}}
{{else}}
API documentation will be available here when applicable.
{{/if}}

## Configuration

### Settings

Configure {{projectName}} by modifying the following settings:

- **Basic Settings**: Core configuration options
- **Advanced Settings**: Additional customization options
- **Integration Settings**: Third-party service configurations

### Environment Variables

{{#if environmentVariables}}
{{#environmentVariables}}
- `{{name}}`: {{description}}{{#if required}} *Required*{{/if}}
{{/environmentVariables}}
{{else}}
Environment variables will be documented here when applicable.
{{/if}}

## Troubleshooting

{{#if commonIssues}}
This section covers common issues and their solutions:

{{#commonIssues}}
### {{issue}}

**Problem**: {{problem}}

**Solution**: {{solution}}

{{#if additionalNotes}}
**Note**: {{additionalNotes}}
{{/if}}

---

{{/commonIssues}}
{{else}}
### General Troubleshooting

If you encounter issues with {{projectName}}:

1. Check that all dependencies are properly installed
2. Verify your configuration settings
3. Review the error logs for specific error messages
4. Consult the FAQ section below
5. Contact support if the issue persists
{{/if}}

## FAQ

{{#if faq}}
{{#faq}}
### {{question}}

{{answer}}

{{/faq}}
{{else}}
**Q: How do I get started with {{projectName}}?**

A: Follow the installation instructions in the Getting Started section, then explore the Features section to understand what {{projectName}} can do.

**Q: Where can I find more examples?**

A: Check the Features section for usage examples, or visit the project repository for additional examples and use cases.

**Q: How do I report a bug or request a feature?**

A: {{#if contactInfo}}{{contactInfo}}{{else}}Please check the project repository for issue reporting guidelines.{{/if}}
{{/if}}

## Advanced Usage

### Best Practices

- Follow the recommended configuration guidelines
- Use proper error handling in your implementations
- Keep your installation up to date
- Monitor performance and usage patterns

### Integration Examples

Examples of integrating {{projectName}} with other tools and services will be provided here.

## Support and Community

{{#if contactInfo}}
**Support**: {{contactInfo}}
{{else}}
For support, please check the project documentation or reach out through the appropriate channels.
{{/if}}

### Contributing

We welcome contributions to {{projectName}}! Please review the contribution guidelines before submitting pull requests.

### License

Please refer to the LICENSE file for licensing information.

---

*This documentation was automatically generated using the Documentation Generator extension.*