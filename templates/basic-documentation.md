---
name: Basic Documentation Template
description: A simple template for basic project documentation
author: Documentation Generator
version: 1.0.0
category: documentation
tags: basic, documentation, general
---

# {{projectName}}

## Overview
{{projectDescription}}

## Features
{{#features}}
- {{.}}
{{/features}}

## Installation

```bash
{{installCommand}}
```

## Usage

{{usageInstructions}}

## API Reference

{{#apiMethods}}
### {{methodName}}
{{methodDescription}}

**Parameters:**
{{#parameters}}
- `{{name}}` ({{type}}): {{description}}
{{/parameters}}

**Returns:** {{returnType}}

{{#example}}
**Example:**
```{{language}}
{{code}}
```
{{/example}}

{{/apiMethods}}

## Contributing

{{contributingGuidelines}}

## License

{{license}}