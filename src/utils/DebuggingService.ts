import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LoggingService, LogLevel } from './LoggingService';
import { ConfigurationService } from './ConfigurationService';
import { ErrorHandler } from './ErrorHandler';

export interface DebugInfo {
  timestamp: Date;
  extensionVersion: string;
  vscodeVersion: string;
  nodeVersion: string;
  platform: string;
  workspaceInfo: WorkspaceInfo;
  configuration: any;
  recentLogs: LogEntry[];
  systemInfo: SystemInfo;
  diagnostics: DiagnosticInfo[];
}

export interface WorkspaceInfo {
  folderCount: number;
  workspaceName?: string;
  hasGit: boolean;
  fileTypes: Record<string, number>;
  totalFiles: number;
}

export interface SystemInfo {
  memory: {
    total: number;
    free: number;
    used: number;
  };
  performance: {
    startupTime?: number;
    lastGenerationTime?: number;
  };
}

export interface DiagnosticInfo {
  category: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  details?: any;
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
}

export interface TroubleshootingStep {
  id: string;
  title: string;
  description: string;
  action: () => Promise<boolean>;
  autoFix?: boolean;
}

export class DebuggingService {
  private static instance: DebuggingService;
  private logger: LoggingService;
  private configService: ConfigurationService;
  private errorHandler: ErrorHandler;
  private troubleshootingSteps: Map<string, TroubleshootingStep> = new Map();

  private constructor(private context: vscode.ExtensionContext) {
    this.logger = LoggingService.getInstance();
    this.configService = ConfigurationService.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.initializeTroubleshootingSteps();
  }

  static getInstance(context?: vscode.ExtensionContext): DebuggingService {
    if (!DebuggingService.instance && context) {
      DebuggingService.instance = new DebuggingService(context);
    }
    return DebuggingService.instance;
  }

  /**
   * Collect comprehensive debug information
   */
  async collectDebugInfo(): Promise<DebugInfo> {
    try {
      const [workspaceInfo, systemInfo, diagnostics] = await Promise.all([
        this.collectWorkspaceInfo(),
        this.collectSystemInfo(),
        this.runDiagnostics(),
      ]);

      const debugInfo: DebugInfo = {
        timestamp: new Date(),
        extensionVersion: this.getExtensionVersion(),
        vscodeVersion: vscode.version,
        nodeVersion: process.version,
        platform: process.platform,
        workspaceInfo,
        configuration: this.sanitizeConfiguration(),
        recentLogs: await this.getRecentLogs(),
        systemInfo,
        diagnostics,
      };

      this.logger.log(LogLevel.INFO, 'Debug information collected', {
        diagnosticCount: diagnostics.length,
        workspaceFiles: workspaceInfo.totalFiles,
      });

      return debugInfo;
    } catch (error) {
      this.logger.log(LogLevel.ERROR, 'Failed to collect debug info', {
        error,
      });
      throw error;
    }
  }

  /**
   * Export debug information to file
   */
  async exportDebugInfo(filePath?: string): Promise<string> {
    try {
      const debugInfo = await this.collectDebugInfo();

      const exportPath = filePath || (await this.selectExportPath());
      if (!exportPath) {
        throw new Error('No export path selected');
      }

      const debugReport = this.formatDebugReport(debugInfo);
      await fs.writeFile(exportPath, debugReport);

      vscode.window
        .showInformationMessage(
          `Debug information exported to: ${exportPath}`,
          'Open File'
        )
        .then((action) => {
          if (action === 'Open File') {
            vscode.window.showTextDocument(vscode.Uri.file(exportPath));
          }
        });

      return exportPath;
    } catch (error) {
      const errorMessage = `Failed to export debug info: ${error}`;
      vscode.window.showErrorMessage(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Run automated troubleshooting
   */
  async runTroubleshooting(): Promise<{
    fixed: string[];
    failed: string[];
    manual: string[];
  }> {
    const results = {
      fixed: [] as string[],
      failed: [] as string[],
      manual: [] as string[],
    };

    this.logger.log(LogLevel.INFO, 'Starting automated troubleshooting');

    for (const [id, step] of this.troubleshootingSteps) {
      try {
        this.logger.log(
          LogLevel.INFO,
          `Running troubleshooting step: ${step.title}`
        );

        const success = await step.action();

        if (success) {
          results.fixed.push(step.title);
          this.logger.log(
            LogLevel.INFO,
            `Troubleshooting step succeeded: ${step.title}`
          );
        } else {
          if (step.autoFix) {
            results.failed.push(step.title);
          } else {
            results.manual.push(step.title);
          }
          this.logger.log(
            LogLevel.WARN,
            `Troubleshooting step failed: ${step.title}`
          );
        }
      } catch (error) {
        results.failed.push(step.title);
        this.logger.log(
          LogLevel.ERROR,
          `Troubleshooting step error: ${step.title}`,
          { error }
        );
      }
    }

    this.showTroubleshootingResults(results);
    return results;
  }

  /**
   * Show debug panel
   */
  async showDebugPanel(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'debugPanel',
      'Documentation Generator - Debug Panel',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    const debugInfo = await this.collectDebugInfo();
    panel.webview.html = this.generateDebugPanelHTML(debugInfo);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'exportDebugInfo':
          await this.exportDebugInfo();
          break;
        case 'runTroubleshooting':
          await this.runTroubleshooting();
          break;
        case 'clearLogs':
          this.logger.clearLogs();
          vscode.window.showInformationMessage('Logs cleared');
          break;
        case 'refreshDebugInfo':
          const newDebugInfo = await this.collectDebugInfo();
          panel.webview.postMessage({
            command: 'updateDebugInfo',
            data: newDebugInfo,
          });
          break;
      }
    });
  }

  /**
   * Add custom troubleshooting step
   */
  addTroubleshootingStep(step: TroubleshootingStep): void {
    this.troubleshootingSteps.set(step.id, step);
    this.logger.log(LogLevel.INFO, `Added troubleshooting step: ${step.title}`);
  }

  /**
   * Check system health
   */
  async checkSystemHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check VS Code version compatibility
      const vscodeVersion = vscode.version;
      const minVersion = '1.60.0'; // Minimum supported version
      if (this.compareVersions(vscodeVersion, minVersion) < 0) {
        issues.push(
          `VS Code version ${vscodeVersion} is below minimum required ${minVersion}`
        );
      }

      // Check workspace configuration
      const configValidation = this.configService.validateConfiguration();
      if (!configValidation.isValid) {
        issues.push(
          `Configuration errors: ${configValidation.errors.join(', ')}`
        );
      }

      // Check available memory
      const memInfo = await this.getMemoryInfo();
      if (memInfo.free < 100 * 1024 * 1024) {
        // Less than 100MB free
        issues.push('Low system memory available');
      }

      // Check workspace access
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        issues.push('No workspace folder is open');
      }

      // Check template directory access
      try {
        const templatePaths = this.configService.getConfigurationPaths();
        await fs.access(path.dirname(templatePaths.user));
      } catch {
        issues.push('Cannot access user configuration directory');
      }

      return {
        healthy: issues.length === 0,
        issues,
      };
    } catch (error) {
      issues.push(`Health check failed: ${error}`);
      return { healthy: false, issues };
    }
  }

  private async collectWorkspaceInfo(): Promise<WorkspaceInfo> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {
        folderCount: 0,
        hasGit: false,
        fileTypes: {},
        totalFiles: 0,
      };
    }

    const workspaceFolder = workspaceFolders[0];
    const fileTypes: Record<string, number> = {};
    let totalFiles = 0;
    let hasGit = false;

    try {
      // Check for git
      try {
        await fs.access(path.join(workspaceFolder.uri.fsPath, '.git'));
        hasGit = true;
      } catch {
        // No git repository
      }

      // Scan files (limited to prevent performance issues)
      const files = await this.scanWorkspaceFiles(
        workspaceFolder.uri.fsPath,
        1000
      );
      totalFiles = files.length;

      files.forEach((file) => {
        const ext = path.extname(file).toLowerCase() || 'no-extension';
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      });
    } catch (error) {
      this.logger.log(LogLevel.WARN, 'Failed to collect workspace info', {
        error,
      });
    }

    return {
      folderCount: workspaceFolders.length,
      workspaceName: workspaceFolder.name,
      hasGit,
      fileTypes,
      totalFiles,
    };
  }

  private async collectSystemInfo(): Promise<SystemInfo> {
    const memInfo = await this.getMemoryInfo();

    return {
      memory: memInfo,
      performance: {
        startupTime: this.context.globalState.get('lastStartupTime'),
        lastGenerationTime: this.context.globalState.get('lastGenerationTime'),
      },
    };
  }

  private async runDiagnostics(): Promise<DiagnosticInfo[]> {
    const diagnostics: DiagnosticInfo[] = [];

    // System health check
    const healthCheck = await this.checkSystemHealth();
    if (!healthCheck.healthy) {
      diagnostics.push({
        category: 'System Health',
        level: 'error',
        message: 'System health issues detected',
        details: healthCheck.issues,
      });
    }

    // Configuration validation
    const configValidation = this.configService.validateConfiguration();
    if (!configValidation.isValid) {
      diagnostics.push({
        category: 'Configuration',
        level: 'error',
        message: 'Configuration validation failed',
        details: configValidation.errors,
      });
    }

    // Memory usage check
    const memInfo = await this.getMemoryInfo();
    if (memInfo.used / memInfo.total > 0.9) {
      diagnostics.push({
        category: 'Performance',
        level: 'warning',
        message: 'High memory usage detected',
        details: {
          usagePercent: Math.round((memInfo.used / memInfo.total) * 100),
        },
      });
    }

    // Recent error check
    const recentLogs = await this.getRecentLogs();
    const errorCount = recentLogs.filter(
      (log) => log.level === LogLevel.ERROR
    ).length;
    if (errorCount > 5) {
      diagnostics.push({
        category: 'Errors',
        level: 'warning',
        message: `${errorCount} errors found in recent logs`,
        details: { errorCount },
      });
    }

    return diagnostics;
  }

  private async getRecentLogs(_limit: number = 50): Promise<LogEntry[]> {
    // This would typically read from the logging service's log buffer
    // For now, return empty array as LoggingService needs to be enhanced
    return [];
  }

  private async getMemoryInfo(): Promise<SystemInfo['memory']> {
    const usage = process.memoryUsage();
    return {
      total: usage.heapTotal,
      free: usage.heapTotal - usage.heapUsed,
      used: usage.heapUsed,
    };
  }

  private async scanWorkspaceFiles(
    rootPath: string,
    maxFiles: number
  ): Promise<string[]> {
    const files: string[] = [];
    const excludePatterns = this.configService.get<string[]>(
      'excludePatterns',
      []
    );

    const scanDirectory = async (
      dirPath: string,
      depth: number = 0
    ): Promise<void> => {
      if (files.length >= maxFiles || depth > 5) return;

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (files.length >= maxFiles) break;

          const fullPath = path.join(dirPath, entry.name);
          const relativePath = path.relative(rootPath, fullPath);

          // Check exclude patterns
          const isExcluded = excludePatterns.some((pattern) => {
            try {
              return new RegExp(pattern).test(relativePath);
            } catch {
              return false;
            }
          });

          if (isExcluded) continue;

          if (entry.isFile()) {
            files.push(fullPath);
          } else if (entry.isDirectory()) {
            await scanDirectory(fullPath, depth + 1);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await scanDirectory(rootPath);
    return files;
  }

  private getExtensionVersion(): string {
    const extension = vscode.extensions.getExtension('documentation-generator');
    return extension?.packageJSON?.version || 'unknown';
  }

  private sanitizeConfiguration(): any {
    const config = this.configService.getWorkspaceConfig();
    // Remove sensitive information
    const sanitized = { ...config };
    delete sanitized.teamConfigurationUrl;
    delete sanitized.sharedTemplatesRepository;
    return sanitized;
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  private initializeTroubleshootingSteps(): void {
    // Configuration validation step
    this.addTroubleshootingStep({
      id: 'validateConfig',
      title: 'Validate Configuration',
      description: 'Check if configuration is valid and fix common issues',
      autoFix: true,
      action: async () => {
        const validation = this.configService.validateConfiguration();
        if (!validation.isValid) {
          // Try to fix common configuration issues
          await this.configService.resetToDefaults('workspace');
          return true;
        }
        return validation.isValid;
      },
    });

    // Template directory check
    this.addTroubleshootingStep({
      id: 'checkTemplateDir',
      title: 'Check Template Directory',
      description: 'Ensure template directories exist and are accessible',
      autoFix: true,
      action: async () => {
        try {
          const paths = this.configService.getConfigurationPaths();
          await fs.mkdir(path.dirname(paths.user), { recursive: true });
          await fs.mkdir(path.dirname(paths.workspace), { recursive: true });
          return true;
        } catch {
          return false;
        }
      },
    });

    // Clear cache step
    this.addTroubleshootingStep({
      id: 'clearCache',
      title: 'Clear Cache',
      description: 'Clear extension cache to resolve data inconsistencies',
      autoFix: true,
      action: async () => {
        try {
          await this.context.globalState.update('cache', undefined);
          await this.context.workspaceState.update('cache', undefined);
          return true;
        } catch {
          return false;
        }
      },
    });
  }

  private formatDebugReport(debugInfo: DebugInfo): string {
    const report = [
      '# Documentation Generator Debug Report',
      `Generated: ${debugInfo.timestamp.toISOString()}`,
      '',
      '## System Information',
      `- Extension Version: ${debugInfo.extensionVersion}`,
      `- VS Code Version: ${debugInfo.vscodeVersion}`,
      `- Node.js Version: ${debugInfo.nodeVersion}`,
      `- Platform: ${debugInfo.platform}`,
      '',
      '## Workspace Information',
      `- Folder Count: ${debugInfo.workspaceInfo.folderCount}`,
      `- Workspace Name: ${debugInfo.workspaceInfo.workspaceName || 'N/A'}`,
      `- Has Git: ${debugInfo.workspaceInfo.hasGit}`,
      `- Total Files: ${debugInfo.workspaceInfo.totalFiles}`,
      `- File Types: ${JSON.stringify(debugInfo.workspaceInfo.fileTypes, null, 2)}`,
      '',
      '## System Resources',
      `- Memory Total: ${Math.round(debugInfo.systemInfo.memory.total / 1024 / 1024)} MB`,
      `- Memory Used: ${Math.round(debugInfo.systemInfo.memory.used / 1024 / 1024)} MB`,
      `- Memory Free: ${Math.round(debugInfo.systemInfo.memory.free / 1024 / 1024)} MB`,
      '',
      '## Configuration',
      '```json',
      JSON.stringify(debugInfo.configuration, null, 2),
      '```',
      '',
      '## Diagnostics',
      ...debugInfo.diagnostics.map(
        (d) => `- [${d.level.toUpperCase()}] ${d.category}: ${d.message}`
      ),
      '',
      '## Recent Logs',
      ...debugInfo.recentLogs
        .slice(-20)
        .map(
          (log) =>
            `[${log.timestamp.toISOString()}] ${log.level}: ${log.message}`
        ),
    ];

    return report.join('\n');
  }

  private generateDebugPanelHTML(debugInfo: DebugInfo): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Debug Panel</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                margin: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            .section {
                margin-bottom: 30px;
                padding: 15px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
            }
            .diagnostic {
                padding: 10px;
                margin: 5px 0;
                border-radius: 4px;
            }
            .diagnostic.error {
                background: var(--vscode-inputValidation-errorBackground);
                border-left: 3px solid var(--vscode-inputValidation-errorBorder);
            }
            .diagnostic.warning {
                background: var(--vscode-inputValidation-warningBackground);
                border-left: 3px solid var(--vscode-inputValidation-warningBorder);
            }
            .diagnostic.info {
                background: var(--vscode-inputValidation-infoBackground);
                border-left: 3px solid var(--vscode-inputValidation-infoBorder);
            }
            button {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                margin: 5px;
                border-radius: 4px;
                cursor: pointer;
            }
            button:hover {
                background: var(--vscode-button-hoverBackground);
            }
            pre {
                background: var(--vscode-textCodeBlock-background);
                padding: 10px;
                border-radius: 4px;
                overflow-x: auto;
            }
        </style>
    </head>
    <body>
        <h1>Documentation Generator Debug Panel</h1>

        <div class="section">
            <h2>Quick Actions</h2>
            <button onclick="exportDebugInfo()">Export Debug Info</button>
            <button onclick="runTroubleshooting()">Run Troubleshooting</button>
            <button onclick="clearLogs()">Clear Logs</button>
            <button onclick="refreshDebugInfo()">Refresh</button>
        </div>

        <div class="section">
            <h2>System Information</h2>
            <p><strong>Extension Version:</strong> ${debugInfo.extensionVersion}</p>
            <p><strong>VS Code Version:</strong> ${debugInfo.vscodeVersion}</p>
            <p><strong>Platform:</strong> ${debugInfo.platform}</p>
            <p><strong>Memory Usage:</strong> ${Math.round(debugInfo.systemInfo.memory.used / 1024 / 1024)} MB / ${Math.round(debugInfo.systemInfo.memory.total / 1024 / 1024)} MB</p>
        </div>

        <div class="section">
            <h2>Workspace Information</h2>
            <p><strong>Folders:</strong> ${debugInfo.workspaceInfo.folderCount}</p>
            <p><strong>Total Files:</strong> ${debugInfo.workspaceInfo.totalFiles}</p>
            <p><strong>Has Git:</strong> ${debugInfo.workspaceInfo.hasGit ? 'Yes' : 'No'}</p>
        </div>

        <div class="section">
            <h2>Diagnostics</h2>
            ${
              debugInfo.diagnostics.length === 0
                ? '<p>No issues detected</p>'
                : debugInfo.diagnostics
                    .map(
                      (d) => `
                <div class="diagnostic ${d.level}">
                    <strong>[${d.level.toUpperCase()}] ${d.category}:</strong> ${d.message}
                </div>
              `
                    )
                    .join('')
            }
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function exportDebugInfo() {
                vscode.postMessage({ command: 'exportDebugInfo' });
            }

            function runTroubleshooting() {
                vscode.postMessage({ command: 'runTroubleshooting' });
            }

            function clearLogs() {
                vscode.postMessage({ command: 'clearLogs' });
            }

            function refreshDebugInfo() {
                vscode.postMessage({ command: 'refreshDebugInfo' });
            }

            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'updateDebugInfo') {
                    location.reload();
                }
            });
        </script>
    </body>
    </html>
    `;
  }

  private showTroubleshootingResults(results: {
    fixed: string[];
    failed: string[];
    manual: string[];
  }): void {
    const messages = [];

    if (results.fixed.length > 0) {
      messages.push(`✅ Fixed: ${results.fixed.join(', ')}`);
    }

    if (results.failed.length > 0) {
      messages.push(`❌ Failed: ${results.failed.join(', ')}`);
    }

    if (results.manual.length > 0) {
      messages.push(`⚠️ Manual action required: ${results.manual.join(', ')}`);
    }

    const summary = messages.join('\n');

    if (results.fixed.length > 0 && results.failed.length === 0) {
      vscode.window.showInformationMessage(
        'Troubleshooting completed successfully!\n' + summary
      );
    } else if (results.failed.length > 0) {
      vscode.window.showWarningMessage(
        'Some troubleshooting steps failed:\n' + summary
      );
    } else {
      vscode.window.showInformationMessage(
        'Troubleshooting completed:\n' + summary
      );
    }
  }

  private async selectExportPath(): Promise<string | undefined> {
    const result = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(
        `debug-report-${new Date().toISOString().split('T')[0]}.md`
      ),
      filters: {
        'Markdown files': ['md'],
        'Text files': ['txt'],
        'All files': ['*'],
      },
    });
    return result?.fsPath;
  }
}
