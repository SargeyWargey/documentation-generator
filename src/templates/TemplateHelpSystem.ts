import * as vscode from 'vscode';
import { Template, TemplateVariable, TemplateManager } from './TemplateManager';

export interface TemplateHelp {
  id: string;
  name: string;
  description: string;
  usage: string;
  examples: TemplateExample[];
  variables: TemplateVariableHelp[];
  bestPractices: string[];
  troubleshooting: TroubleshootingItem[];
}

export interface TemplateExample {
  title: string;
  description: string;
  variables: Record<string, any>;
  expectedOutput: string;
}

export interface TemplateVariableHelp {
  name: string;
  description: string;
  type: string;
  required: boolean;
  default?: any;
  examples: string[];
  validation?: string;
}

export interface TroubleshootingItem {
  issue: string;
  cause: string;
  solution: string;
}

export class TemplateHelpSystem {
  private helpCache: Map<string, TemplateHelp> = new Map();

  constructor(private templateManager: TemplateManager) {}

  /**
   * Get comprehensive help for a template
   */
  getTemplateHelp(templateId: string): TemplateHelp | undefined {
    // Check cache first
    if (this.helpCache.has(templateId)) {
      return this.helpCache.get(templateId);
    }

    const template = this.templateManager.getTemplate(templateId);
    if (!template) {
      return undefined;
    }

    const help = this.generateTemplateHelp(template);
    this.helpCache.set(templateId, help);
    return help;
  }

  /**
   * Get help for all available templates
   */
  getAllTemplateHelp(): TemplateHelp[] {
    const templates = this.templateManager.getTemplates();
    return templates.map(template => this.getTemplateHelp(template.id)).filter(Boolean) as TemplateHelp[];
  }

  /**
   * Search help documentation
   */
  searchHelp(query: string): TemplateHelp[] {
    const allHelp = this.getAllTemplateHelp();
    const lowercaseQuery = query.toLowerCase();

    return allHelp.filter(help =>
      help.name.toLowerCase().includes(lowercaseQuery) ||
      help.description.toLowerCase().includes(lowercaseQuery) ||
      help.usage.toLowerCase().includes(lowercaseQuery) ||
      help.bestPractices.some(practice => practice.toLowerCase().includes(lowercaseQuery)) ||
      help.troubleshooting.some(item =>
        item.issue.toLowerCase().includes(lowercaseQuery) ||
        item.solution.toLowerCase().includes(lowercaseQuery)
      )
    );
  }

  /**
   * Show help panel for a template
   */
  async showTemplateHelp(templateId: string): Promise<void> {
    const help = this.getTemplateHelp(templateId);
    if (!help) {
      vscode.window.showErrorMessage(`Help not available for template: ${templateId}`);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'templateHelp',
      `Template Help: ${help.name}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.generateHelpHTML(help);
  }

  /**
   * Show template getting started guide
   */
  async showGettingStarted(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'templateGettingStarted',
      'Template System - Getting Started',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.generateGettingStartedHTML();
  }

  /**
   * Validate template usage and provide suggestions
   */
  validateTemplateUsage(templateId: string, variables: Record<string, any>): ValidationResult {
    const template = this.templateManager.getTemplate(templateId);
    if (!template) {
      return {
        isValid: false,
        errors: [`Template '${templateId}' not found`],
        warnings: [],
        suggestions: []
      };
    }

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Validate required variables
    if (template.metadata.variables) {
      for (const variable of template.metadata.variables) {
        if (variable.required && !(variable.name in variables)) {
          result.errors.push(`Missing required variable: ${variable.name}`);
          result.isValid = false;
        }

        // Type validation
        if (variable.name in variables) {
          const value = variables[variable.name];
          const typeValidation = this.validateVariableType(variable, value);
          if (!typeValidation.isValid) {
            result.warnings.push(typeValidation.message);
          }
        }

        // Provide suggestions for missing variables
        if (!(variable.name in variables) && variable.default !== undefined) {
          result.suggestions.push(`Consider using default value for '${variable.name}': ${variable.default}`);
        }
      }
    }

    return result;
  }

  private generateTemplateHelp(template: Template): TemplateHelp {
    return {
      id: template.id,
      name: template.metadata.name,
      description: template.metadata.description,
      usage: this.generateUsageInstructions(template),
      examples: this.generateExamples(template),
      variables: this.generateVariableHelp(template.metadata.variables || []),
      bestPractices: this.generateBestPractices(template),
      troubleshooting: this.generateTroubleshooting(template)
    };
  }

  private generateUsageInstructions(template: Template): string {
    const category = template.metadata.category || 'general';
    const variables = template.metadata.variables || [];

    let usage = `This template is designed for ${category} documentation generation.\n\n`;

    if (variables.length > 0) {
      usage += 'Required variables:\n';
      variables.filter(v => v.required).forEach(v => {
        usage += `- ${v.name}: ${v.description}\n`;
      });

      const optionalVars = variables.filter(v => !v.required);
      if (optionalVars.length > 0) {
        usage += '\nOptional variables:\n';
        optionalVars.forEach(v => {
          usage += `- ${v.name}: ${v.description}`;
          if (v.default !== undefined) {
            usage += ` (default: ${v.default})`;
          }
          usage += '\n';
        });
      }
    }

    return usage;
  }

  private generateExamples(template: Template): TemplateExample[] {
    const examples: TemplateExample[] = [];

    // Generate basic example
    const basicVariables: Record<string, any> = {};
    if (template.metadata.variables) {
      for (const variable of template.metadata.variables) {
        if (variable.required) {
          basicVariables[variable.name] = this.getExampleValue(variable);
        }
      }
    }

    examples.push({
      title: 'Basic Usage',
      description: 'Minimum required variables for this template',
      variables: basicVariables,
      expectedOutput: 'Preview of generated content...'
    });

    // Generate advanced example if there are optional variables
    const optionalVars = template.metadata.variables?.filter(v => !v.required);
    if (optionalVars && optionalVars.length > 0) {
      const advancedVariables = { ...basicVariables };
      optionalVars.forEach(variable => {
        advancedVariables[variable.name] = this.getExampleValue(variable);
      });

      examples.push({
        title: 'Advanced Usage',
        description: 'Using all available variables',
        variables: advancedVariables,
        expectedOutput: 'Preview with all options...'
      });
    }

    return examples;
  }

  private generateVariableHelp(variables: TemplateVariable[]): TemplateVariableHelp[] {
    return variables.map(variable => ({
      name: variable.name,
      description: variable.description,
      type: variable.type,
      required: variable.required || false,
      default: variable.default,
      examples: this.getVariableExamples(variable),
      validation: this.getVariableValidation(variable)
    }));
  }

  private generateBestPractices(template: Template): string[] {
    const practices: string[] = [
      'Always provide meaningful values for required variables',
      'Use descriptive names and clear language in your documentation',
      'Review the generated output before finalizing',
      'Keep variable values concise but informative'
    ];

    // Add template-specific practices based on category
    const category = template.metadata.category;
    switch (category) {
      case 'api':
        practices.push('Include code examples for API endpoints');
        practices.push('Document authentication requirements clearly');
        break;
      case 'user-guide':
        practices.push('Use step-by-step instructions');
        practices.push('Include screenshots where helpful');
        break;
      case 'technical':
        practices.push('Provide architecture diagrams when relevant');
        practices.push('Document system requirements and dependencies');
        break;
    }

    return practices;
  }

  private generateTroubleshooting(_template: Template): TroubleshootingItem[] {
    return [
      {
        issue: 'Template variables not being replaced',
        cause: 'Variable names might be misspelled or missing from input',
        solution: 'Check variable names match exactly (case-sensitive) and all required variables are provided'
      },
      {
        issue: 'Generated content looks incomplete',
        cause: 'Some optional variables might enhance the output',
        solution: 'Review the template variables and consider providing values for optional parameters'
      },
      {
        issue: 'Template fails to process',
        cause: 'Invalid variable types or missing required fields',
        solution: 'Validate all inputs using the template help system before processing'
      }
    ];
  }

  private getExampleValue(variable: TemplateVariable): any {
    if (variable.default !== undefined) {
      return variable.default;
    }

    switch (variable.type) {
      case 'string':
        return `Example ${variable.name}`;
      case 'number':
        return 1;
      case 'boolean':
        return true;
      case 'date':
        return new Date().toISOString().split('T')[0];
      case 'select':
        return variable.options?.[0] || 'Option 1';
      default:
        return `Sample ${variable.name}`;
    }
  }

  private getVariableExamples(variable: TemplateVariable): string[] {
    const examples: string[] = [];

    switch (variable.type) {
      case 'string':
        examples.push(`"${this.getExampleValue(variable)}"`);
        if (variable.name.toLowerCase().includes('title')) {
          examples.push('"User Authentication System"');
        }
        if (variable.name.toLowerCase().includes('description')) {
          examples.push('"A comprehensive guide to implementing user authentication"');
        }
        break;
      case 'number':
        examples.push('1', '42', '100');
        break;
      case 'boolean':
        examples.push('true', 'false');
        break;
      case 'date':
        examples.push('"2024-01-15"', '"2024-12-31"');
        break;
      case 'select':
        if (variable.options) {
          examples.push(...variable.options.map(opt => `"${opt}"`));
        }
        break;
    }

    return examples;
  }

  private getVariableValidation(variable: TemplateVariable): string {
    switch (variable.type) {
      case 'string':
        return 'Must be a valid string';
      case 'number':
        return 'Must be a valid number';
      case 'boolean':
        return 'Must be true or false';
      case 'date':
        return 'Must be in YYYY-MM-DD format';
      case 'select':
        return variable.options ? `Must be one of: ${variable.options.join(', ')}` : 'Must be a valid option';
      default:
        return 'Follow the specified format';
    }
  }

  private validateVariableType(variable: TemplateVariable, value: any): { isValid: boolean; message: string } {
    switch (variable.type) {
      case 'string':
        if (typeof value !== 'string') {
          return { isValid: false, message: `Variable '${variable.name}' should be a string` };
        }
        break;
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          return { isValid: false, message: `Variable '${variable.name}' should be a number` };
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return { isValid: false, message: `Variable '${variable.name}' should be a boolean` };
        }
        break;
      case 'date':
        if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return { isValid: false, message: `Variable '${variable.name}' should be in YYYY-MM-DD format` };
        }
        break;
      case 'select':
        if (variable.options && !variable.options.includes(value)) {
          return { isValid: false, message: `Variable '${variable.name}' must be one of: ${variable.options.join(', ')}` };
        }
        break;
    }

    return { isValid: true, message: '' };
  }

  private generateHelpHTML(help: TemplateHelp): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Template Help: ${help.name}</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                margin: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            h1, h2, h3 { color: var(--vscode-textLink-foreground); }
            .section { margin-bottom: 30px; }
            .variable {
                background: var(--vscode-textBlockQuote-background);
                padding: 10px;
                margin: 10px 0;
                border-left: 3px solid var(--vscode-textLink-foreground);
            }
            .example {
                background: var(--vscode-textCodeBlock-background);
                padding: 15px;
                margin: 10px 0;
                border-radius: 4px;
            }
            .code {
                font-family: 'Courier New', monospace;
                background: var(--vscode-textCodeBlock-background);
                padding: 2px 4px;
                border-radius: 2px;
            }
            ul { padding-left: 20px; }
            .troubleshooting-item {
                background: var(--vscode-inputValidation-warningBackground);
                padding: 10px;
                margin: 10px 0;
                border-radius: 4px;
            }
        </style>
    </head>
    <body>
        <h1>${help.name}</h1>
        <p>${help.description}</p>

        <div class="section">
            <h2>Usage Instructions</h2>
            <pre>${help.usage}</pre>
        </div>

        <div class="section">
            <h2>Variables</h2>
            ${help.variables.map(variable => `
                <div class="variable">
                    <h3>${variable.name} ${variable.required ? '(Required)' : '(Optional)'}</h3>
                    <p><strong>Type:</strong> ${variable.type}</p>
                    <p><strong>Description:</strong> ${variable.description}</p>
                    ${variable.default !== undefined ? `<p><strong>Default:</strong> ${variable.default}</p>` : ''}
                    <p><strong>Examples:</strong> ${variable.examples.join(', ')}</p>
                    ${variable.validation ? `<p><strong>Validation:</strong> ${variable.validation}</p>` : ''}
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>Examples</h2>
            ${help.examples.map(example => `
                <div class="example">
                    <h3>${example.title}</h3>
                    <p>${example.description}</p>
                    <h4>Variables:</h4>
                    <pre class="code">${JSON.stringify(example.variables, null, 2)}</pre>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>Best Practices</h2>
            <ul>
                ${help.bestPractices.map(practice => `<li>${practice}</li>`).join('')}
            </ul>
        </div>

        <div class="section">
            <h2>Troubleshooting</h2>
            ${help.troubleshooting.map(item => `
                <div class="troubleshooting-item">
                    <h4>Issue: ${item.issue}</h4>
                    <p><strong>Cause:</strong> ${item.cause}</p>
                    <p><strong>Solution:</strong> ${item.solution}</p>
                </div>
            `).join('')}
        </div>
    </body>
    </html>
    `;
  }

  private generateGettingStartedHTML(): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Template System - Getting Started</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                margin: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            h1, h2, h3 { color: var(--vscode-textLink-foreground); }
            .section { margin-bottom: 30px; }
            .step {
                background: var(--vscode-textBlockQuote-background);
                padding: 15px;
                margin: 10px 0;
                border-left: 3px solid var(--vscode-textLink-foreground);
            }
            .code {
                font-family: 'Courier New', monospace;
                background: var(--vscode-textCodeBlock-background);
                padding: 10px;
                border-radius: 4px;
                display: block;
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <h1>Documentation Generator Template System</h1>
        <p>Welcome to the template system! This guide will help you get started with creating and using templates.</p>

        <div class="section">
            <h2>Quick Start</h2>
            <div class="step">
                <h3>1. View Available Templates</h3>
                <p>Open the Documentation Generator sidebar to see all available templates organized by category.</p>
            </div>
            <div class="step">
                <h3>2. Select a Folder</h3>
                <p>Right-click on any folder in your workspace and select "Generate Documentation" to see template options.</p>
            </div>
            <div class="step">
                <h3>3. Choose a Template</h3>
                <p>Select the template that best fits your documentation needs (API, User Guide, Technical Spec, etc.).</p>
            </div>
            <div class="step">
                <h3>4. Fill in Variables</h3>
                <p>Provide values for the template variables. Required variables are marked clearly.</p>
            </div>
            <div class="step">
                <h3>5. Generate Documentation</h3>
                <p>Click "Generate" to create your documentation using Claude Code Pro integration.</p>
            </div>
        </div>

        <div class="section">
            <h2>Template Structure</h2>
            <p>Templates use a simple frontmatter format:</p>
            <code class="code">---
name: Template Name
description: What this template does
category: api|user-guide|technical|meeting
variables: [
  {
    "name": "title",
    "description": "Document title",
    "type": "string",
    "required": true
  }
]
---

# {{title}}

Your template content here with {{variables}}.</code>
        </div>

        <div class="section">
            <h2>Variable Types</h2>
            <ul>
                <li><strong>string</strong> - Text input</li>
                <li><strong>number</strong> - Numeric input</li>
                <li><strong>boolean</strong> - True/false checkbox</li>
                <li><strong>date</strong> - Date picker (YYYY-MM-DD)</li>
                <li><strong>select</strong> - Dropdown with predefined options</li>
            </ul>
        </div>

        <div class="section">
            <h2>Creating Custom Templates</h2>
            <p>You can create your own templates by:</p>
            <ol>
                <li>Using the Template Editor in the sidebar</li>
                <li>Importing existing template files</li>
                <li>Copying and modifying existing templates</li>
            </ol>
        </div>

        <div class="section">
            <h2>Need Help?</h2>
            <p>For any specific template, use the "Show Help" option to see detailed usage instructions, examples, and troubleshooting tips.</p>
        </div>
    </body>
    </html>
    `;
  }
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}