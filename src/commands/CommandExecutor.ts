import * as fs from 'fs/promises';
import {
  ClaudeCommandContext,
  ClaudeCommandResult,
  CommandDiagnostics,
  CommandGenerationOptions,
  GeneratedSlashCommand,
  SlashCommand,
} from './types';
import { SlashCommandGenerator } from './SlashCommandGenerator';
import { ClaudeIntegrator } from './ClaudeIntegrator';

export interface CommandExecutionOptions extends CommandGenerationOptions {
  autoExecute?: boolean;
  skipValidation?: boolean;
}

export interface CommandExecutionSummary {
  command: SlashCommand;
  result: ClaudeCommandResult;
}

export class CommandExecutor {
  private readonly generator: SlashCommandGenerator;
  private readonly integrator: ClaudeIntegrator;
  private readonly commandHistory: CommandExecutionSummary[] = [];

  constructor(generator: SlashCommandGenerator, integrator: ClaudeIntegrator) {
    this.generator = generator;
    this.integrator = integrator;
  }

  /**
   * Preview the generated command without writing it to disk.
   */
  async previewCommand(
    context: ClaudeCommandContext,
    options: CommandExecutionOptions = {}
  ): Promise<GeneratedSlashCommand> {
    const {
      skipValidation,
      autoExecute: _autoExecute,
      ...generationOptions
    } = options;

    if (!skipValidation) {
      this.validateTemplateCompatibility(context);
      this.ensureRequiredVariables(context);
    }

    return this.generator.generateSlashCommand(context, generationOptions);
  }

  /**
   * Generate a command file ready to run in Claude Code.
   */
  async prepareCommand(
    context: ClaudeCommandContext,
    options: CommandExecutionOptions = {}
  ): Promise<SlashCommand> {
    const {
      skipValidation,
      autoExecute: _autoExecute,
      ...generationOptions
    } = options;

    if (!skipValidation) {
      this.validateTemplateCompatibility(context);
      this.ensureRequiredVariables(context);
    }

    const prebuilt = await this.generator.generateSlashCommand(
      context,
      generationOptions
    );
    return this.integrator.createSlashCommand(context, prebuilt);
  }

  /**
   * Generate and execute the command, returning the Claude result.
   */
  async execute(
    context: ClaudeCommandContext,
    options: CommandExecutionOptions = {}
  ): Promise<ClaudeCommandResult> {
    const { autoExecute } = options;
    const command = await this.prepareCommand(context, options);

    if (autoExecute === false) {
      return {
        success: true,
        output: 'Command generated but execution skipped as requested.',
        executionTime: 0,
        commandId: command.id,
        metadata: command.metadata,
        diagnostics: await this.collectDiagnostics(command),
      };
    }

    const result = await this.integrator.executeCommand(command);
    const enriched = await this.enrichResult(command, result);

    this.commandHistory.push({ command, result: enriched });
    return enriched;
  }

  /**
   * Remove command files and clear active state.
   */
  async cleanup(commandId?: string): Promise<void> {
    await this.integrator.cleanup(commandId);
  }

  /**
   * Provide diagnostics for debugging and testing workflows.
   */
  async getCommandDiagnostics(
    commandId: string
  ): Promise<CommandDiagnostics | undefined> {
    const command = this.integrator.getCommand(commandId);
    if (!command) {
      return undefined;
    }

    return this.collectDiagnostics(command);
  }

  getCommandHistory(): CommandExecutionSummary[] {
    return [...this.commandHistory];
  }

  private validateTemplateCompatibility(context: ClaudeCommandContext): void {
    const { template } = context;
    if (!template || !template.content) {
      throw new Error('Template content is missing or empty.');
    }

    if (!template.metadata || !template.metadata.name) {
      throw new Error('Template metadata must include a name.');
    }

    if (!template.metadata.description) {
      throw new Error('Template metadata must include a description.');
    }
  }

  private ensureRequiredVariables(context: ClaudeCommandContext): void {
    const requiredVariables =
      context.template.metadata.variables?.filter(
        (variable) => variable.required
      ) || [];

    const missingVariables = requiredVariables.filter((variable) => {
      const value = context.variables[variable.name];
      return value === undefined || value === null || value === '';
    });

    if (missingVariables.length > 0) {
      throw new Error(
        `Missing required template variables: ${missingVariables
          .map((variable) => variable.name)
          .join(', ')}`
      );
    }
  }

  private async enrichResult(
    command: SlashCommand,
    result: ClaudeCommandResult
  ): Promise<ClaudeCommandResult> {
    const diagnostics =
      result.diagnostics || (await this.collectDiagnostics(command));

    return {
      ...result,
      commandId: result.commandId || command.id,
      metadata: result.metadata || command.metadata,
      diagnostics,
    };
  }

  private async collectDiagnostics(
    command: SlashCommand
  ): Promise<CommandDiagnostics> {
    try {
      const stats = await fs.stat(command.outputPath);
      return {
        commandId: command.id,
        commandFilePath: command.filePath,
        commandCreatedAt: command.createdAt,
        outputExists: true,
        outputPath: command.outputPath,
        outputSize: stats.size,
        outputModifiedAt: stats.mtime,
        version: command.metadata.version,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          commandId: command.id,
          commandFilePath: command.filePath,
          commandCreatedAt: command.createdAt,
          outputExists: false,
          version: command.metadata.version,
        };
      }

      throw error;
    }
  }
}
