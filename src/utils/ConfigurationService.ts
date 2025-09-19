import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface WorkspaceConfiguration {
  // Template Settings
  defaultTemplate?: string;
  templateDirectories?: string[];
  customTemplatesPath?: string;

  // Output Settings
  outputDirectory?: string;
  outputNamingPattern?: string;
  createOutputFolders?: boolean;

  // Folder Analysis Settings
  excludePatterns?: string[];
  includePatterns?: string[];
  maxDepth?: number;
  maxFiles?: number;

  // Claude Integration Settings
  claudeIntegration?: {
    commandTimeout?: number;
    retryAttempts?: number;
    cleanupAfterExecution?: boolean;
    mcpServerEnabled?: boolean;
  };

  // Performance Settings
  cacheEnabled?: boolean;
  cacheTimeout?: number;
  parallelProcessing?: boolean;
  maxConcurrentOperations?: number;

  // User Preferences
  autoGenerateOnSave?: boolean;
  showPreviewBeforeGenerate?: boolean;
  confirmBeforeOverwrite?: boolean;
  enableTelemetry?: boolean;

  // Team Settings
  sharedTemplatesRepository?: string;
  teamConfigurationUrl?: string;
  syncWithTeam?: boolean;
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  notifications?: {
    success?: boolean;
    warnings?: boolean;
    errors?: boolean;
  };
  ui?: {
    sidebarPosition?: 'left' | 'right';
    showTips?: boolean;
    compactMode?: boolean;
  };
  shortcuts?: Record<string, string>;
}

export class ConfigurationService {
  private static instance: ConfigurationService;
  private workspaceConfig: WorkspaceConfiguration = {};
  private userPreferences: UserPreferences = {};
  private configWatcher?: vscode.FileSystemWatcher;

  constructor(private context: vscode.ExtensionContext) {
    this.initializeDefaults();
  }

  static getInstance(context?: vscode.ExtensionContext): ConfigurationService {
    if (!ConfigurationService.instance && context) {
      ConfigurationService.instance = new ConfigurationService(context);
    }
    return ConfigurationService.instance;
  }

  /**
   * Initialize the configuration service
   */
  async initialize(): Promise<void> {
    await this.loadWorkspaceConfiguration();
    await this.loadUserPreferences();
    this.setupConfigurationWatcher();
  }

  /**
   * Get workspace-specific configuration
   */
  getWorkspaceConfig(): WorkspaceConfiguration {
    return { ...this.workspaceConfig };
  }

  /**
   * Get user preferences
   */
  getUserPreferences(): UserPreferences {
    return { ...this.userPreferences };
  }

  /**
   * Update workspace configuration
   */
  async updateWorkspaceConfig(updates: Partial<WorkspaceConfiguration>): Promise<void> {
    this.workspaceConfig = { ...this.workspaceConfig, ...updates };
    await this.saveWorkspaceConfiguration();
    this.notifyConfigurationChanged();
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(updates: Partial<UserPreferences>): Promise<void> {
    this.userPreferences = { ...this.userPreferences, ...updates };
    await this.saveUserPreferences();
    this.notifyConfigurationChanged();
  }

  /**
   * Get a specific configuration value with fallback
   */
  get<T>(key: string, defaultValue?: T): T {
    // Check workspace config first
    const workspaceValue = this.getNestedValue(this.workspaceConfig, key);
    if (workspaceValue !== undefined) {
      return workspaceValue;
    }

    // Check user preferences
    const userValue = this.getNestedValue(this.userPreferences, key);
    if (userValue !== undefined) {
      return userValue;
    }

    // Check VS Code settings
    const vscodeConfig = vscode.workspace.getConfiguration('documentationGenerator');
    const vscodeValue = vscodeConfig.get<T>(key);
    if (vscodeValue !== undefined) {
      return vscodeValue;
    }

    return defaultValue as T;
  }

  /**
   * Set a configuration value
   */
  async set(key: string, value: any, scope: 'workspace' | 'user' | 'vscode' = 'workspace'): Promise<void> {
    switch (scope) {
      case 'workspace':
        this.setNestedValue(this.workspaceConfig, key, value);
        await this.saveWorkspaceConfiguration();
        break;
      case 'user':
        this.setNestedValue(this.userPreferences, key, value);
        await this.saveUserPreferences();
        break;
      case 'vscode':
        const config = vscode.workspace.getConfiguration('documentationGenerator');
        await config.update(key, value, vscode.ConfigurationTarget.Workspace);
        break;
    }
    this.notifyConfigurationChanged();
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(scope: 'workspace' | 'user' | 'all' = 'all'): Promise<void> {
    if (scope === 'workspace' || scope === 'all') {
      this.workspaceConfig = this.getDefaultWorkspaceConfig();
      await this.saveWorkspaceConfiguration();
    }

    if (scope === 'user' || scope === 'all') {
      this.userPreferences = this.getDefaultUserPreferences();
      await this.saveUserPreferences();
    }

    this.notifyConfigurationChanged();
  }

  /**
   * Import configuration from file
   */
  async importConfiguration(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(content);

      if (config.workspace) {
        await this.updateWorkspaceConfig(config.workspace);
      }

      if (config.user) {
        await this.updateUserPreferences(config.user);
      }

      vscode.window.showInformationMessage('Configuration imported successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to import configuration: ${error}`);
    }
  }

  /**
   * Export configuration to file
   */
  async exportConfiguration(filePath?: string): Promise<void> {
    try {
      const config = {
        workspace: this.workspaceConfig,
        user: this.userPreferences,
        exportedAt: new Date().toISOString()
      };

      const exportPath = filePath || await this.selectExportPath();
      if (!exportPath) return;

      await fs.writeFile(exportPath, JSON.stringify(config, null, 2));
      vscode.window.showInformationMessage(`Configuration exported to: ${exportPath}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export configuration: ${error}`);
    }
  }

  /**
   * Get configuration file paths
   */
  getConfigurationPaths(): { workspace: string; user: string } {
    const workspacePath = this.getWorkspaceConfigPath();
    const userPath = this.getUserConfigPath();
    return { workspace: workspacePath, user: userPath };
  }

  /**
   * Validate configuration
   */
  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate output directory
    const outputDir = this.get<string>('outputDirectory');
    if (outputDir && !path.isAbsolute(outputDir)) {
      errors.push('Output directory must be an absolute path');
    }

    // Validate exclude patterns
    const excludePatterns = this.get<string[]>('excludePatterns', []);
    for (const pattern of excludePatterns) {
      try {
        new RegExp(pattern);
      } catch (error) {
        errors.push(`Invalid exclude pattern: ${pattern}`);
      }
    }

    // Validate numeric values
    const maxDepth = this.get<number>('maxDepth');
    if (maxDepth !== undefined && (maxDepth < 1 || maxDepth > 20)) {
      errors.push('Max depth must be between 1 and 20');
    }

    const maxFiles = this.get<number>('maxFiles');
    if (maxFiles !== undefined && (maxFiles < 1 || maxFiles > 10000)) {
      errors.push('Max files must be between 1 and 10000');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Dispose of the configuration service
   */
  dispose(): void {
    if (this.configWatcher) {
      this.configWatcher.dispose();
    }
  }

  private initializeDefaults(): void {
    this.workspaceConfig = this.getDefaultWorkspaceConfig();
    this.userPreferences = this.getDefaultUserPreferences();
  }

  private getDefaultWorkspaceConfig(): WorkspaceConfiguration {
    return {
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/out/**',
        '**/*.log'
      ],
      includePatterns: ['**/*.ts', '**/*.js', '**/*.md', '**/*.json'],
      maxDepth: 10,
      maxFiles: 1000,
      outputDirectory: './docs',
      outputNamingPattern: '{timestamp}-{template}-{folder}',
      createOutputFolders: true,
      claudeIntegration: {
        commandTimeout: 30000,
        retryAttempts: 3,
        cleanupAfterExecution: true,
        mcpServerEnabled: true
      },
      cacheEnabled: true,
      cacheTimeout: 300000, // 5 minutes
      parallelProcessing: true,
      maxConcurrentOperations: 3,
      autoGenerateOnSave: false,
      showPreviewBeforeGenerate: true,
      confirmBeforeOverwrite: true,
      enableTelemetry: true
    };
  }

  private getDefaultUserPreferences(): UserPreferences {
    return {
      theme: 'auto',
      language: 'en',
      notifications: {
        success: true,
        warnings: true,
        errors: true
      },
      ui: {
        sidebarPosition: 'left',
        showTips: true,
        compactMode: false
      },
      shortcuts: {}
    };
  }

  private async loadWorkspaceConfiguration(): Promise<void> {
    try {
      const configPath = this.getWorkspaceConfigPath();
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      this.workspaceConfig = { ...this.getDefaultWorkspaceConfig(), ...config };
    } catch (error) {
      // Config file doesn't exist or is invalid, use defaults
      this.workspaceConfig = this.getDefaultWorkspaceConfig();
    }
  }

  private async loadUserPreferences(): Promise<void> {
    try {
      const configPath = this.getUserConfigPath();
      const content = await fs.readFile(configPath, 'utf-8');
      const preferences = JSON.parse(content);
      this.userPreferences = { ...this.getDefaultUserPreferences(), ...preferences };
    } catch (error) {
      // Preferences file doesn't exist or is invalid, use defaults
      this.userPreferences = this.getDefaultUserPreferences();
    }
  }

  private async saveWorkspaceConfiguration(): Promise<void> {
    try {
      const configPath = this.getWorkspaceConfigPath();
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(this.workspaceConfig, null, 2));
    } catch (error) {
      console.error('Failed to save workspace configuration:', error);
    }
  }

  private async saveUserPreferences(): Promise<void> {
    try {
      const configPath = this.getUserConfigPath();
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(this.userPreferences, null, 2));
    } catch (error) {
      console.error('Failed to save user preferences:', error);
    }
  }

  private getWorkspaceConfigPath(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return path.join(workspaceFolder.uri.fsPath, '.vscode', 'documentation-generator.json');
    }
    return path.join(this.context.globalStorageUri?.fsPath || '', 'workspace-config.json');
  }

  private getUserConfigPath(): string {
    return path.join(this.context.globalStorageUri?.fsPath || '', 'user-preferences.json');
  }

  private setupConfigurationWatcher(): void {
    const workspaceConfigPath = this.getWorkspaceConfigPath();

    this.configWatcher = vscode.workspace.createFileSystemWatcher(workspaceConfigPath);

    this.configWatcher.onDidChange(async () => {
      await this.loadWorkspaceConfiguration();
      this.notifyConfigurationChanged();
    });

    this.configWatcher.onDidDelete(() => {
      this.workspaceConfig = this.getDefaultWorkspaceConfig();
      this.notifyConfigurationChanged();
    });
  }

  private notifyConfigurationChanged(): void {
    // Emit configuration change event
    vscode.commands.executeCommand('documentationGenerator.configurationChanged');
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current)) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private async selectExportPath(): Promise<string | undefined> {
    const result = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('documentation-generator-config.json'),
      filters: {
        'JSON files': ['json'],
        'All files': ['*']
      }
    });
    return result?.fsPath;
  }
}
