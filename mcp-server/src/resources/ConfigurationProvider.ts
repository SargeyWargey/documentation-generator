import { Resource } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ResourceProvider } from './ResourceManager.js';

export interface Configuration {
  general: {
    outputDirectory: string;
    defaultTemplateCategory: string;
    excludePatterns: string[];
    maxFileSize: number;
    enableCaching: boolean;
  };
  claudeIntegration: {
    enableSlashCommands: boolean;
    enableMCPServer: boolean;
    commandsDirectory: string;
    maxCommandTimeout: number;
  };
  templates: {
    customTemplatesDirectory: string;
    enableTemplateValidation: boolean;
    autoDiscoverTemplates: boolean;
  };
  analysis: {
    enableDeepAnalysis: boolean;
    analyzeDocstrings: boolean;
    extractComments: boolean;
    detectPatterns: boolean;
  };
  ui: {
    enableSidebar: boolean;
    enableContextMenus: boolean;
    showProgressNotifications: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
}

export class ConfigurationProvider implements ResourceProvider {
  name = 'configuration';
  private config: Configuration;
  private configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), '.documentation-generator', 'config.json');
    this.config = this.getDefaultConfiguration();
  }

  async getResources(): Promise<Resource[]> {
    return [
      {
        uri: 'config://current',
        name: 'Current Configuration',
        description: 'Current configuration settings for the documentation generator',
        mimeType: 'application/json',
      },
      {
        uri: 'config://default',
        name: 'Default Configuration',
        description: 'Default configuration settings',
        mimeType: 'application/json',
      },
      {
        uri: 'config://schema',
        name: 'Configuration Schema',
        description: 'JSON schema for configuration validation',
        mimeType: 'application/json',
      },
    ];
  }

  async readResource(uri: string): Promise<string> {
    switch (uri) {
      case 'config://current':
        await this.loadConfiguration();
        return JSON.stringify(this.config, null, 2);

      case 'config://default':
        return JSON.stringify(this.getDefaultConfiguration(), null, 2);

      case 'config://schema':
        return JSON.stringify(this.getConfigurationSchema(), null, 2);

      default:
        throw new Error(`Unsupported resource URI: ${uri}`);
    }
  }

  async getConfiguration(): Promise<Configuration> {
    await this.loadConfiguration();
    return { ...this.config };
  }

  async updateConfiguration(updates: Partial<Configuration>): Promise<void> {
    await this.loadConfiguration();
    this.config = this.mergeConfigurations(this.config, updates);
    await this.saveConfiguration();
  }

  async resetToDefaults(): Promise<void> {
    this.config = this.getDefaultConfiguration();
    await this.saveConfiguration();
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(configContent);
      this.config = this.mergeConfigurations(this.getDefaultConfiguration(), loadedConfig);
    } catch (error) {
      // Config file doesn't exist or is invalid, use defaults
      this.config = this.getDefaultConfiguration();
    }
  }

  private async saveConfiguration(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.warn('Failed to save configuration:', error);
    }
  }

  private getDefaultConfiguration(): Configuration {
    return {
      general: {
        outputDirectory: path.join(os.homedir(), 'Documents', 'Generated Documentation'),
        defaultTemplateCategory: 'general',
        excludePatterns: [
          'node_modules',
          '.git',
          'dist',
          'build',
          '.next',
          '.vscode',
          'coverage',
          '*.log',
          '*.tmp',
        ],
        maxFileSize: 1024 * 1024, // 1MB
        enableCaching: true,
      },
      claudeIntegration: {
        enableSlashCommands: true,
        enableMCPServer: true,
        commandsDirectory: '.claude/commands',
        maxCommandTimeout: 60000, // 60 seconds
      },
      templates: {
        customTemplatesDirectory: path.join(os.homedir(), '.documentation-generator', 'templates'),
        enableTemplateValidation: true,
        autoDiscoverTemplates: true,
      },
      analysis: {
        enableDeepAnalysis: true,
        analyzeDocstrings: true,
        extractComments: true,
        detectPatterns: true,
      },
      ui: {
        enableSidebar: true,
        enableContextMenus: true,
        showProgressNotifications: true,
        theme: 'auto',
      },
    };
  }

  private mergeConfigurations(base: Configuration, updates: any): Configuration {
    const result = { ...base };

    for (const [key, value] of Object.entries(updates)) {
      if (key in result && typeof result[key as keyof Configuration] === 'object' && value && typeof value === 'object') {
        // Merge nested objects
        (result as any)[key] = { ...(result as any)[key], ...value };
      } else if (key in result) {
        // Replace primitive values
        (result as any)[key] = value;
      }
    }

    return result;
  }

  private getConfigurationSchema(): any {
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Documentation Generator Configuration',
      type: 'object',
      properties: {
        general: {
          type: 'object',
          properties: {
            outputDirectory: { type: 'string' },
            defaultTemplateCategory: { type: 'string' },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' },
            },
            maxFileSize: { type: 'number', minimum: 0 },
            enableCaching: { type: 'boolean' },
          },
          required: ['outputDirectory', 'defaultTemplateCategory', 'excludePatterns'],
        },
        claudeIntegration: {
          type: 'object',
          properties: {
            enableSlashCommands: { type: 'boolean' },
            enableMCPServer: { type: 'boolean' },
            commandsDirectory: { type: 'string' },
            maxCommandTimeout: { type: 'number', minimum: 1000 },
          },
          required: ['enableSlashCommands', 'enableMCPServer', 'commandsDirectory'],
        },
        templates: {
          type: 'object',
          properties: {
            customTemplatesDirectory: { type: 'string' },
            enableTemplateValidation: { type: 'boolean' },
            autoDiscoverTemplates: { type: 'boolean' },
          },
          required: ['customTemplatesDirectory'],
        },
        analysis: {
          type: 'object',
          properties: {
            enableDeepAnalysis: { type: 'boolean' },
            analyzeDocstrings: { type: 'boolean' },
            extractComments: { type: 'boolean' },
            detectPatterns: { type: 'boolean' },
          },
        },
        ui: {
          type: 'object',
          properties: {
            enableSidebar: { type: 'boolean' },
            enableContextMenus: { type: 'boolean' },
            showProgressNotifications: { type: 'boolean' },
            theme: {
              type: 'string',
              enum: ['light', 'dark', 'auto'],
            },
          },
        },
      },
      required: ['general', 'claudeIntegration', 'templates', 'analysis', 'ui'],
    };
  }
}