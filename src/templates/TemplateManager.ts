import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

export interface TemplateMetadata {
  name: string;
  description: string;
  author?: string;
  version?: string;
  category?: string;
  tags?: string[];
  variables?: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'select';
  required?: boolean;
  default?: any;
  options?: string[]; // For select type
  validation?: {
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
    pattern?: string;
  };
}

export interface Template {
  id: string;
  metadata: TemplateMetadata;
  content: string;
  filePath: string;
}

export class TemplateManager {
  private templates: Map<string, Template> = new Map();
  private readonly defaultTemplatesPath: string;
  private readonly userTemplatesPath: string;

  constructor(extensionContext: vscode.ExtensionContext) {
    this.defaultTemplatesPath = path.join(
      extensionContext.extensionPath,
      'templates'
    );

    // Create global storage URI if it doesn't exist
    const globalStoragePath =
      extensionContext.globalStorageUri?.fsPath ||
      path.join(extensionContext.extensionPath, '.storage', 'global');

    this.userTemplatesPath = path.join(globalStoragePath, 'templates');
  }

  /**
   * Initialize the template manager by loading all available templates
   */
  async initialize(): Promise<void> {
    await this.ensureDirectoriesExist();
    await this.loadDefaultTemplates();
    await this.loadUserTemplates();
  }

  /**
   * Get all available templates
   */
  getTemplates(): Template[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(id: string): Template | undefined {
    return this.templates.get(id);
  }

  /**
   * Get templates filtered by category
   */
  getTemplatesByCategory(category: string): Template[] {
    return this.getTemplates().filter(
      (template) => template.metadata.category === category
    );
  }

  /**
   * Search templates by name, description, or tags
   */
  searchTemplates(query: string): Template[] {
    const lowercaseQuery = query.toLowerCase();
    return this.getTemplates().filter((template) => {
      const metadata = template.metadata;
      return (
        metadata.name.toLowerCase().includes(lowercaseQuery) ||
        metadata.description.toLowerCase().includes(lowercaseQuery) ||
        metadata.tags?.some((tag) => tag.toLowerCase().includes(lowercaseQuery))
      );
    });
  }

  /**
   * Process a template with given variables
   */
  async processTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Promise<string> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template with ID '${templateId}' not found`);
    }

    // Validate required variables
    const missingVariables = this.validateRequiredVariables(
      template,
      variables
    );
    if (missingVariables.length > 0) {
      throw new Error(
        `Missing required variables: ${missingVariables.join(', ')}`
      );
    }

    return this.substituteVariables(template.content, variables);
  }

  /**
   * Install a new template from file
   */
  async installTemplate(
    filePath: string,
    targetDirectory?: string
  ): Promise<Template> {
    const templateContent = await fs.readFile(filePath, 'utf-8');

    let parsedTemplate: Template;
    let contentToPersist = templateContent;

    try {
      parsedTemplate = await this.parseTemplate(templateContent, filePath);
    } catch (error) {
      console.warn(
        'TemplateManager: Unable to parse template frontmatter. Generating default metadata.',
        error
      );
      parsedTemplate = this.createTemplateFromBareMarkdown(
        path.basename(filePath, path.extname(filePath)),
        templateContent
      );
      contentToPersist = this.serializeTemplate(parsedTemplate);
    }

    const targetPath = targetDirectory || this.userTemplatesPath;
    const uniqueId = this.generateUniqueTemplateId(parsedTemplate.id);
    const targetFile = path.join(targetPath, `${uniqueId}.md`);

    const templateToSave: Template = {
      ...parsedTemplate,
      id: uniqueId,
      filePath: targetFile,
    };

    const finalContent =
      contentToPersist.trim().startsWith('---') && parsedTemplate.id === uniqueId
        ? contentToPersist
        : this.serializeTemplate(templateToSave);

    await fs.writeFile(targetFile, finalContent);
    this.templates.set(uniqueId, templateToSave);
    return templateToSave;
  }

  /**
   * Remove a template
   */
  async removeTemplate(templateId: string): Promise<void> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template with ID '${templateId}' not found`);
    }

    // Don't allow removal of default templates
    if (template.filePath.startsWith(this.defaultTemplatesPath)) {
      throw new Error('Cannot remove default templates');
    }

    await fs.unlink(template.filePath);
    this.templates.delete(templateId);
  }

  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<Map<string, Template>> {
    return new Map(this.templates);
  }

  /**
   * Save a template (create or update)
   */
  async saveTemplate(template: Template): Promise<void> {
    // Validate template before saving
    this.validateTemplateForSaving(template);

    await this.ensureDirectoriesExist();

    const isUpdate = this.templates.has(template.id);
    const candidateId = template.id || template.metadata.name || 'template';
    const finalId = isUpdate
      ? template.id
      : this.generateUniqueTemplateId(candidateId);

    const finalTemplate: Template = {
      ...template,
      id: finalId,
    };

    const templateContent = this.serializeTemplate(finalTemplate);
    const fileName = `${finalId}.md`;
    const targetFile = path.join(this.userTemplatesPath, fileName);

    await fs.writeFile(targetFile, templateContent);
    this.templates.set(finalId, { ...finalTemplate, filePath: targetFile });
  }

  /**
   * Validate template structure and content
   */
  private validateTemplateForSaving(template: Template): void {
    const validation = this.validateTemplate(template);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    if (!template.id || template.id.trim() === '') {
      throw new Error('Template ID is required');
    }

    if (!template.content || template.content.trim() === '') {
      throw new Error('Template content is required');
    }

    // Validate template variables syntax
    const variablePattern = /\{\{(\w+)\}\}/g;
    const matches = template.content.match(variablePattern);
    if (matches) {
      for (const match of matches) {
        const varName = match.replace(/\{\{|\}\}/g, '');
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
          throw new Error(
            `Invalid variable name: ${varName}. Variable names must start with a letter or underscore and contain only letters, numbers, and underscores.`
          );
        }
      }
    }

    // Validate version format if provided
    if (
      template.metadata.version &&
      !/^\d+\.\d+\.\d+$/.test(template.metadata.version)
    ) {
      throw new Error(
        'Version must be in semantic versioning format (e.g., 1.0.0)'
      );
    }
  }

  /**
   * Extract variables from template content
   */
  extractTemplateVariables(content: string): string[] {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      const varName = match[1];
      if (!variables.includes(varName)) {
        variables.push(varName);
      }
    }

    return variables;
  }

  /**
   * Delete a template (alias for removeTemplate)
   */
  async deleteTemplate(templateId: string): Promise<void> {
    return this.removeTemplate(templateId);
  }

  /**
   * Serialize template to file format
   */
  private serializeTemplate(template: Template): string {
    const frontmatter = `---
name: ${template.metadata.name}
description: ${template.metadata.description || ''}
author: ${template.metadata.author || ''}
version: ${template.metadata.version || '1.0.0'}
category: ${template.metadata.category || ''}
tags: ${template.metadata.tags ? template.metadata.tags.join(', ') : ''}
---

${template.content}`;

    return frontmatter;
  }

  private async ensureDirectoriesExist(): Promise<void> {
    try {
      await fs.mkdir(this.userTemplatesPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async loadDefaultTemplates(): Promise<void> {
    try {
      console.log(
        `TemplateManager: Loading default templates from ${this.defaultTemplatesPath}`
      );

      // Check if directory exists first
      try {
        await fs.access(this.defaultTemplatesPath);
        console.log(`TemplateManager: Default templates directory exists`);
      } catch (error) {
        console.warn(
          `TemplateManager: Default templates directory not accessible: ${error}`
        );
        await this.createDefaultTemplates();
        return;
      }

      const initialCount = this.templates.size;
      await this.loadTemplatesFromDirectory(this.defaultTemplatesPath);
      const newCount = this.templates.size;
      console.log(
        `TemplateManager: Loaded ${newCount - initialCount} templates from default directory (total: ${newCount})`
      );

      // If no templates were loaded from the directory, create defaults
      if (newCount === initialCount) {
        console.log(
          'TemplateManager: No valid templates found in default directory, creating basic templates'
        );
        await this.createDefaultTemplates();
      }
    } catch (error) {
      console.warn(
        `TemplateManager: Error loading default templates: ${error}, creating basic templates`
      );
      await this.createDefaultTemplates();
    }
  }

  private async loadUserTemplates(): Promise<void> {
    try {
      await this.loadTemplatesFromDirectory(this.userTemplatesPath);
    } catch (error) {
      // User templates directory might not exist yet
    }
  }

  private async loadTemplatesFromDirectory(directory: string): Promise<void> {
    try {
      console.log(
        `TemplateManager: Scanning directory ${directory} for templates`
      );
      const files = await fs.readdir(directory);
      console.log(
        `TemplateManager: Found ${files.length} files in directory: ${files.join(', ')}`
      );

      const templateFiles = files.filter(
        (file) =>
          file.endsWith('.md') &&
          !file.toLowerCase().startsWith('readme') &&
          !file.toLowerCase().startsWith('license') &&
          !file.toLowerCase().startsWith('changelog')
      );

      console.log(
        `TemplateManager: Found ${templateFiles.length} potential template files: ${templateFiles.join(', ')}`
      );

      for (const file of templateFiles) {
        const filePath = path.join(directory, file);
        try {
          console.log(
            `TemplateManager: Attempting to load template from ${filePath}`
          );
          const content = await fs.readFile(filePath, 'utf-8');

          // Check if file has frontmatter before parsing
          if (!content.trim().startsWith('---')) {
            console.log(
              `TemplateManager: Skipping ${file} - not a template file (no frontmatter)`
            );
            continue;
          }

          const template = await this.parseTemplate(content, filePath);
          this.templates.set(template.id, template);
          console.log(
            `TemplateManager: Successfully loaded template "${template.metadata.name}" with ID "${template.id}"`
          );
        } catch (error) {
          console.warn(
            `TemplateManager: Failed to load template from ${filePath}:`,
            error
          );
        }
      }
    } catch (error) {
      throw new Error(`Failed to load templates from ${directory}: ${error}`);
    }
  }

  private async parseTemplate(
    content: string,
    filePath: string
  ): Promise<Template> {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      throw new Error('Template must have frontmatter metadata');
    }

    const [, frontmatter, templateContent] = frontmatterMatch;
    const metadata = this.parseFrontmatter(frontmatter);

    const id = path.basename(filePath, '.md');

    return {
      id,
      metadata,
      content: templateContent,
      filePath,
    };
  }

  private parseFrontmatter(frontmatter: string): TemplateMetadata {
    const lines = frontmatter.split('\n');
    const metadata: any = {};

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();

        // Handle special cases
        if (key.trim() === 'tags' || key.trim() === 'variables') {
          try {
            metadata[key.trim()] = JSON.parse(value);
          } catch {
            metadata[key.trim()] = value.split(',').map((v) => v.trim());
          }
        } else {
          metadata[key.trim()] = value;
        }
      }
    }

    return metadata as TemplateMetadata;
  }

  public generateUniqueTemplateId(baseName: string): string {
    const sanitizedBase = this.sanitizeTemplateId(baseName);

    if (!this.templates.has(sanitizedBase)) {
      return sanitizedBase;
    }

    let counter = 1;
    let candidate = `${sanitizedBase}-${counter}`;
    while (this.templates.has(candidate)) {
      counter += 1;
      candidate = `${sanitizedBase}-${counter}`;
    }

    return candidate;
  }

  private sanitizeTemplateId(value: string): string {
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || `template-${Date.now()}`;
  }

  private toTitleCase(value: string): string {
    return value
      .split(/\s+|-/)
      .filter((part) => part.length > 0)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private createTemplateFromBareMarkdown(
    baseName: string,
    fileContent: string
  ): Template {
    const firstHeadingMatch = fileContent.match(/^#\s+(.+)$/m);
    const inferredName = firstHeadingMatch
      ? firstHeadingMatch[1].trim()
      : this.toTitleCase(baseName);

    const metadata: TemplateMetadata = {
      name: inferredName,
      description: `Imported template from ${inferredName}`,
      author: 'Imported',
      version: '1.0.0',
      category: 'imported',
      tags: ['imported'],
    };

    return {
      id: baseName,
      metadata,
      content: fileContent,
      filePath: '',
    };
  }

  private validateRequiredVariables(
    template: Template,
    variables: Record<string, any>
  ): string[] {
    const missingVariables: string[] = [];

    if (template.metadata.variables) {
      for (const variable of template.metadata.variables) {
        if (variable.required && !(variable.name in variables)) {
          missingVariables.push(variable.name);
        }
      }
    }

    return missingVariables;
  }

  private substituteVariables(
    content: string,
    variables: Record<string, any>
  ): string {
    let result = content;

    // Add common variables
    const now = new Date();
    const commonVariables = {
      currentDate: now.toLocaleDateString(),
      currentDateTime: now.toLocaleString(),
      currentYear: now.getFullYear().toString(),
      nextReviewDate: new Date(
        now.setMonth(now.getMonth() + 3)
      ).toLocaleDateString(),
      ...variables,
    };

    // Process array iterations {{#arrayName}}...{{/arrayName}}
    result = this.processArrayIterations(result, commonVariables);

    // Process conditionals {{#if condition}}...{{/if}}
    result = this.processConditionals(result, commonVariables);

    // Replace simple {{variable}} patterns
    for (const [key, value] of Object.entries(commonVariables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value || ''));
    }

    // Process analysis data patterns {{analysis.property}}
    result = this.processAnalysisData(result, commonVariables);

    // Clean up any remaining unprocessed template syntax
    result = this.cleanupUnprocessedSyntax(result);

    return result;
  }

  private processArrayIterations(
    content: string,
    variables: Record<string, any>
  ): string {
    let result = content;

    // Match {{#arrayName}}...{{/arrayName}} patterns
    const arrayPattern = /{{#(\w+)}}([\s\S]*?){{\/\1}}/g;
    let match;

    while ((match = arrayPattern.exec(content)) !== null) {
      const [fullMatch, arrayName, template] = match;
      const arrayData = variables[arrayName];

      if (Array.isArray(arrayData)) {
        let replacement = '';
        arrayData.forEach((item, index) => {
          let itemContent = template;

          // Handle objects in array
          if (typeof item === 'object' && item !== null) {
            for (const [key, value] of Object.entries(item)) {
              const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
              itemContent = itemContent.replace(regex, String(value || ''));
            }
          } else {
            // Handle simple values
            itemContent = itemContent.replace(/{{\.}}/g, String(item));
          }

          // Add index support
          itemContent = itemContent.replace(/{{@index}}/g, String(index + 1));
          itemContent = itemContent.replace(/{{@index0}}/g, String(index));

          replacement += itemContent;
        });
        result = result.replace(fullMatch, replacement);
      } else {
        // Remove the block if no array data
        result = result.replace(fullMatch, '');
      }
    }

    return result;
  }

  private processConditionals(
    content: string,
    variables: Record<string, any>
  ): string {
    let result = content;

    // Match {{#if condition}}...{{/if}} patterns with optional {{else}}
    const conditionalPattern =
      /{{#if\s+(\w+)}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/if}}/g;
    let match;

    while ((match = conditionalPattern.exec(content)) !== null) {
      const [fullMatch, condition, ifContent, elseContent = ''] = match;
      const conditionValue = variables[condition];

      let replacement = '';
      if (this.isTruthy(conditionValue)) {
        replacement = ifContent;
      } else {
        replacement = elseContent;
      }

      result = result.replace(fullMatch, replacement);
    }

    return result;
  }

  private processAnalysisData(
    content: string,
    variables: Record<string, any>
  ): string {
    let result = content;

    // Handle {{analysis.property}} patterns
    const analysisPattern = /{{analysis\.(\w+)}}/g;
    let match;

    while ((match = analysisPattern.exec(content)) !== null) {
      const [fullMatch, property] = match;
      const analysisData = variables.analysis || {};
      const value = analysisData[property] || '';
      result = result.replace(fullMatch, String(value));
    }

    return result;
  }

  private cleanupUnprocessedSyntax(content: string): string {
    // Remove any remaining unprocessed template syntax
    return content
      .replace(/{{#\w+}}[\s\S]*?{{\/\w+}}/g, '') // Unprocessed array iterations
      .replace(/{{#if\s+\w+}}[\s\S]*?{{\/if}}/g, '') // Unprocessed conditionals
      .replace(/{{[^}]+}}/g, ''); // Any other unprocessed variables
  }

  private isTruthy(value: any): boolean {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return Boolean(value);
  }

  /**
   * Load a template by type/ID
   */
  async loadTemplate(templateType: string): Promise<Template | null> {
    const template = this.getTemplate(templateType);
    if (template) {
      return template;
    }

    // Try to load from file if not in cache
    const templatePath = path.join(
      this.defaultTemplatesPath,
      `${templateType}.md`
    );
    try {
      const content = await fs.readFile(templatePath, 'utf-8');
      const parsedTemplate = await this.parseTemplate(content, templatePath);
      this.templates.set(parsedTemplate.id, parsedTemplate);
      return parsedTemplate;
    } catch {
      return null;
    }
  }

  /**
   * Process template content with variables
   */
  async processTemplateContent(
    content: string,
    variables: Record<string, any>
  ): Promise<string> {
    return this.substituteVariables(content, variables);
  }

  /**
   * Validate template structure and metadata
   */
  validateTemplate(template: Template): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.metadata.name) {
      errors.push('Template name is required');
    }

    if (!template.metadata.description) {
      errors.push('Template description is required');
    }

    if (!template.metadata.category) {
      errors.push('Template category is required');
    }

    if (template.metadata.variables) {
      for (const variable of template.metadata.variables) {
        if (!variable.name) {
          errors.push('Variable name is required');
        }
        if (!variable.type) {
          errors.push(`Variable type is required for ${variable.name}`);
        }
        if (
          variable.type === 'select' &&
          (!variable.options || variable.options.length === 0)
        ) {
          errors.push(`Select variable ${variable.name} must have options`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get template variables with their metadata
   */
  getTemplateVariables(templateType: string): TemplateVariable[] {
    const template = this.getTemplate(templateType);
    return template?.metadata.variables || [];
  }

  private async createDefaultTemplates(): Promise<void> {
    await fs.mkdir(this.defaultTemplatesPath, { recursive: true });

    const basicTemplate = `---
name: Basic Documentation
description: A simple documentation template
category: general
variables: [{"name": "title", "description": "Document title", "type": "string", "required": true}]
---

# {{title}}

## Overview

Brief description of the project or feature.

## Getting Started

Instructions for getting started.

## API Reference

Document your APIs here.

## Examples

Provide examples and usage scenarios.

---
*Generated on {{date}}*
`;

    await fs.writeFile(
      path.join(this.defaultTemplatesPath, 'basic-documentation.md'),
      basicTemplate
    );
  }
}
