import * as vscode from 'vscode';
import { FolderContext } from '../utils/FolderAnalyzer';
import { Template } from '../templates/TemplateManager';

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface MCPResourceProvider {
  getResources(): Promise<MCPResource[]>;
  getResourceContent(uri: string): Promise<string>;
}

export interface MCPServerConfig {
  name: string;
  version: string;
  resources: string[];
  capabilities: string[];
}

export class FolderContextProvider implements MCPResourceProvider {
  private folderContexts: Map<string, FolderContext> = new Map();

  constructor() {}

  async getResources(): Promise<MCPResource[]> {
    const resources: MCPResource[] = [];

    for (const [path, context] of this.folderContexts.entries()) {
      resources.push({
        uri: `folder-context://${encodeURIComponent(path)}`,
        name: `${context.name} Context`,
        description: `Project context for ${context.name} (${context.projectType})`,
        mimeType: 'application/json',
      });

      // Add individual file resources for important files
      const importantFiles = context.files.filter(
        (f) =>
          f.name.toLowerCase().includes('readme') ||
          f.name.toLowerCase().includes('package.json') ||
          f.name.includes('main') ||
          f.name.includes('index')
      );

      for (const file of importantFiles.slice(0, 5)) {
        resources.push({
          uri: `file-content://${encodeURIComponent(path)}/${encodeURIComponent(file.path)}`,
          name: `${context.name}/${file.path}`,
          description: `File content: ${file.summary || file.name}`,
          mimeType:
            file.extension === '.json' ? 'application/json' : 'text/plain',
        });
      }
    }

    return resources;
  }

  async getResourceContent(uri: string): Promise<string> {
    if (uri.startsWith('folder-context://')) {
      const path = decodeURIComponent(uri.replace('folder-context://', ''));
      const context = this.folderContexts.get(path);

      if (!context) {
        throw new Error(`Folder context not found for path: ${path}`);
      }

      return JSON.stringify(this.serializeFolderContext(context), null, 2);
    }

    if (uri.startsWith('file-content://')) {
      const parts = uri.replace('file-content://', '').split('/');
      const folderPath = decodeURIComponent(parts[0]);
      const filePath = decodeURIComponent(parts.slice(1).join('/'));

      const context = this.folderContexts.get(folderPath);
      if (!context) {
        throw new Error(`Folder context not found for path: ${folderPath}`);
      }

      const file = context.files.find((f) => f.path === filePath);
      if (!file || !file.content) {
        throw new Error(`File content not found: ${filePath}`);
      }

      return file.content;
    }

    throw new Error(`Unsupported resource URI: ${uri}`);
  }

  addFolderContext(context: FolderContext): void {
    this.folderContexts.set(context.folderPath, context);
  }

  removeFolderContext(folderPath: string): void {
    this.folderContexts.delete(folderPath);
  }

  private serializeFolderContext(context: FolderContext) {
    return {
      folderPath: context.folderPath,
      name: context.name,
      projectType: context.projectType,
      totalFiles: context.totalFiles,
      totalLines: context.totalLines,
      summary: context.summary,
      dependencies: context.dependencies,
      documentation: {
        hasReadme: !!context.documentation.readme,
        hasChangelog: !!context.documentation.changelog,
        hasLicense: !!context.documentation.license,
        commentCount: context.documentation.comments.length,
        apiDocsCount: context.documentation.apiDocs.length,
      },
      codeStructure: {
        totalFunctions: Array.from(context.codeStructures.values()).reduce(
          (sum, structure) => sum + structure.functions.length,
          0
        ),
        totalClasses: Array.from(context.codeStructures.values()).reduce(
          (sum, structure) => sum + structure.classes.length,
          0
        ),
        totalInterfaces: Array.from(context.codeStructures.values()).reduce(
          (sum, structure) => sum + structure.interfaces.length,
          0
        ),
        fileCount: context.codeStructures.size,
      },
      importantFiles: context.files
        .filter(
          (f) =>
            f.name.toLowerCase().includes('readme') ||
            f.name.toLowerCase().includes('package.json') ||
            f.name.includes('main') ||
            f.name.includes('index')
        )
        .slice(0, 10)
        .map((f) => ({
          path: f.path,
          name: f.name,
          size: f.size,
          summary: f.summary,
          lastModified: f.lastModified,
        })),
    };
  }
}

export class TemplateProvider implements MCPResourceProvider {
  private templates: Map<string, Template> = new Map();

  constructor() {}

  async getResources(): Promise<MCPResource[]> {
    const resources: MCPResource[] = [];

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

  async getResourceContent(uri: string): Promise<string> {
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

  addTemplate(template: Template): void {
    this.templates.set(template.id, template);
  }

  removeTemplate(templateId: string): void {
    this.templates.delete(templateId);
  }

  getTemplates(): Template[] {
    return Array.from(this.templates.values());
  }
}

export class RecentGenerationsProvider implements MCPResourceProvider {
  private generations: GenerationRecord[] = [];
  private readonly maxRecords = 50;

  constructor() {}

  async getResources(): Promise<MCPResource[]> {
    return this.generations.map((record) => ({
      uri: `generation://${record.id}`,
      name: `${record.templateName} - ${record.projectName}`,
      description: `Generated on ${record.timestamp.toLocaleDateString()} for ${record.projectName}`,
      mimeType: 'application/json',
    }));
  }

  async getResourceContent(uri: string): Promise<string> {
    const id = uri.replace('generation://', '');
    const record = this.generations.find((r) => r.id === id);

    if (!record) {
      throw new Error(`Generation record not found: ${id}`);
    }

    return JSON.stringify(record, null, 2);
  }

  addGeneration(record: GenerationRecord): void {
    this.generations.unshift(record);

    // Keep only the most recent records
    if (this.generations.length > this.maxRecords) {
      this.generations = this.generations.slice(0, this.maxRecords);
    }
  }

  getRecentGenerations(limit: number = 10): GenerationRecord[] {
    return this.generations.slice(0, limit);
  }
}

export interface GenerationRecord {
  id: string;
  templateId: string;
  templateName: string;
  projectName: string;
  projectPath: string;
  outputPath: string;
  timestamp: Date;
  success: boolean;
  error?: string;
  variables: Record<string, any>;
}

export class MCPServer {
  private config: MCPServerConfig;
  private providers: Map<string, MCPResourceProvider> = new Map();
  private isRunning = false;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    this.providers.set('folder-context', new FolderContextProvider());
    this.providers.set('templates', new TemplateProvider());
    this.providers.set('recent-generations', new RecentGenerationsProvider());
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // In a real implementation, this would start the MCP server process
      // For now, we'll just mark it as running
      this.isRunning = true;

      vscode.window.showInformationMessage(
        'Documentation Generator MCP Server started successfully'
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to start MCP Server: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // In a real implementation, this would stop the MCP server process
      this.isRunning = false;

      vscode.window.showInformationMessage(
        'Documentation Generator MCP Server stopped'
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to stop MCP Server: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  async getResources(): Promise<MCPResource[]> {
    const allResources: MCPResource[] = [];

    for (const [name, provider] of this.providers.entries()) {
      try {
        const resources = await provider.getResources();
        allResources.push(...resources);
      } catch (error) {
        console.warn(`Failed to get resources from provider ${name}:`, error);
      }
    }

    return allResources;
  }

  async getResourceContent(uri: string): Promise<string> {
    for (const [name, provider] of this.providers.entries()) {
      try {
        return await provider.getResourceContent(uri);
      } catch (error) {
        // Try next provider
        continue;
      }
    }

    throw new Error(`No provider found for resource URI: ${uri}`);
  }

  getProvider<T extends MCPResourceProvider>(name: string): T | undefined {
    return this.providers.get(name) as T;
  }

  addProvider(name: string, provider: MCPResourceProvider): void {
    this.providers.set(name, provider);
  }

  removeProvider(name: string): void {
    this.providers.delete(name);
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  getConfig(): MCPServerConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<MCPServerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update folder context in the provider
   */
  updateFolderContext(context: FolderContext): void {
    const provider = this.getProvider<FolderContextProvider>('folder-context');
    if (provider) {
      provider.addFolderContext(context);
    }
  }

  /**
   * Update templates in the provider
   */
  updateTemplates(templates: Template[]): void {
    const provider = this.getProvider<TemplateProvider>('templates');
    if (provider) {
      // Clear existing templates and add new ones
      for (const template of templates) {
        provider.addTemplate(template);
      }
    }
  }

  /**
   * Add a generation record
   */
  recordGeneration(record: GenerationRecord): void {
    const provider =
      this.getProvider<RecentGenerationsProvider>('recent-generations');
    if (provider) {
      provider.addGeneration(record);
    }
  }
}
