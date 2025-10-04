import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TemplateManager, Template, TemplateMetadata } from './TemplateManager';
import { TemplateValidator } from './TemplateValidator';

export interface ShareableTemplate {
  template: Template;
  exportedAt: string;
  exportedBy: string;
  checksum: string;
}

export interface TemplateBundle {
  name: string;
  description: string;
  version: string;
  author: string;
  templates: ShareableTemplate[];
  createdAt: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  templates: Template[];
}

export class TemplateShareManager {
  private templateManager: TemplateManager;
  private validator: TemplateValidator;
  private readonly shareDirectory: string;

  constructor(
    templateManager: TemplateManager,
    extensionContext: vscode.ExtensionContext
  ) {
    this.templateManager = templateManager;
    this.validator = new TemplateValidator();
    this.shareDirectory = path.join(
      extensionContext.globalStorageUri?.fsPath || '',
      'shared-templates'
    );
  }

  /**
   * Initialize the share manager
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.shareDirectory, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Export a single template to file
   */
  async exportTemplate(
    templateId: string,
    exportPath?: string
  ): Promise<string> {
    const template = this.templateManager.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // Create shareable template with metadata
    const shareableTemplate: ShareableTemplate = {
      template,
      exportedAt: new Date().toISOString(),
      exportedBy: await this.getCurrentUser(),
      checksum: await this.calculateChecksum(template),
    };

    // Generate export content
    const exportContent = this.createTemplateExportContent(shareableTemplate);

    // Determine export path
    const finalPath =
      exportPath || (await this.promptForExportPath(template.metadata.name));
    if (!finalPath) {
      throw new Error('Export cancelled');
    }

    // Write file
    await fs.writeFile(finalPath, exportContent);

    return finalPath;
  }

  /**
   * Export multiple templates as a bundle
   */
  async exportTemplateBundle(
    templateIds: string[],
    bundleInfo?: Partial<TemplateBundle>
  ): Promise<string> {
    const templates: ShareableTemplate[] = [];

    // Collect all templates
    for (const templateId of templateIds) {
      const template = this.templateManager.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template '${templateId}' not found`);
      }

      templates.push({
        template,
        exportedAt: new Date().toISOString(),
        exportedBy: await this.getCurrentUser(),
        checksum: await this.calculateChecksum(template),
      });
    }

    // Create bundle
    const bundle: TemplateBundle = {
      name: bundleInfo?.name || 'Template Bundle',
      description: bundleInfo?.description || 'A collection of templates',
      version: bundleInfo?.version || '1.0.0',
      author: bundleInfo?.author || (await this.getCurrentUser()),
      templates,
      createdAt: new Date().toISOString(),
    };

    // Prompt for export path
    const exportPath = await this.promptForBundleExportPath(bundle.name);
    if (!exportPath) {
      throw new Error('Export cancelled');
    }

    // Write bundle file
    await fs.writeFile(exportPath, JSON.stringify(bundle, null, 2));

    return exportPath;
  }

  /**
   * Import a template from file
   */
  async importTemplate(
    filePath: string,
    options?: { overwrite?: boolean; validate?: boolean }
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [],
      templates: [],
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Try to parse as bundle first, then as single template
      let templates: ShareableTemplate[];

      try {
        const bundle: TemplateBundle = JSON.parse(content);
        if (bundle.templates && Array.isArray(bundle.templates)) {
          templates = bundle.templates;
        } else {
          throw new Error('Not a bundle');
        }
      } catch {
        // Try as single template
        try {
          const shareableTemplate: ShareableTemplate = JSON.parse(content);
          templates = [shareableTemplate];
        } catch {
          // Try as raw template content
          const template = await this.parseRawTemplateContent(
            content,
            filePath
          );
          templates = [
            {
              template,
              exportedAt: new Date().toISOString(),
              exportedBy: 'Unknown',
              checksum: await this.calculateChecksum(template),
            },
          ];
        }
      }

      // Import each template
      for (const shareableTemplate of templates) {
        try {
          await this.importSingleTemplate(shareableTemplate, options);
          result.imported++;
          result.templates.push(shareableTemplate.template);
        } catch (error) {
          result.errors.push(
            `Failed to import ${shareableTemplate.template.metadata.name}: ${error}`
          );
          result.skipped++;
        }
      }

      result.success = result.imported > 0;
    } catch (error) {
      result.errors.push(`Failed to read or parse file: ${error}`);
    }

    return result;
  }

  /**
   * Show template sharing dialog
   */
  async showShareDialog(): Promise<void> {
    const templates = this.templateManager.getTemplates();

    if (templates.length === 0) {
      vscode.window.showInformationMessage('No templates available to share');
      return;
    }

    const action = await vscode.window.showQuickPick(
      [
        {
          label: '$(export) Export Single Template',
          description: 'Export one template to a file',
          action: 'single',
        },
        {
          label: '$(package) Export Template Bundle',
          description: 'Export multiple templates as a bundle',
          action: 'bundle',
        },
        {
          label: '$(cloud-upload) Share to Team Repository',
          description: 'Share templates with your team',
          action: 'team',
        },
      ],
      {
        placeHolder: 'How would you like to share templates?',
      }
    );

    if (!action) return;

    switch (action.action) {
      case 'single':
        await this.handleSingleExport();
        break;
      case 'bundle':
        await this.handleBundleExport();
        break;
      case 'team':
        await this.handleTeamShare();
        break;
    }
  }

  /**
   * Show template import dialog
   */
  async showImportDialog(): Promise<void> {
    const action = await vscode.window.showQuickPick(
      [
        {
          label: '$(file-add) Import from File',
          description: 'Import templates from a file',
          action: 'file',
        },
        {
          label: '$(repo) Import from Team Repository',
          description: 'Import shared team templates',
          action: 'team',
        },
        {
          label: '$(globe) Browse Template Marketplace',
          description: 'Find templates from the community',
          action: 'marketplace',
        },
      ],
      {
        placeHolder: 'How would you like to import templates?',
      }
    );

    if (!action) return;

    switch (action.action) {
      case 'file':
        await this.handleFileImport();
        break;
      case 'team':
        await this.handleTeamImport();
        break;
      case 'marketplace':
        await this.handleMarketplaceImport();
        break;
    }
  }

  /**
   * Handle single template export
   */
  private async handleSingleExport(): Promise<void> {
    const templates = this.templateManager.getTemplates();
    const templateItems = templates.map((t) => ({
      label: t.metadata.name,
      description: t.metadata.description,
      detail: `Version: ${t.metadata.version || 'N/A'} | Category: ${t.metadata.category || 'None'}`,
      template: t,
    }));

    const selected = await vscode.window.showQuickPick(templateItems, {
      placeHolder: 'Select a template to export',
    });

    if (selected) {
      try {
        const exportPath = await this.exportTemplate(selected.template.id);
        vscode.window.showInformationMessage(
          `Template exported to: ${exportPath}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Export failed: ${error}`);
      }
    }
  }

  /**
   * Handle bundle export
   */
  private async handleBundleExport(): Promise<void> {
    const templates = this.templateManager.getTemplates();
    const templateItems = templates.map((t) => ({
      label: t.metadata.name,
      description: t.metadata.description,
      picked: false,
    }));

    const selected = await vscode.window.showQuickPick(templateItems, {
      placeHolder: 'Select templates to include in bundle',
      canPickMany: true,
    });

    if (selected && selected.length > 0) {
      // Get bundle info
      const bundleName = await vscode.window.showInputBox({
        prompt: 'Bundle name',
        value: 'My Template Bundle',
      });

      if (!bundleName) return;

      const bundleDescription = await vscode.window.showInputBox({
        prompt: 'Bundle description',
        value: 'A collection of useful templates',
      });

      const templateIds = selected
        .map((s) => templates.find((t) => t.metadata.name === s.label)?.id)
        .filter(Boolean) as string[];

      try {
        const exportPath = await this.exportTemplateBundle(templateIds, {
          name: bundleName,
          description: bundleDescription || '',
        });
        vscode.window.showInformationMessage(
          `Bundle exported to: ${exportPath}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Bundle export failed: ${error}`);
      }
    }
  }

  /**
   * Handle team sharing
   */
  private async handleTeamShare(): Promise<void> {
    // This would integrate with team repositories (Git, shared drives, etc.)
    vscode.window.showInformationMessage(
      'Team sharing will be available in a future version'
    );
  }

  /**
   * Handle file import
   */
  private async handleFileImport(): Promise<void> {
    const fileUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'Template Files': ['json', 'md'],
        'All Files': ['*'],
      },
      title: 'Select Template File to Import',
    });

    if (fileUri && fileUri[0]) {
      try {
        const result = await this.importTemplate(fileUri[0].fsPath);

        if (result.success) {
          const message = `Successfully imported ${result.imported} template(s)`;
          const details =
            result.skipped > 0 ? ` (${result.skipped} skipped)` : '';
          vscode.window.showInformationMessage(message + details);
        } else {
          vscode.window.showErrorMessage(
            `Import failed: ${result.errors.join(', ')}`
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Import failed: ${error}`);
      }
    }
  }

  /**
   * Handle team import
   */
  private async handleTeamImport(): Promise<void> {
    vscode.window.showInformationMessage(
      'Team import will be available in a future version'
    );
  }

  /**
   * Handle marketplace import
   */
  private async handleMarketplaceImport(): Promise<void> {
    vscode.window.showInformationMessage(
      'Template marketplace will be available in a future version'
    );
  }

  /**
   * Create template export content
   */
  private createTemplateExportContent(
    shareableTemplate: ShareableTemplate
  ): string {
    return JSON.stringify(shareableTemplate, null, 2);
  }

  /**
   * Import a single template
   */
  private async importSingleTemplate(
    shareableTemplate: ShareableTemplate,
    options?: { overwrite?: boolean; validate?: boolean }
  ): Promise<void> {
    const { template } = shareableTemplate;

    // Validate template if requested
    if (options?.validate !== false) {
      const validation = this.validator.validateTemplate(template);
      if (!validation.isValid) {
        throw new Error(
          `Template validation failed: ${validation.errors.join(', ')}`
        );
      }
    }

    // Check if template already exists
    const existing = this.templateManager.getTemplate(template.id);
    if (existing && !options?.overwrite) {
      throw new Error(`Template '${template.id}' already exists`);
    }

    // Create template file content
    const frontmatter = this.serializeFrontmatter(template.metadata);
    const fullContent = `---\n${frontmatter}\n---\n${template.content}`;

    // Create temporary file and install
    const tempFilePath = path.join(this.shareDirectory, `${template.id}.md`);
    await fs.writeFile(tempFilePath, fullContent);

    try {
      await this.templateManager.installTemplate(tempFilePath);
      await fs.unlink(tempFilePath); // Clean up temp file
    } catch (error) {
      await fs.unlink(tempFilePath); // Clean up temp file even on error
      throw error;
    }
  }

  /**
   * Parse raw template content
   */
  private async parseRawTemplateContent(
    content: string,
    filePath: string
  ): Promise<Template> {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      throw new Error('Template must have frontmatter metadata');
    }

    const [, frontmatter, templateContent] = frontmatterMatch;
    const metadata = this.parseFrontmatter(frontmatter);
    const id = path.basename(filePath, path.extname(filePath));

    return {
      id,
      metadata,
      content: templateContent,
      filePath,
    };
  }

  /**
   * Parse frontmatter to metadata
   */
  private parseFrontmatter(frontmatter: string): TemplateMetadata {
    const lines = frontmatter.split('\n');
    const metadata: any = {};

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();

        if (key.trim() === 'tags' || key.trim() === 'variables') {
          try {
            metadata[key.trim()] = JSON.parse(value);
          } catch {
            metadata[key.trim()] = value.split(',').map((v) => v.trim());
          }
        } else {
          metadata[key.trim()] = value;
        }
      }
    }

    return metadata as TemplateMetadata;
  }

  /**
   * Serialize metadata to frontmatter format
   */
  private serializeFrontmatter(metadata: TemplateMetadata): string {
    const lines: string[] = [];

    lines.push(`name: ${metadata.name}`);
    lines.push(`description: ${metadata.description}`);

    if (metadata.category) lines.push(`category: ${metadata.category}`);
    if (metadata.version) lines.push(`version: ${metadata.version}`);
    if (metadata.author) lines.push(`author: ${metadata.author}`);
    if (metadata.tags && metadata.tags.length > 0) {
      lines.push(`tags: ${JSON.stringify(metadata.tags)}`);
    }
    if (metadata.variables && metadata.variables.length > 0) {
      lines.push(`variables: ${JSON.stringify(metadata.variables)}`);
    }

    return lines.join('\n');
  }

  /**
   * Calculate checksum for template integrity
   */
  private async calculateChecksum(template: Template): Promise<string> {
    const content = JSON.stringify({
      metadata: template.metadata,
      content: template.content,
    });

    // Simple hash function for checksum
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Get current user identifier
   */
  private async getCurrentUser(): Promise<string> {
    try {
      const config = vscode.workspace.getConfiguration();
      const gitUserName = config.get<string>('git.user.name');
      if (gitUserName) return gitUserName;

      // Fallback to system user
      return process.env.USER || process.env.USERNAME || 'Unknown User';
    } catch {
      return 'Unknown User';
    }
  }

  /**
   * Prompt for export path
   */
  private async promptForExportPath(
    templateName: string
  ): Promise<string | undefined> {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${templateName}.json`),
      filters: {
        'Template Files': ['json'],
        'All Files': ['*'],
      },
      title: 'Export Template',
    });

    return uri?.fsPath;
  }

  /**
   * Prompt for bundle export path
   */
  private async promptForBundleExportPath(
    bundleName: string
  ): Promise<string | undefined> {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${bundleName}.json`),
      filters: {
        'Bundle Files': ['json'],
        'All Files': ['*'],
      },
      title: 'Export Template Bundle',
    });

    return uri?.fsPath;
  }
}
