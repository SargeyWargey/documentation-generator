import * as path from 'path';
import {
  ClaudeCommandContext,
  CommandArgumentDefinition,
  CommandGenerationOptions,
  CommandTemplateContext,
  CommandTemplateDefinition,
  GeneratedSlashCommand,
  SlashCommandMetadata,
} from './types';
import { FolderContext } from '../utils/FolderAnalyzer';
import { Template, TemplateVariable } from '../templates/TemplateManager';

export class SlashCommandGenerator {
  private readonly commandTemplates: Map<string, CommandTemplateDefinition> = new Map();
  private readonly templateVersions: Map<string, number> = new Map();

  constructor() {
    this.initializeCommandTemplates();
  }

  /**
   * Register or override a command template definition
   */
  registerCommandTemplate(template: CommandTemplateDefinition): void {
    this.commandTemplates.set(template.id, template);
  }

  /**
   * Generate a slash command definition with injected context
   */
  async generateSlashCommand(
    context: ClaudeCommandContext,
    options: CommandGenerationOptions = {}
  ): Promise<GeneratedSlashCommand> {
    const commandTemplate = this.resolveCommandTemplate(context);
    const outputPath = context.outputPath || this.getDefaultOutputPath(context);
    const versionNumber = this.getNextVersion(context.template.id);
    const metadata = this.buildMetadata(
      context,
      commandTemplate,
      versionNumber,
      options
    );
    const fileName = this.buildFileName(context.template, versionNumber, options);

    const commandSections = [
      this.buildFrontmatter(metadata),
      this.generateContextSection(context.folderContext),
      this.generatePromptSection(commandTemplate, context, outputPath),
      this.generateOutputInstructionsSection(
        commandTemplate,
        context,
        outputPath
      ),
    ];

    return {
      id: `${context.template.id}-v${versionNumber}`,
      name: metadata.name,
      description: metadata.description,
      content: commandSections.join('\n\n'),
      fileName,
      outputPath,
      metadata,
      context: { ...context, outputPath },
      createdAt: new Date(),
    };
  }

  /**
   * Determine the command template to use for the given context
   */
  private resolveCommandTemplate(
    context: ClaudeCommandContext
  ): CommandTemplateDefinition {
    if (context.commandTemplateId) {
      const explicitTemplate = this.commandTemplates.get(context.commandTemplateId);
      if (explicitTemplate) {
        return explicitTemplate;
      }
    }

    const templateId = context.template.id;
    const category = context.template.metadata.category || 'default';

    if (this.commandTemplates.has(templateId)) {
      return this.commandTemplates.get(templateId)!;
    }

    for (const definition of this.commandTemplates.values()) {
      if (definition.categories.includes(category)) {
        return definition;
      }
    }

    const fallback = this.commandTemplates.get('default');
    if (!fallback) {
      throw new Error('Default command template is not registered');
    }
    return fallback;
  }

  /**
   * Build command metadata including arguments and tags
   */
  private buildMetadata(
    context: ClaudeCommandContext,
    commandTemplate: CommandTemplateDefinition,
    versionNumber: number,
    options: CommandGenerationOptions
  ): SlashCommandMetadata {
    const templateMetadata = context.template.metadata;
    const argumentHint = options.argumentHint || commandTemplate.argumentHint;
    const allowedTools = options.allowedTools || commandTemplate.allowedTools;
    const timeoutMs = options.timeoutMs || commandTemplate.timeoutMs;
    const autoSubmit =
      options.autoSubmit !== undefined
        ? options.autoSubmit
        : commandTemplate.autoSubmit;
    const tags = Array.from(
      new Set([
        ...commandTemplate.tags,
        ...(templateMetadata.tags || []),
        ...(options.tags || []),
      ])
    );

    const name =
      context.commandLabel || `Generate ${templateMetadata.name} Documentation`;
    const description =
      templateMetadata.description || commandTemplate.description;

    return {
      name,
      description,
      argumentHint,
      autoSubmit,
      allowedTools,
      timeoutMs,
      version: `v${versionNumber}`,
      tags,
      arguments: this.buildArgumentDefinitions(context),
    };
  }

  /**
   * Build command argument definitions based on template metadata
   */
  private buildArgumentDefinitions(
    context: ClaudeCommandContext
  ): CommandArgumentDefinition[] {
    const args: CommandArgumentDefinition[] = [
      {
        name: 'folder',
        description: 'Workspace folder path to analyze.',
        required: true,
        type: 'path',
        defaultValue: context.folderPath,
      },
    ];

    const templateVariables = context.template.metadata.variables || [];
    for (const variable of templateVariables) {
      const existing = args.find((arg) => arg.name === variable.name);
      if (existing) {
        continue;
      }

      args.push({
        name: variable.name,
        description: variable.description || 'Template variable',
        required: Boolean(variable.required),
        type: this.mapVariableType(variable),
        defaultValue: variable.default,
        options: variable.options,
      });
    }

    return args;
  }

  private mapVariableType(variable: TemplateVariable): CommandArgumentDefinition['type'] {
    switch (variable.type) {
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'date':
        return 'string';
      case 'select':
        return 'enum';
      default:
        return 'string';
    }
  }

  /**
   * Build the frontmatter section for the command file
   */
  private buildFrontmatter(metadata: SlashCommandMetadata): string {
    const allowedTools = metadata.allowedTools
      .map((tool) => `  - ${tool}`)
      .join('\n');
    const tags = metadata.tags.map((tag) => `  - ${tag}`).join('\n');
    const argumentsBlock = metadata.arguments
      .map((arg) => {
        const lines = [`  - name: ${arg.name}`];
        lines.push(`    description: ${arg.description}`);
        lines.push(`    required: ${arg.required}`);
        lines.push(`    type: ${arg.type}`);
        if (arg.defaultValue !== undefined) {
          lines.push(`    default: ${arg.defaultValue}`);
        }
        if (arg.options && arg.options.length > 0) {
          lines.push(`    options:`);
          arg.options.forEach((option) =>
            lines.push(`      - ${this.escapeYaml(option)}`)
          );
        }
        return lines.join('\n');
      })
      .join('\n');

    return `---
name: ${metadata.name}
description: ${metadata.description}
version: ${metadata.version}
argument-hint: ${metadata.argumentHint}
auto-submit: ${metadata.autoSubmit}
timeout-ms: ${metadata.timeoutMs}
allowed-tools:
${allowedTools || '  - read'}
tags:
${tags || '  - documentation'}
arguments:
${argumentsBlock || '  - name: folder\n    description: Workspace folder path to analyze.\n    required: true\n    type: path'}
---`;
  }

  /**
   * Generate the context section using folder analysis data
   */
  private generateContextSection(folderContext: FolderContext): string {
    let context = `# Project Context\n\n`;
    context += `**Project:** ${folderContext.name}\n`;
    context += `**Type:** ${folderContext.projectType}\n`;
    context += `**Location:** ${folderContext.folderPath}\n`;
    context += `**Files:** ${folderContext.totalFiles} files (${folderContext.totalLines} lines)\n\n`;

    if (folderContext.summary) {
      context += `**Summary:** ${folderContext.summary}\n\n`;
    }

    if (folderContext.dependencies.length > 0) {
      context += `## Dependencies\n\n`;
      const mainDeps = folderContext.dependencies
        .filter((d) => !d.isDevelopment)
        .slice(0, 8);
      const devDeps = folderContext.dependencies
        .filter((d) => d.isDevelopment)
        .slice(0, 5);

      if (mainDeps.length > 0) {
        context += `**Production:**\n`;
        mainDeps.forEach((dep) => {
          context += `- ${dep.packageName}${dep.version ? ` (${dep.version})` : ''}\n`;
        });
        context += '\n';
      }

      if (devDeps.length > 0) {
        context += `**Development:**\n`;
        devDeps.forEach((dep) => {
          context += `- ${dep.packageName}${dep.version ? ` (${dep.version})` : ''}\n`;
        });
        context += '\n';
      }
    }

    const importantFiles = this.getImportantFiles(folderContext);
    if (importantFiles.length > 0) {
      context += `## Important Files\n\n`;
      importantFiles.forEach((file) => {
        context += `- **${file.path}**${file.summary ? `: ${file.summary}` : ''}\n`;
      });
      context += '\n';
    }

    const codeStats = this.getCodeStatistics(folderContext);
    if (codeStats.totalFunctions > 0 || codeStats.totalClasses > 0) {
      context += `## Code Structure\n\n`;
      context += `- **Functions:** ${codeStats.totalFunctions}\n`;
      context += `- **Classes:** ${codeStats.totalClasses}\n`;
      context += `- **Interfaces:** ${codeStats.totalInterfaces}\n`;

      if (codeStats.topFiles.length > 0) {
        context += `\n**Key Code Files:**\n`;
        codeStats.topFiles.forEach((file) => {
          context += `- ${file.path}: ${file.functions} functions, ${file.classes} classes\n`;
        });
      }
      context += '\n';
    }

    const docInfo = folderContext.documentation;
    if (docInfo.readme || docInfo.changelog || docInfo.comments.length > 0) {
      context += `## Existing Documentation\n\n`;

      if (docInfo.readme) {
        context += `- **README found** (${docInfo.readme.length} characters)\n`;
      }

      if (docInfo.changelog) {
        context += `- **Changelog found** (${docInfo.changelog.length} characters)\n`;
      }

      if (docInfo.license) {
        context += `- **License found**\n`;
      }

      if (docInfo.comments.length > 0) {
        const jsdocComments = docInfo.comments.filter(
          (c) => c.type === 'jsdoc'
        ).length;
        context += `- **Code comments:** ${docInfo.comments.length} total`;
        if (jsdocComments > 0) {
          context += ` (${jsdocComments} JSDoc)`;
        }
        context += '\n';
      }

      context += '\n';
    }

    return context;
  }

  /**
   * Generate the prompt section that guides Claude Code
   */
  private generatePromptSection(
    commandTemplate: CommandTemplateDefinition,
    context: ClaudeCommandContext,
    outputPath: string
  ): string {
    const templateContext = this.buildTemplateContext(context, outputPath);
    const promptBody = this.applyTemplate(
      commandTemplate.promptTemplate,
      templateContext
    );

    let prompt = `# Documentation Generation Task\n\n${promptBody}\n\n`;

    prompt += this.buildVariableSection(context.variables);
    prompt += '\n';
    prompt += `## Template\n\n`;
    prompt += context.template.content;

    return prompt;
  }

  /**
   * Generate the output instruction section
   */
  private generateOutputInstructionsSection(
    commandTemplate: CommandTemplateDefinition,
    context: ClaudeCommandContext,
    outputPath: string
  ): string {
    const templateContext = this.buildTemplateContext(context, outputPath);
    const customInstructions = this.applyTemplate(
      commandTemplate.outputInstructions,
      templateContext
    );
    const qualityStandards = `### Quality Standards\n\n- Validate details against the current codebase\n- Use consistent Markdown heading structure\n- Highlight important configuration or prerequisites\n- Provide actionable examples where possible\n- Keep tone concise and professional`;

    return `## Output Instructions\n\n${customInstructions}\n\n${qualityStandards}\n`;
  }

  private buildVariableSection(variables: Record<string, any>): string {
    let section = `## Template Variables\n\n`;
    const entries = Object.entries(variables);
    if (entries.length === 0) {
      section += `No custom variables provided.\n`;
      return section;
    }

    for (const [key, value] of entries) {
      section += `- **${key}:** ${value}\n`;
    }
    return section;
  }

  private buildTemplateContext(
    context: ClaudeCommandContext,
    outputPath: string
  ): CommandTemplateContext {
    return {
      project: {
        name: context.folderContext.name,
        type: context.folderContext.projectType,
        path: context.folderContext.folderPath,
        summary: context.folderContext.summary,
        totalFiles: context.folderContext.totalFiles,
        totalLines: context.folderContext.totalLines,
      },
      template: context.template,
      variables: context.variables,
      outputPath,
    };
  }

  private applyTemplate(
    templateString: string,
    templateContext: CommandTemplateContext
  ): string {
    return templateString.replace(/{{\s*([\w.]+)\s*}}/g, (_, token) => {
      const value = this.resolveTemplateToken(token, templateContext);
      if (value === undefined || value === null) {
        return '';
      }
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
  }

  private resolveTemplateToken(
    token: string,
    templateContext: CommandTemplateContext
  ): any {
    const parts = token.split('.');
    let current: any = templateContext;

    for (const part of parts) {
      if (current && Object.prototype.hasOwnProperty.call(current, part)) {
        current = current[part as keyof typeof current];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private escapeYaml(value: string): string {
    if (/[:\-?\[\]{},&*!|>'"%@`]/.test(value)) {
      return `'${value.replace(/'/g, "''")}'`;
    }
    return value;
  }

  private getDefaultOutputPath(context: ClaudeCommandContext): string {
    const templateName = context.template.id.toLowerCase().replace(/\s+/g, '-');
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `${templateName}-${timestamp}.md`;
    return path.join(context.folderPath, 'docs', fileName);
  }

  private buildFileName(
    template: Template,
    versionNumber: number,
    options: CommandGenerationOptions
  ): string {
    if (options.fileName) {
      return options.fileName;
    }

    const slug = this.slugify(template.id);
    return `${slug}-command-${versionNumber}.md`;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getNextVersion(templateId: string): number {
    const current = this.templateVersions.get(templateId) || 0;
    const next = current + 1;
    this.templateVersions.set(templateId, next);
    return next;
  }

  private getImportantFiles(folderContext: FolderContext) {
    return folderContext.files
      .filter((file) => {
        const name = file.name.toLowerCase();
        const filePath = file.path.toLowerCase();
        return (
          name.includes('readme') ||
          name.includes('package.json') ||
          name.includes('main') ||
          name.includes('index') ||
          name.includes('app') ||
          name.includes('server') ||
          filePath.includes('src/') ||
          name.includes('config')
        );
      })
      .sort((a, b) => {
        const priority = (target: typeof a) => {
          if (target.name.toLowerCase().includes('readme')) {
            return 0;
          }
          if (target.name.toLowerCase().includes('package.json')) {
            return 1;
          }
          if (target.name.toLowerCase().includes('main')) {
            return 2;
          }
          if (target.name.toLowerCase().includes('index')) {
            return 3;
          }
          return 4;
        };
        return priority(a) - priority(b);
      })
      .slice(0, 10);
  }

  private getCodeStatistics(folderContext: FolderContext) {
    const structures = Array.from(folderContext.codeStructures.entries());

    const totalFunctions = structures.reduce(
      (sum, [, structure]) => sum + structure.functions.length,
      0
    );
    const totalClasses = structures.reduce(
      (sum, [, structure]) => sum + structure.classes.length,
      0
    );
    const totalInterfaces = structures.reduce(
      (sum, [, structure]) => sum + structure.interfaces.length,
      0
    );

    const topFiles = structures
      .map(([filePath, structure]) => ({
        path: filePath,
        functions: structure.functions.length,
        classes: structure.classes.length,
        total: structure.functions.length + structure.classes.length,
      }))
      .filter((file) => file.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      totalFunctions,
      totalClasses,
      totalInterfaces,
      topFiles,
    };
  }

  private initializeCommandTemplates(): void {
    const defaultTemplate: CommandTemplateDefinition = {
      id: 'default',
      name: 'Generate Documentation',
      description: 'Generate documentation using the selected template.',
      promptTemplate:
        'Create high-quality documentation for **{{project.name}}** using the template structure. Focus on clarity and completeness.' +
        ' Reference the project located at {{project.path}} and leverage the provided context summary.',
      outputInstructions:
        'Save the completed documentation to {{outputPath}}. Ensure the result follows the template structure and uses professional Markdown formatting.',
      variables: [],
      argumentHint: '[folder-path] [options]',
      allowedTools: ['read', 'write', 'bash'],
      autoSubmit: false,
      timeoutMs: 120000,
      tags: ['documentation'],
      categories: ['default', 'documentation'],
    };

    const helpTemplate: CommandTemplateDefinition = {
      id: 'help-docs',
      name: 'Help Documentation',
      description: 'Generate comprehensive help documentation for end users.',
      promptTemplate:
        'Craft user-focused help content for **{{project.name}}**. Include getting started steps, core features, usage examples, and troubleshooting guidance.',
      outputInstructions:
        'Organize the help documentation into sections for onboarding, feature tutorials, troubleshooting, and FAQs. Save to {{outputPath}}.',
      variables: ['projectName', 'version', 'supportEmail'],
      argumentHint: '[folder-path] --template help-docs',
      allowedTools: ['read', 'write', 'bash'],
      autoSubmit: false,
      timeoutMs: 120000,
      tags: ['help', 'user-docs'],
      categories: ['help', 'documentation'],
    };

    const apiTemplate: CommandTemplateDefinition = {
      id: 'api-docs',
      name: 'API Documentation',
      description: 'Generate detailed API documentation.',
      promptTemplate:
        'Produce API reference material covering endpoints, request/response schemas, authentication, and examples for **{{project.name}}**.',
      outputInstructions:
        'Ensure each endpoint includes method, path, request parameters, and example responses. Save to {{outputPath}}.',
      variables: ['apiVersion', 'baseUrl', 'authType'],
      argumentHint: '[folder-path] --template api-docs',
      allowedTools: ['read', 'write', 'bash'],
      autoSubmit: false,
      timeoutMs: 150000,
      tags: ['api', 'reference'],
      categories: ['api', 'backend'],
    };

    const techSpecTemplate: CommandTemplateDefinition = {
      id: 'tech-spec',
      name: 'Technical Specification',
      description: 'Generate technical specification documentation.',
      promptTemplate:
        'Create a technical specification capturing architecture, system components, data flow, and deployment details for **{{project.name}}**.',
      outputInstructions:
        'Structure the specification with sections for architecture, requirements, components, data model, and deployment. Save to {{outputPath}}.',
      variables: ['architecture', 'database', 'deployment'],
      argumentHint: '[folder-path] --template tech-spec',
      allowedTools: ['read', 'write', 'bash'],
      autoSubmit: false,
      timeoutMs: 180000,
      tags: ['specification', 'architecture'],
      categories: ['tech-spec', 'architecture'],
    };

    [defaultTemplate, helpTemplate, apiTemplate, techSpecTemplate].forEach(
      (template) => this.registerCommandTemplate(template)
    );
  }
}
