#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { ResourceManager } from './resources/ResourceManager.js';
import { FolderAnalysisProvider } from './resources/FolderAnalysisProvider.js';
import { TemplateProvider } from './resources/TemplateProvider.js';
import { ConfigurationProvider } from './resources/ConfigurationProvider.js';
import { RecentGenerationsProvider } from './resources/RecentGenerationsProvider.js';
import { ProjectMetadataProvider } from './resources/ProjectMetadataProvider.js';
import { Logger } from './utils/Logger.js';

class DocumentationGeneratorMCPServer {
  private server: Server;
  private resourceManager: ResourceManager;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('DocumentationGeneratorMCP');
    this.server = new Server(
      {
        name: 'documentation-generator',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.resourceManager = new ResourceManager(this.logger);
    this.setupServer();
  }

  private setupServer(): void {
    // Register resource providers
    this.resourceManager.registerProvider('folder-analysis', new FolderAnalysisProvider());
    this.resourceManager.registerProvider('templates', new TemplateProvider());
    this.resourceManager.registerProvider('configuration', new ConfigurationProvider());
    this.resourceManager.registerProvider('recent-generations', new RecentGenerationsProvider());
    this.resourceManager.registerProvider('project-metadata', new ProjectMetadataProvider());

    // Set up request handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const resources = await this.resourceManager.listResources();
        return { resources };
      } catch (error) {
        this.logger.error('Failed to list resources:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to list resources: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const { uri } = request.params;
        const content = await this.resourceManager.readResource(uri);

        return {
          contents: [
            {
              uri,
              mimeType: this.getMimeType(uri),
              text: content,
            },
          ],
        };
      } catch (error) {
        this.logger.error(`Failed to read resource ${request.params.uri}:`, error);
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'analyze_folder',
            description: 'Analyze a folder structure and extract context information',
            inputSchema: {
              type: 'object',
              properties: {
                folderPath: {
                  type: 'string',
                  description: 'Path to the folder to analyze',
                },
                excludePatterns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Patterns to exclude from analysis',
                  default: ['node_modules', '.git', 'dist', 'build'],
                },
              },
              required: ['folderPath'],
            },
          },
          {
            name: 'update_folder_context',
            description: 'Update the context for a specific folder',
            inputSchema: {
              type: 'object',
              properties: {
                folderPath: {
                  type: 'string',
                  description: 'Path to the folder',
                },
                context: {
                  type: 'object',
                  description: 'Context data to update',
                },
              },
              required: ['folderPath', 'context'],
            },
          },
          {
            name: 'add_template',
            description: 'Add or update a template',
            inputSchema: {
              type: 'object',
              properties: {
                templateId: {
                  type: 'string',
                  description: 'Unique identifier for the template',
                },
                template: {
                  type: 'object',
                  description: 'Template data',
                },
              },
              required: ['templateId', 'template'],
            },
          },
          {
            name: 'record_generation',
            description: 'Record a documentation generation event',
            inputSchema: {
              type: 'object',
              properties: {
                record: {
                  type: 'object',
                  description: 'Generation record data',
                },
              },
              required: ['record'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'analyze_folder':
            return await this.handleAnalyzeFolder(args as any);
          case 'update_folder_context':
            return await this.handleUpdateFolderContext(args as any);
          case 'add_template':
            return await this.handleAddTemplate(args as any);
          case 'record_generation':
            return await this.handleRecordGeneration(args as any);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error(`Tool execution failed for ${request.params.name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  private async handleAnalyzeFolder(args: { folderPath: string; excludePatterns?: string[] }) {
    const provider = this.resourceManager.getProvider('folder-analysis') as FolderAnalysisProvider;
    const context = await provider.analyzeFolder(args.folderPath, args.excludePatterns);

    return {
      content: [
        {
          type: 'text',
          text: `Folder analysis completed for: ${args.folderPath}\n\nAnalysis Summary:\n${JSON.stringify(context, null, 2)}`,
        },
      ],
    };
  }

  private async handleUpdateFolderContext(args: { folderPath: string; context: any }) {
    const provider = this.resourceManager.getProvider('folder-analysis') as FolderAnalysisProvider;
    await provider.updateContext(args.folderPath, args.context);

    return {
      content: [
        {
          type: 'text',
          text: `Folder context updated for: ${args.folderPath}`,
        },
      ],
    };
  }

  private async handleAddTemplate(args: { templateId: string; template: any }) {
    const provider = this.resourceManager.getProvider('templates') as TemplateProvider;
    await provider.addTemplate(args.templateId, args.template);

    return {
      content: [
        {
          type: 'text',
          text: `Template added/updated: ${args.templateId}`,
        },
      ],
    };
  }

  private async handleRecordGeneration(args: { record: any }) {
    const provider = this.resourceManager.getProvider('recent-generations') as RecentGenerationsProvider;
    await provider.addRecord(args.record);

    return {
      content: [
        {
          type: 'text',
          text: `Generation record added: ${args.record.id || 'unnamed'}`,
        },
      ],
    };
  }

  private getMimeType(uri: string): string {
    if (uri.includes('template://')) {
      return 'text/markdown';
    }
    if (uri.includes('-metadata://') || uri.includes('config://') || uri.includes('generation://')) {
      return 'application/json';
    }
    if (uri.includes('file-content://')) {
      const ext = path.extname(uri).toLowerCase();
      switch (ext) {
        case '.json':
          return 'application/json';
        case '.md':
        case '.markdown':
          return 'text/markdown';
        case '.js':
        case '.ts':
          return 'text/javascript';
        case '.html':
          return 'text/html';
        case '.css':
          return 'text/css';
        default:
          return 'text/plain';
      }
    }
    return 'application/json';
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('Documentation Generator MCP Server started');
  }
}

// Start the server
const server = new DocumentationGeneratorMCPServer();
server.run().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});