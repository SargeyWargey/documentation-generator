import { Resource } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { ResourceProvider } from './ResourceManager.js';

export interface Template {
  id: string;
  metadata: TemplateMetadata;
  content: string;
}

export interface TemplateMetadata {
  name: string;
  description: string;
  category: string;
  version: string;
  variables: TemplateVariable[];
  author?: string;
  tags?: string[];
  created?: Date;
  updated?: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  options?: string[];
}

export class TemplateProvider implements ResourceProvider {
  name = 'templates';
  private templates = new Map<string, Template>();

  async getResources(): Promise<Resource[]> {
    const resources: Resource[] = [];

    for (const [id, template] of this.templates.entries()) {
      resources.push({
        uri: `template://${encodeURIComponent(id)}`,
        name: template.metadata.name,
        description: template.metadata.description,
        mimeType: 'text/markdown',
      });

      // Add template metadata as separate resource
      resources.push({
        uri: `template-metadata://${encodeURIComponent(id)}`,
        name: `${template.metadata.name} Metadata`,
        description: `Metadata for ${template.metadata.name} template`,
        mimeType: 'application/json',
      });
    }

    return resources;
  }

  async readResource(uri: string): Promise<string> {
    if (uri.startsWith('template://')) {
      const id = decodeURIComponent(uri.replace('template://', ''));
      const template = this.templates.get(id);

      if (!template) {
        throw new Error(`Template not found: ${id}`);
      }

      return template.content;
    }

    if (uri.startsWith('template-metadata://')) {
      const id = decodeURIComponent(uri.replace('template-metadata://', ''));
      const template = this.templates.get(id);

      if (!template) {
        throw new Error(`Template not found: ${id}`);
      }

      return JSON.stringify(template.metadata, null, 2);
    }

    throw new Error(`Unsupported resource URI: ${uri}`);
  }

  async addTemplate(templateId: string, templateData: Template): Promise<void> {
    this.templates.set(templateId, templateData);
  }

  async removeTemplate(templateId: string): Promise<void> {
    this.templates.delete(templateId);
  }

  getTemplates(): Template[] {
    return Array.from(this.templates.values());
  }

  getTemplate(templateId: string): Template | undefined {
    return this.templates.get(templateId);
  }

  async loadTemplatesFromDirectory(templatesDir: string): Promise<void> {
    try {
      const entries = await fs.readdir(templatesDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const templatePath = path.join(templatesDir, entry.name);
          await this.loadTemplateFromFile(templatePath);
        }
      }
    } catch (error) {
      console.warn(`Failed to load templates from directory ${templatesDir}:`, error);
    }
  }

  private async loadTemplateFromFile(templatePath: string): Promise<void> {
    try {
      const content = await fs.readFile(templatePath, 'utf-8');
      const template = this.parseTemplate(content, path.basename(templatePath, '.md'));

      if (template) {
        this.templates.set(template.id, template);
      }
    } catch (error) {
      console.warn(`Failed to load template from ${templatePath}:`, error);
    }
  }

  private parseTemplate(content: string, filename: string): Template | null {
    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      // No frontmatter, create basic template
      return {
        id: filename,
        metadata: {
          name: filename,
          description: 'Template without metadata',
          category: 'uncategorized',
          version: '1.0.0',
          variables: [],
        },
        content: content,
      };
    }

    try {
      const frontmatter = this.parseFrontmatter(frontmatterMatch[1]);
      const templateContent = frontmatterMatch[2];

      const metadata: TemplateMetadata = {
        name: frontmatter.name || filename,
        description: frontmatter.description || '',
        category: frontmatter.category || 'uncategorized',
        version: frontmatter.version || '1.0.0',
        variables: this.parseVariables(frontmatter.variables || []),
        author: frontmatter.author,
        tags: frontmatter.tags || [],
        created: frontmatter.created ? new Date(frontmatter.created) : new Date(),
        updated: frontmatter.updated ? new Date(frontmatter.updated) : new Date(),
      };

      return {
        id: frontmatter.id || filename,
        metadata,
        content: templateContent,
      };
    } catch (error) {
      console.warn(`Failed to parse template metadata for ${filename}:`, error);
      return null;
    }
  }

  private parseFrontmatter(frontmatter: string): any {
    const result: any = {};
    const lines = frontmatter.split('\n');

    let currentKey = '';
    let currentValue = '';
    let inArray = false;
    let arrayItems: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) continue;

      if (trimmed.startsWith('- ') && inArray) {
        arrayItems.push(trimmed.substring(2));
        continue;
      }

      if (inArray && currentKey) {
        result[currentKey] = arrayItems;
        inArray = false;
        arrayItems = [];
      }

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        currentKey = trimmed.substring(0, colonIndex).trim();
        currentValue = trimmed.substring(colonIndex + 1).trim();

        if (currentValue === '') {
          // Might be start of array or multiline value
          inArray = true;
          arrayItems = [];
        } else if (currentValue.startsWith('[') && currentValue.endsWith(']')) {
          // Inline array
          const arrayContent = currentValue.substring(1, currentValue.length - 1);
          result[currentKey] = arrayContent.split(',').map(item => item.trim().replace(/['"]/g, ''));
        } else {
          // Simple value
          result[currentKey] = currentValue.replace(/['"]/g, '');
        }
      }
    }

    if (inArray && currentKey) {
      result[currentKey] = arrayItems;
    }

    return result;
  }

  private parseVariables(variablesData: any[]): TemplateVariable[] {
    if (!Array.isArray(variablesData)) {
      return [];
    }

    return variablesData.map(variable => ({
      name: variable.name || '',
      type: variable.type || 'string',
      description: variable.description || '',
      required: variable.required !== false,
      default: variable.default,
      options: variable.options,
    }));
  }
}