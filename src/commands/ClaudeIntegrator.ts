import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  ClaudeCommandContext,
  ClaudeCommandResult,
  CommandDiagnostics,
  GeneratedSlashCommand,
  SlashCommand,
} from './types';
import { SlashCommandGenerator } from './SlashCommandGenerator';

export interface ClaudeIntegratorConfig {
  claudeCommandsPath: string;
  claudeResultsPath?: string;
  tempDirectory: string;
  maxCommandRetries: number;
  commandTimeout: number;
  cleanupAfterExecution: boolean;
  commandFilePermissions?: number;
}

export abstract class ClaudeIntegrator {
  protected config: ClaudeIntegratorConfig;
  protected activeCommands: Map<string, SlashCommand> = new Map();
  protected commandGenerator: SlashCommandGenerator;

  constructor(
    config: ClaudeIntegratorConfig,
    commandGenerator?: SlashCommandGenerator
  ) {
    this.config = config;
    this.commandGenerator = commandGenerator || new SlashCommandGenerator();
  }

  abstract generateDocumentation(
    context: ClaudeCommandContext
  ): Promise<ClaudeCommandResult>;

  abstract createSlashCommand(
    context: ClaudeCommandContext,
    prebuilt?: GeneratedSlashCommand
  ): Promise<SlashCommand>;

  abstract executeCommand(command: SlashCommand): Promise<ClaudeCommandResult>;

  abstract cleanup(commandId?: string): Promise<void>;

  getActiveCommands(): SlashCommand[] {
    return Array.from(this.activeCommands.values());
  }

  getCommand(commandId: string): SlashCommand | undefined {
    return this.activeCommands.get(commandId);
  }

  protected async ensureDirectory(
    directory: string,
    mode: number = 0o700
  ): Promise<void> {
    try {
      await fs.mkdir(directory, { recursive: true, mode });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

export class ClaudeCodeIntegrator extends ClaudeIntegrator {
  private readonly workspaceRoot: string;

  constructor(
    config: ClaudeIntegratorConfig,
    workspaceRoot: string,
    commandGenerator?: SlashCommandGenerator
  ) {
    super(config, commandGenerator);
    this.workspaceRoot = workspaceRoot;
  }

  async generateDocumentation(
    context: ClaudeCommandContext
  ): Promise<ClaudeCommandResult> {
    const startTime = Date.now();

    try {
      const generated =
        await this.commandGenerator.generateSlashCommand(context);
      const command = await this.createSlashCommand(context, generated);
      const result = await this.executeCommand(command);

      if (this.config.cleanupAfterExecution) {
        await this.cleanup(command.id);
      }

      return {
        ...result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime: Date.now() - startTime,
      };
    }
  }

  async createSlashCommand(
    context: ClaudeCommandContext,
    prebuilt?: GeneratedSlashCommand
  ): Promise<SlashCommand> {
    const commandId = this.generateCommandId();
    const generated =
      prebuilt || (await this.commandGenerator.generateSlashCommand(context));
    const commandFileDirectory = this.config.claudeCommandsPath;
    await this.ensureDirectory(commandFileDirectory);

    const baseFilePath = path.join(commandFileDirectory, generated.fileName);
    const commandFilePath = await this.ensureUniqueFilePath(baseFilePath);

    await fs.writeFile(commandFilePath, generated.content, {
      encoding: 'utf-8',
      mode: this.config.commandFilePermissions ?? 0o600,
    });

    const command: SlashCommand = {
      ...generated,
      id: commandId,
      filePath: commandFilePath,
    };

    this.activeCommands.set(commandId, command);

    vscode.window.showInformationMessage(
      `Slash command ready: ${path.basename(command.filePath)}. Run it in Claude Code to start documentation generation.`
    );

    return command;
  }

  async executeCommand(command: SlashCommand): Promise<ClaudeCommandResult> {
    const startTime = Date.now();

    try {
      const result = await this.waitForCommandCompletion(command);
      return {
        ...result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Command execution failed',
        executionTime: Date.now() - startTime,
        commandId: command.id,
        metadata: command.metadata,
      };
    }
  }

  async cleanup(commandId?: string): Promise<void> {
    if (commandId) {
      await this.removeCommand(commandId);
      return;
    }

    for (const id of Array.from(this.activeCommands.keys())) {
      await this.removeCommand(id);
    }
  }

  private async waitForCommandCompletion(
    command: SlashCommand
  ): Promise<ClaudeCommandResult> {
    const expectedOutputPath = command.outputPath;
    const outputDirectory = path.dirname(expectedOutputPath);
    await this.ensureDirectory(outputDirectory, 0o755);

    let watcher: fsSync.FSWatcher | undefined;
    let settled = false;

    const timeoutMs = this.config.commandTimeout;

    return new Promise<ClaudeCommandResult>((resolve) => {
      let timeoutHandle: NodeJS.Timeout;

      const complete = (result: ClaudeCommandResult) => {
        if (settled) {
          return;
        }
        settled = true;
        if (watcher) {
          watcher.close();
        }
        clearTimeout(timeoutHandle);
        resolve(result);
      };

      const buildDiagnostics = async (
        exists: boolean
      ): Promise<CommandDiagnostics> => {
        if (!exists) {
          return {
            commandId: command.id,
            commandFilePath: command.filePath,
            commandCreatedAt: command.createdAt,
            outputExists: false,
            version: command.metadata.version,
          };
        }

        const stats = await fs.stat(expectedOutputPath);
        return {
          commandId: command.id,
          commandFilePath: command.filePath,
          commandCreatedAt: command.createdAt,
          outputExists: true,
          outputPath: expectedOutputPath,
          outputSize: stats.size,
          outputModifiedAt: stats.mtime,
          version: command.metadata.version,
        };
      };

      const attemptReadOutput = async () => {
        try {
          const content = await fs.readFile(expectedOutputPath, 'utf-8');
          const diagnostics = await buildDiagnostics(true);
          complete({
            success: true,
            output: content,
            outputPath: expectedOutputPath,
            executionTime: 0,
            commandId: command.id,
            metadata: command.metadata,
            diagnostics,
          });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            const diagnostics = await buildDiagnostics(false);
            complete({
              success: false,
              error: `Failed to read command output: ${(error as Error).message}`,
              executionTime: 0,
              commandId: command.id,
              metadata: command.metadata,
              diagnostics,
            });
          }
        }
      };

      timeoutHandle = setTimeout(async () => {
        const diagnostics = await buildDiagnostics(false);
        complete({
          success: false,
          error: 'Command timed out waiting for output.',
          executionTime: 0,
          commandId: command.id,
          metadata: command.metadata,
          diagnostics,
        });
      }, timeoutMs);

      const handleSuccess = async () => {
        await attemptReadOutput();
      };

      try {
        watcher = fsSync.watch(
          outputDirectory,
          async (_eventType, filename) => {
            if (settled) {
              return;
            }

            if (!filename) {
              await attemptReadOutput();
              return;
            }

            const targetPath = path.join(outputDirectory, filename.toString());
            if (path.resolve(targetPath) === path.resolve(expectedOutputPath)) {
              await handleSuccess();
            }
          }
        );
      } catch (error) {
        // If watcher fails (e.g., unsupported FS), fall back to polling once
        void attemptReadOutput();
      }

      // Initial check in case output already exists
      void attemptReadOutput();
    });
  }

  private async removeCommand(commandId: string): Promise<void> {
    const command = this.activeCommands.get(commandId);
    if (!command) {
      return;
    }

    try {
      await fs.unlink(command.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(
          `Failed to delete command file ${command.filePath}:`,
          error
        );
      }
    }

    this.activeCommands.delete(commandId);
  }

  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private async ensureUniqueFilePath(basePath: string): Promise<string> {
    let candidate = basePath;
    let attempt = 0;
    const { dir, name, ext } = path.parse(basePath);

    while (true) {
      try {
        await fs.access(candidate);
        attempt += 1;
        candidate = path.join(dir, `${name}-${attempt}${ext}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return candidate;
        }
        throw error;
      }
    }
  }
}

export function createClaudeIntegrator(
  type: 'claude-code' | 'api',
  config: ClaudeIntegratorConfig,
  workspaceRoot: string,
  commandGenerator?: SlashCommandGenerator
): ClaudeIntegrator {
  switch (type) {
    case 'claude-code':
      return new ClaudeCodeIntegrator(config, workspaceRoot, commandGenerator);
    case 'api':
      throw new Error('API integration not implemented yet');
    default:
      throw new Error(`Unknown integrator type: ${type}`);
  }
}
