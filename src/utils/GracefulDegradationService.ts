import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LoggingService, LogLevel } from './LoggingService';

export interface DependencyInfo {
  name: string;
  type: 'required' | 'optional' | 'feature-specific';
  description: string;
  fallbackStrategy?: FallbackStrategy;
  checkFunction: () => Promise<boolean>;
  installInstructions?: string;
  alternativeFeatures?: string[];
}

export interface FallbackStrategy {
  name: string;
  description: string;
  implementation: () => Promise<any>;
  limitations?: string[];
}

export interface FeatureAvailability {
  feature: string;
  available: boolean;
  reason?: string;
  alternatives?: string[];
}

export class GracefulDegradationService {
  private static instance: GracefulDegradationService;
  private logger: LoggingService;
  private dependencies: Map<string, DependencyInfo> = new Map();
  private featureAvailability: Map<string, FeatureAvailability> = new Map();
  private degradationMode: boolean = false;

  private constructor() {
    this.logger = LoggingService.getInstance();
    this.initializeDependencies();
  }

  static getInstance(): GracefulDegradationService {
    if (!GracefulDegradationService.instance) {
      GracefulDegradationService.instance = new GracefulDegradationService();
    }
    return GracefulDegradationService.instance;
  }

  /**
   * Initialize and check all dependencies
   */
  async initialize(): Promise<void> {
    this.logger.log(
      LogLevel.INFO,
      'Checking dependencies and feature availability'
    );

    const checkPromises = Array.from(this.dependencies.values()).map(
      async (dep) => {
        try {
          const available = await dep.checkFunction();

          if (!available) {
            this.logger.log(
              dep.type === 'required' ? LogLevel.ERROR : LogLevel.WARN,
              `Dependency not available: ${dep.name}`,
              { type: dep.type, description: dep.description }
            );

            if (dep.type === 'required' && !dep.fallbackStrategy) {
              this.degradationMode = true;
            }
          } else {
            this.logger.log(
              LogLevel.DEBUG,
              `Dependency available: ${dep.name}`
            );
          }

          return { name: dep.name, available, dependency: dep };
        } catch (error) {
          this.logger.log(
            LogLevel.ERROR,
            `Error checking dependency: ${dep.name}`,
            { error }
          );
          return { name: dep.name, available: false, dependency: dep };
        }
      }
    );

    const results = await Promise.all(checkPromises);

    // Update feature availability based on dependency check results
    await this.updateFeatureAvailability(results);

    if (this.degradationMode) {
      this.logger.log(
        LogLevel.WARN,
        'Running in degradation mode due to missing required dependencies'
      );
      await this.notifyUserOfDegradation();
    }
  }

  /**
   * Check if a specific feature is available
   */
  isFeatureAvailable(featureName: string): boolean {
    const feature = this.featureAvailability.get(featureName);
    return feature?.available ?? false;
  }

  /**
   * Get feature availability information
   */
  getFeatureAvailability(featureName: string): FeatureAvailability | undefined {
    return this.featureAvailability.get(featureName);
  }

  /**
   * Execute function with graceful degradation
   */
  async executeWithDegradation<T>(
    featureName: string,
    primaryFunction: () => Promise<T>,
    fallbackFunction?: () => Promise<T>,
    fallbackValue?: T
  ): Promise<T> {
    const feature = this.featureAvailability.get(featureName);

    if (feature?.available) {
      try {
        return await primaryFunction();
      } catch (error) {
        this.logger.log(
          LogLevel.ERROR,
          `Primary function failed for feature: ${featureName}`,
          { error }
        );

        // Try fallback if available
        if (fallbackFunction) {
          this.logger.log(
            LogLevel.INFO,
            `Using fallback for feature: ${featureName}`
          );
          return await fallbackFunction();
        }
      }
    } else {
      this.logger.log(LogLevel.WARN, `Feature not available: ${featureName}`, {
        reason: feature?.reason,
        alternatives: feature?.alternatives,
      });

      if (fallbackFunction) {
        this.logger.log(
          LogLevel.INFO,
          `Using fallback for unavailable feature: ${featureName}`
        );
        return await fallbackFunction();
      }
    }

    if (fallbackValue !== undefined) {
      this.logger.log(
        LogLevel.INFO,
        `Using fallback value for feature: ${featureName}`
      );
      return fallbackValue;
    }

    throw new Error(
      `Feature '${featureName}' is not available and no fallback provided`
    );
  }

  /**
   * Get alternative features for unavailable feature
   */
  getAlternatives(featureName: string): string[] {
    const feature = this.featureAvailability.get(featureName);
    return feature?.alternatives || [];
  }

  /**
   * Check dependency availability
   */
  async checkDependency(dependencyName: string): Promise<boolean> {
    const dependency = this.dependencies.get(dependencyName);
    if (!dependency) {
      return false;
    }

    try {
      return await dependency.checkFunction();
    } catch (error) {
      this.logger.log(
        LogLevel.ERROR,
        `Error checking dependency: ${dependencyName}`,
        { error }
      );
      return false;
    }
  }

  /**
   * Install missing dependency (where possible)
   */
  async installDependency(dependencyName: string): Promise<boolean> {
    const dependency = this.dependencies.get(dependencyName);
    if (!dependency) {
      throw new Error(`Unknown dependency: ${dependencyName}`);
    }

    if (!dependency.installInstructions) {
      throw new Error(
        `No installation instructions available for: ${dependencyName}`
      );
    }

    // Show installation instructions to user
    const action = await vscode.window.showInformationMessage(
      `Missing dependency: ${dependency.name}\n${dependency.description}`,
      'Show Instructions',
      'Ignore'
    );

    if (action === 'Show Instructions') {
      const instructionsPanel = vscode.window.createWebviewPanel(
        'installInstructions',
        `Install ${dependency.name}`,
        vscode.ViewColumn.One,
        { enableScripts: false }
      );

      instructionsPanel.webview.html =
        this.generateInstallInstructionsHTML(dependency);
    }

    return false; // Manual installation required
  }

  /**
   * Register custom dependency
   */
  registerDependency(dependency: DependencyInfo): void {
    this.dependencies.set(dependency.name, dependency);
    this.logger.log(
      LogLevel.DEBUG,
      `Registered dependency: ${dependency.name}`
    );
  }

  /**
   * Get all dependency statuses
   */
  async getDependencyStatuses(): Promise<Map<string, boolean>> {
    const statuses = new Map<string, boolean>();

    for (const [name, dependency] of this.dependencies) {
      try {
        const available = await dependency.checkFunction();
        statuses.set(name, available);
      } catch {
        statuses.set(name, false);
      }
    }

    return statuses;
  }

  /**
   * Check if running in degradation mode
   */
  isInDegradationMode(): boolean {
    return this.degradationMode;
  }

  private initializeDependencies(): void {
    // Claude Code Pro availability
    this.registerDependency({
      name: 'claude-code-pro',
      type: 'required',
      description:
        'Claude Code Pro subscription for advanced document generation',
      checkFunction: async () => {
        // Check if Claude Code Pro is available
        try {
          const claudeCommands = await vscode.commands.getCommands();
          return claudeCommands.some((cmd) => cmd.startsWith('claude.'));
        } catch {
          return false;
        }
      },
      fallbackStrategy: {
        name: 'basic-generation',
        description: 'Use basic template processing without AI enhancement',
        implementation: async () => {
          // Implement basic template processing
          return 'Basic template processing without AI enhancement';
        },
        limitations: [
          'No AI-powered content generation',
          'Limited context analysis',
          'Template-only output',
        ],
      },
      installInstructions:
        'Please ensure you have Claude Code Pro subscription and the Claude extension installed.',
      alternativeFeatures: [
        'manual-template-processing',
        'static-documentation',
      ],
    });

    // Node.js modules availability
    this.registerDependency({
      name: 'node-modules',
      type: 'required',
      description: 'Required Node.js modules for file system operations',
      checkFunction: async () => {
        try {
          await fs.access(process.cwd());
          return true;
        } catch {
          return false;
        }
      },
      fallbackStrategy: {
        name: 'vscode-api-only',
        description: 'Use VS Code API for file operations',
        implementation: async () => {
          // Use VS Code workspace API instead of direct fs operations
          return vscode.workspace;
        },
      },
    });

    // Git availability
    this.registerDependency({
      name: 'git',
      type: 'optional',
      description: 'Git for version control information in documentation',
      checkFunction: async () => {
        try {
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders) return false;

          const gitPath = path.join(workspaceFolders[0].uri.fsPath, '.git');
          await fs.access(gitPath);
          return true;
        } catch {
          return false;
        }
      },
      alternativeFeatures: [
        'manual-version-info',
        'timestamp-based-versioning',
      ],
    });

    // TypeScript compiler availability
    this.registerDependency({
      name: 'typescript',
      type: 'feature-specific',
      description: 'TypeScript compiler for enhanced code analysis',
      checkFunction: async () => {
        try {
          const tsExtension = vscode.extensions.getExtension(
            'ms-vscode.vscode-typescript-next'
          );
          return tsExtension?.isActive ?? false;
        } catch {
          return false;
        }
      },
      fallbackStrategy: {
        name: 'basic-file-analysis',
        description:
          'Use basic file content analysis without TypeScript parsing',
        implementation: async () => {
          // Implement basic text-based analysis
          return 'Basic file analysis';
        },
        limitations: [
          'No type information',
          'Limited symbol resolution',
          'Basic syntax analysis only',
        ],
      },
      alternativeFeatures: ['text-based-analysis', 'pattern-matching-analysis'],
    });

    // Workspace access
    this.registerDependency({
      name: 'workspace-access',
      type: 'required',
      description: 'Access to VS Code workspace for file operations',
      checkFunction: async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        return workspaceFolders !== undefined && workspaceFolders.length > 0;
      },
      fallbackStrategy: {
        name: 'single-file-mode',
        description: 'Work with individual files instead of workspace',
        implementation: async () => {
          return 'Single file processing mode';
        },
        limitations: [
          'Cannot analyze project structure',
          'Limited context gathering',
          'File-by-file processing only',
        ],
      },
      installInstructions:
        'Please open a folder or workspace in VS Code to use this extension.',
      alternativeFeatures: [
        'single-file-documentation',
        'manual-file-selection',
      ],
    });
  }

  private async updateFeatureAvailability(
    dependencyResults: Array<{
      name: string;
      available: boolean;
      dependency: DependencyInfo;
    }>
  ): Promise<void> {
    // Define feature dependencies
    const featureDependencies = {
      'ai-generation': ['claude-code-pro'],
      'workspace-analysis': ['workspace-access', 'node-modules'],
      'typescript-analysis': ['typescript'],
      'git-integration': ['git'],
      'advanced-templates': ['claude-code-pro', 'workspace-access'],
      'basic-templates': ['node-modules'],
      'file-operations': ['node-modules'],
    };

    for (const [feature, deps] of Object.entries(featureDependencies)) {
      const requiredDeps = deps.map((depName) => {
        const result = dependencyResults.find((r) => r.name === depName);
        return (
          result || {
            name: depName,
            available: false,
            dependency: this.dependencies.get(depName)!,
          }
        );
      });

      const unavailableDeps = requiredDeps.filter((dep) => !dep.available);
      const available = unavailableDeps.length === 0;

      const alternatives: string[] = [];
      if (!available) {
        // Collect alternatives from unavailable dependencies
        unavailableDeps.forEach((dep) => {
          if (dep.dependency.alternativeFeatures) {
            alternatives.push(...dep.dependency.alternativeFeatures);
          }
        });
      }

      this.featureAvailability.set(feature, {
        feature,
        available,
        reason: available
          ? undefined
          : `Missing dependencies: ${unavailableDeps.map((d) => d.name).join(', ')}`,
        alternatives:
          alternatives.length > 0 ? [...new Set(alternatives)] : undefined,
      });
    }
  }

  private async notifyUserOfDegradation(): Promise<void> {
    const unavailableFeatures = Array.from(this.featureAvailability.values())
      .filter((f) => !f.available)
      .map((f) => f.feature);

    if (unavailableFeatures.length === 0) return;

    const message = `Some features are not available: ${unavailableFeatures.slice(0, 3).join(', ')}${
      unavailableFeatures.length > 3 ? '...' : ''
    }`;

    const action = await vscode.window.showWarningMessage(
      message,
      'Show Details',
      'Install Dependencies',
      'Continue'
    );

    switch (action) {
      case 'Show Details':
        await this.showFeatureStatusPanel();
        break;
      case 'Install Dependencies':
        await this.showDependencyInstallationGuide();
        break;
      case 'Continue':
      default:
        // Continue with degraded functionality
        break;
    }
  }

  private async showFeatureStatusPanel(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'featureStatus',
      'Feature Availability',
      vscode.ViewColumn.One,
      { enableScripts: false }
    );

    panel.webview.html = this.generateFeatureStatusHTML();
  }

  private async showDependencyInstallationGuide(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'dependencyGuide',
      'Dependency Installation Guide',
      vscode.ViewColumn.One,
      { enableScripts: false }
    );

    panel.webview.html = this.generateDependencyGuideHTML();
  }

  private generateFeatureStatusHTML(): string {
    const features = Array.from(this.featureAvailability.values());

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Feature Availability</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                margin: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            .feature {
                padding: 15px;
                margin: 10px 0;
                border-radius: 4px;
                border-left: 4px solid;
            }
            .feature.available {
                border-color: var(--vscode-charts-green);
                background: var(--vscode-inputValidation-infoBackground);
            }
            .feature.unavailable {
                border-color: var(--vscode-charts-red);
                background: var(--vscode-inputValidation-errorBackground);
            }
            .alternatives {
                margin-top: 10px;
                font-size: 0.9em;
                color: var(--vscode-descriptionForeground);
            }
        </style>
    </head>
    <body>
        <h1>Feature Availability Status</h1>
        <p>This panel shows which features are currently available and what alternatives exist for unavailable features.</p>

        ${features
          .map(
            (feature) => `
            <div class="feature ${feature.available ? 'available' : 'unavailable'}">
                <h3>${feature.feature} ${feature.available ? '✅' : '❌'}</h3>
                ${feature.reason ? `<p><strong>Reason:</strong> ${feature.reason}</p>` : ''}
                ${
                  feature.alternatives
                    ? `
                    <div class="alternatives">
                        <strong>Alternatives:</strong>
                        <ul>
                            ${feature.alternatives.map((alt) => `<li>${alt}</li>`).join('')}
                        </ul>
                    </div>
                `
                    : ''
                }
            </div>
        `
          )
          .join('')}
    </body>
    </html>
    `;
  }

  private generateDependencyGuideHTML(): string {
    const dependencies = Array.from(this.dependencies.values());

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Dependency Installation Guide</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                margin: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            .dependency {
                padding: 15px;
                margin: 10px 0;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
            }
            .type-badge {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 0.8em;
                font-weight: bold;
            }
            .required { background: var(--vscode-charts-red); color: white; }
            .optional { background: var(--vscode-charts-yellow); color: black; }
            .feature-specific { background: var(--vscode-charts-blue); color: white; }
            .instructions {
                background: var(--vscode-textCodeBlock-background);
                padding: 10px;
                border-radius: 4px;
                margin-top: 10px;
            }
        </style>
    </head>
    <body>
        <h1>Dependency Installation Guide</h1>
        <p>Follow these instructions to install missing dependencies and enable full functionality.</p>

        ${dependencies
          .map(
            (dep) => `
            <div class="dependency">
                <h3>
                    ${dep.name}
                    <span class="type-badge ${dep.type.replace('-', '')}">${dep.type}</span>
                </h3>
                <p>${dep.description}</p>
                ${
                  dep.installInstructions
                    ? `
                    <div class="instructions">
                        <strong>Installation:</strong><br>
                        ${dep.installInstructions}
                    </div>
                `
                    : '<p><em>No installation instructions available</em></p>'
                }
            </div>
        `
          )
          .join('')}
    </body>
    </html>
    `;
  }

  private generateInstallInstructionsHTML(dependency: DependencyInfo): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Install ${dependency.name}</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                margin: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            .instructions {
                background: var(--vscode-textCodeBlock-background);
                padding: 15px;
                border-radius: 4px;
                margin: 15px 0;
            }
        </style>
    </head>
    <body>
        <h1>Install ${dependency.name}</h1>
        <p>${dependency.description}</p>

        <div class="instructions">
            ${dependency.installInstructions || 'No installation instructions available'}
        </div>

        ${
          dependency.alternativeFeatures
            ? `
            <h2>Alternative Features</h2>
            <p>If you cannot install this dependency, the following features may be available as alternatives:</p>
            <ul>
                ${dependency.alternativeFeatures.map((alt) => `<li>${alt}</li>`).join('')}
            </ul>
        `
            : ''
        }
    </body>
    </html>
    `;
  }
}
