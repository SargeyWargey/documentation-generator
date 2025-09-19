import { FolderContext } from '../utils/FolderAnalyzer';
import { Template } from '../templates/TemplateManager';

export type CommandArgumentType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'path'
  | 'enum';

export interface CommandArgumentDefinition {
  name: string;
  description: string;
  required: boolean;
  type: CommandArgumentType;
  defaultValue?: string | number | boolean;
  options?: string[];
}

export interface SlashCommandMetadata {
  name: string;
  description: string;
  argumentHint: string;
  autoSubmit: boolean;
  allowedTools: string[];
  timeoutMs: number;
  version: string;
  tags: string[];
  arguments: CommandArgumentDefinition[];
}

export interface CommandDiagnostics {
  commandId: string;
  commandFilePath: string;
  commandCreatedAt: Date;
  outputExists: boolean;
  outputPath?: string;
  outputSize?: number;
  outputModifiedAt?: Date;
  version: string;
}

export interface ClaudeCommandContext {
  folderPath: string;
  folderContext: FolderContext;
  template: Template;
  variables: Record<string, any>;
  outputPath?: string;
  commandLabel?: string;
  metadataOverrides?: Partial<SlashCommandMetadata>;
  commandTemplateId?: string;
}

export interface CommandGenerationOptions {
  commandPrefix?: string;
  fileName?: string;
  autoSubmit?: boolean;
  argumentHint?: string;
  timeoutMs?: number;
  allowedTools?: string[];
  tags?: string[];
}

export interface GeneratedSlashCommand {
  id: string;
  name: string;
  description: string;
  content: string;
  fileName: string;
  outputPath: string;
  metadata: SlashCommandMetadata;
  context: ClaudeCommandContext;
  createdAt: Date;
}

export interface SlashCommand extends GeneratedSlashCommand {
  filePath: string;
}

export interface ClaudeCommandResult {
  success: boolean;
  output?: string;
  error?: string;
  outputPath?: string;
  executionTime: number;
  commandId?: string;
  metadata?: SlashCommandMetadata;
  diagnostics?: CommandDiagnostics;
}

export interface CommandTemplateDefinition {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  outputInstructions: string;
  variables: string[];
  argumentHint: string;
  allowedTools: string[];
  autoSubmit: boolean;
  timeoutMs: number;
  tags: string[];
  categories: string[];
}

export interface CommandTemplateContext {
  project: {
    name: string;
    type: string;
    path: string;
    summary: string;
    totalFiles: number;
    totalLines: number;
  };
  template: Template;
  variables: Record<string, any>;
  outputPath: string;
}
