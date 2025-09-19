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
  type: 'string' | 'number' | 'boolean' | 'date' | 'select';
  required?: boolean;
  default?: any;
  options?: string[]; // For select type
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
    this.userTemplatesPath = path.join(
      extensionContext.globalStorageUri?.fsPath || '',
      'templates'
    );
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
  ): Promise<void> {
    const templateContent = await fs.readFile(filePath, 'utf-8');
    const template = await this.parseTemplate(templateContent, filePath);

    const targetPath = targetDirectory || this.userTemplatesPath;
    const targetFile = path.join(targetPath, `${template.id}.md`);

    await fs.writeFile(targetFile, templateContent);
    this.templates.set(template.id, { ...template, filePath: targetFile });
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

  private async ensureDirectoriesExist(): Promise<void> {
    try {
      await fs.mkdir(this.userTemplatesPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async loadDefaultTemplates(): Promise<void> {
    try {
      await this.loadTemplatesFromDirectory(this.defaultTemplatesPath);
    } catch (error) {
      console.warn(
        'Default templates directory not found, creating basic templates'
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
      const files = await fs.readdir(directory);
      const templateFiles = files.filter((file) => file.endsWith('.md'));

      for (const file of templateFiles) {
        const filePath = path.join(directory, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const template = await this.parseTemplate(content, filePath);
          this.templates.set(template.id, template);
        } catch (error) {
          console.warn(`Failed to load template from ${filePath}:`, error);
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

    // Replace {{variable}} patterns
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value));
    }

    // Add common variables
    const now = new Date();
    result = result.replace(/{{date}}/g, now.toLocaleDateString());
    result = result.replace(/{{datetime}}/g, now.toLocaleString());
    result = result.replace(/{{year}}/g, now.getFullYear().toString());

    return result;
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
