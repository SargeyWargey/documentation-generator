import * as vscode from 'vscode';
import * as path from 'path';
import { FolderContext } from '../utils/FolderAnalyzer';
import { Template } from '../templates/TemplateManager';
import { MCPClient } from './MCPClient';

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
  private mcpClient?: MCPClient;

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
      // Get the MCP server path from configuration
      const serverPath = this.getMCPServerPath();

      if (!serverPath) {
        throw new Error('MCP server path not configured');
      }

      // Start the MCP client to communicate with the standalone server
      this.mcpClient = new MCPClient(serverPath);

      // Set up event handlers
      this.mcpClient.on('error', (error) => {
        vscode.window.showErrorMessage(`MCP Server error: ${error.message}`);
      });

      this.mcpClient.on('exit', (code, _signal) => {
        this.isRunning = false;
        if (code !== 0) {
          vscode.window.showWarningMessage(`MCP Server exited with code ${code}`);
        }
      });

      this.mcpClient.on('initialized', () => {
        vscode.window.showInformationMessage(
          'Documentation Generator MCP Server connected successfully'
        );
      });

      await this.mcpClient.start();
      this.isRunning = true;

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
      if (this.mcpClient) {
        await this.mcpClient.stop();
        this.mcpClient = undefined;
      }

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
    if (this.mcpClient && this.isRunning) {
      try {
        // Get resources from the MCP server
        const resources = await this.mcpClient.listResources();
        return resources.map(resource => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description || '',
          mimeType: resource.mimeType || 'application/json',
        }));
      } catch (error) {
        console.warn('Failed to get resources from MCP server:', error);
      }
    }

    // Fallback to local providers
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
    if (this.mcpClient && this.isRunning) {
      try {
        const result = await this.mcpClient.readResource(uri);
        return result.contents;
      } catch (error) {
        console.warn('Failed to get resource content from MCP server:', error);
      }
    }

    // Fallback to local providers
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

  /**
   * Get MCP server path from configuration
   */
  private getMCPServerPath(): string | undefined {
    const config = vscode.workspace.getConfiguration('documentationGenerator');
    const serverPath = config.get<string>('mcpServerPath');

    if (serverPath) {
      return serverPath;
    }

    // Try to find the server in the extension directory
    const extensionPath = vscode.extensions.getExtension('your-publisher.documentation-generator')?.extensionPath;
    if (extensionPath) {
      return path.join(extensionPath, 'mcp-server', 'dist', 'index.js');
    }

    return undefined;
  }

  /**
   * Analyze folder using MCP server
   */
  async analyzeFolder(_folderPath: string, _excludePatterns?: string[]): Promise<any> {
    if (!this.mcpClient || !this.isRunning) {
      throw new Error('MCP server not running');
    }

    // This would call the analyze_folder tool on the MCP server
    // For now, we'll fallback to local analysis
    const provider = this.getProvider<FolderContextProvider>('folder-context');
    if (provider) {
      // This is a simplified approach - in reality, you'd send tool calls to the MCP server
      return provider; // Return the provider for now
    }

    throw new Error('No folder analysis provider available');
  }

  /**
   * Sync folder context with MCP server
   */
  async syncFolderContext(context: FolderContext): Promise<void> {
    if (this.mcpClient && this.isRunning) {
      try {
        // In a real implementation, this would send the context to the MCP server
        // using a tool call like update_folder_context
        console.log('Syncing folder context with MCP server:', context.folderPath);
      } catch (error) {
        console.warn('Failed to sync folder context with MCP server:', error);
      }
    }

    // Always update local provider as fallback
    this.updateFolderContext(context);
  }

  /**
   * Sync templates with MCP server
   */
  async syncTemplates(templates: Template[]): Promise<void> {
    if (this.mcpClient && this.isRunning) {
      try {
        // In a real implementation, this would sync templates with the MCP server
        console.log('Syncing templates with MCP server:', templates.length);
      } catch (error) {
        console.warn('Failed to sync templates with MCP server:', error);
      }
    }

    // Always update local provider as fallback
    this.updateTemplates(templates);
  }

  /**
   * Get MCP client for direct access
   */
  getMCPClient(): MCPClient | undefined {
    return this.mcpClient;
  }
}
