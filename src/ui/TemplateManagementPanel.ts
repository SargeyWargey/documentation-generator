import * as vscode from 'vscode';
import * as path from 'path';
import {
  TemplateManager,
  Template,
  TemplateMetadata,
} from '../templates/TemplateManager';

export class TemplateManagementPanel {
  public static readonly viewType = 'templateManagement';
  private static currentPanel: TemplateManagementPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    templateManager: TemplateManager
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (TemplateManagementPanel.currentPanel) {
      TemplateManagementPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      TemplateManagementPanel.viewType,
      'Template Management',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
        retainContextWhenHidden: true,
      }
    );

    TemplateManagementPanel.currentPanel = new TemplateManagementPanel(
      panel,
      extensionUri,
      templateManager
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly templateManager: TemplateManager
  ) {
    this.panel = panel;
    this.update();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      null,
      this.disposables
    );

    // Initialize templates on startup
    console.log(
      'TemplateManagementPanel: Initializing with template manager:',
      !!this.templateManager
    );
    this.initializeTemplates();
  }

  private async initializeTemplates() {
    // Give the webview a moment to load before sending initial templates
    setTimeout(async () => {
      console.log(
        'TemplateManagementPanel: Sending initial templates to webview'
      );
      await this.sendTemplates();
    }, 1000);
  }

  private async startTemplateCreationFlow(): Promise<void> {
    try {
      const name = await vscode.window.showInputBox({
        title: 'New Template',
        prompt: 'Enter a name for your template',
        placeHolder: 'Release Notes',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Template name is required';
          }
          return undefined;
        },
      });

      if (!name) {
        return;
      }

      const description = await vscode.window.showInputBox({
        title: 'Template Description',
        prompt: 'Briefly describe how this template will be used',
        placeHolder: 'Documentation template for release notes',
      });

      const category = await vscode.window.showInputBox({
        title: 'Template Category',
        prompt: 'Optionally categorize this template',
        placeHolder: 'custom',
        value: 'custom',
      });

      const tagsInput = await vscode.window.showInputBox({
        title: 'Template Tags',
        prompt: 'Add comma-separated tags to help find this template later',
        placeHolder: 'custom, release',
        value: 'custom',
      });

      const templateId = this.templateManager.generateUniqueTemplateId(name);
      const parsedTags = this.parseTagsInput(tagsInput);

      const metadata: TemplateMetadata = {
        name: name.trim(),
        description:
          description?.trim() ||
          'Custom documentation template created from Template Management.',
        author: this.getDefaultAuthor(),
        version: '1.0.0',
        category: category?.trim() || 'custom',
        tags: parsedTags.length > 0 ? parsedTags : ['custom'],
      };

      const placeholderContent = `# {{title}}\n\n<!-- Write your template content here -->\n\n## Overview\n\nProvide the main context for this document.\n\n## Details\n\nAdd the sections, tables, or lists you need.\n`;

      const template: Template = {
        id: templateId,
        metadata,
        content: placeholderContent,
        filePath: '',
      };

      await this.templateManager.saveTemplate(template);
      await this.sendTemplates();

      const savedTemplate = this.templateManager.getTemplate(templateId);
      if (savedTemplate?.filePath) {
        const document = await vscode.workspace.openTextDocument(
          savedTemplate.filePath
        );
        await vscode.window.showTextDocument(document, {
          preview: false,
        });
        vscode.window.showInformationMessage(
          'Template created! Customize the opened file and save your changes.'
        );
      } else {
        vscode.window.showInformationMessage(
          'Template created successfully. You can edit it from the Templates list.'
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to create template: ${(error as Error).message}`
      );
    }
  }

  private async handleMessage(message: any) {
    switch (message.type) {
      case 'getTemplates':
        await this.sendTemplates();
        break;
      case 'debugLog':
        console.log('[TemplateManagementPanel Webview]', message.message);
        break;
      case 'createTemplate':
        if (message.template) {
          await this.createTemplate(message.template);
        } else {
          await this.startTemplateCreationFlow();
        }
        break;
      case 'editTemplate':
        await this.editTemplate(message.templateId);
        break;
      case 'updateTemplate':
        await this.updateTemplate(message.template);
        break;
      case 'deleteTemplate':
        await this.deleteTemplate(message.templateId);
        break;
      case 'previewTemplate':
        await this.previewTemplate(message.templateId, message.variables);
        break;
      case 'exportTemplate':
        await this.exportTemplate(message.templateId);
        break;
      case 'importTemplate':
        await this.importTemplate();
        break;
    }
  }

  private async sendTemplates() {
    try {
      console.log('TemplateManagementPanel: Attempting to load templates...');

      // Force re-initialization if needed
      if (!this.templateManager) {
        throw new Error('Template manager not initialized');
      }

      const templatesMap = await this.templateManager.getAllTemplates();
      const templatesArray = Array.from(templatesMap.values());
      console.log(
        `TemplateManagementPanel: Loaded ${templatesArray.length} templates`
      );

      if (templatesArray.length > 0) {
        console.log(
          'TemplateManagementPanel: Template details:',
          templatesArray.map((t) => ({
            id: t.id,
            name: t.metadata.name,
            category: t.metadata.category,
            filePath: t.filePath,
          }))
        );
      }

      this.panel.webview.postMessage({
        type: 'templatesLoaded',
        templates: templatesArray,
      });

      console.log('TemplateManagementPanel: Sent templates to webview');
    } catch (error) {
      console.error('TemplateManagementPanel: Error loading templates:', error);
      vscode.window.showErrorMessage(`Failed to load templates: ${error}`);

      // Send empty array so UI can show "no templates" state
      this.panel.webview.postMessage({
        type: 'templatesLoaded',
        templates: [],
      });
    }
  }

  private async createTemplate(templateData: any) {
    try {
      if (!templateData || !templateData.metadata || !templateData.content) {
        await this.startTemplateCreationFlow();
        return;
      }

      const templateId = templateData.id
        ? String(templateData.id)
        : this.templateManager.generateUniqueTemplateId(
            templateData.metadata.name || 'template'
          );

      const template: Template = {
        id: templateId,
        metadata: {
          ...templateData.metadata,
          name:
            templateData.metadata.name?.trim() ||
            this.toTitleCase(templateId.replace(/-/g, ' ')),
          description:
            templateData.metadata.description?.trim() ||
            'Custom documentation template',
          category: templateData.metadata.category || 'custom',
          version: templateData.metadata.version || '1.0.0',
          tags:
            templateData.metadata.tags?.length > 0
              ? templateData.metadata.tags
              : ['custom'],
        },
        content: templateData.content,
        filePath: '',
      };

      await this.templateManager.saveTemplate(template);
      await this.sendTemplates();
      vscode.window.showInformationMessage('Template created successfully!');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create template: ${error}`);
    }
  }

  private async editTemplate(templateId: string) {
    try {
      const template = await this.templateManager.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Open template file for editing
      if (template.filePath) {
        const document = await vscode.workspace.openTextDocument(
          template.filePath
        );
        await vscode.window.showTextDocument(document);
      } else {
        vscode.window.showWarningMessage(
          'Template file path not found. Please export and re-import this template.'
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to edit template: ${error}`);
    }
  }

  private async updateTemplate(templateData: any) {
    try {
      await this.templateManager.saveTemplate(templateData);
      await this.sendTemplates();
      vscode.window.showInformationMessage('Template updated successfully!');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update template: ${error}`);
    }
  }

  private async deleteTemplate(templateId: string) {
    try {
      await this.templateManager.deleteTemplate(templateId);
      await this.sendTemplates();
      vscode.window.showInformationMessage('Template deleted successfully!');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete template: ${error}`);
    }
  }

  private async previewTemplate(templateId: string, variables: any) {
    try {
      const result = await this.templateManager.processTemplate(
        templateId,
        variables
      );
      this.panel.webview.postMessage({
        type: 'templatePreview',
        content: result,
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to preview template: ${error}`);
    }
  }

  private async exportTemplate(templateId: string) {
    try {
      const template = await this.templateManager.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${template.metadata.name}.json`),
        filters: {
          'Template Files': ['json'],
        },
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(JSON.stringify(template, null, 2), 'utf8')
        );
        vscode.window.showInformationMessage('Template exported successfully!');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export template: ${error}`);
    }
  }

  private async importTemplate() {
    try {
      const uri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: false,
        filters: {
          'Template Files': ['json', 'md'],
          'All Files': ['*'],
        },
      });

      if (uri && uri[0]) {
        const selectedUri = uri[0];
        const contentBuffer = await vscode.workspace.fs.readFile(selectedUri);
        const fileContent = Buffer.from(contentBuffer).toString('utf8');

        if (selectedUri.fsPath.endsWith('.json')) {
          const templateData = JSON.parse(fileContent);
          const fallbackName = path
            .basename(selectedUri.fsPath, path.extname(selectedUri.fsPath))
            .replace(/[-_]/g, ' ');

          const template = await this.normalizeImportedTemplate(
            templateData,
            fallbackName
          );

          await this.templateManager.saveTemplate(template);
          await this.sendTemplates();
          vscode.window.showInformationMessage(
            `Template "${template.metadata.name}" imported successfully!`
          );
        } else {
          const imported = await this.importMarkdownTemplate(
            selectedUri,
            fileContent
          );
          await this.sendTemplates();
          vscode.window.showInformationMessage(
            `Template "${imported.metadata.name}" imported successfully!`
          );
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to import template: ${error}`);
    }
  }

  private parseTagsInput(input?: string | null): string[] {
    if (!input) {
      return [];
    }

    return input
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  private getDefaultAuthor(): string {
    const config = vscode.workspace.getConfiguration('documentation-generator');
    return (
      config.get<string>('defaultAuthor') ||
      config.get<string>('authorName') ||
      process.env.USER ||
      'User'
    );
  }

  private toTitleCase(value: string): string {
    return value
      .split(/\s+|-/)
      .filter((part) => part.length > 0)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private extractFirstHeading(markdown: string): string | undefined {
    const match = markdown.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : undefined;
  }

  private async normalizeImportedTemplate(
    templateData: any,
    fallbackName: string
  ): Promise<Template> {
    if (!templateData) {
      throw new Error('Template data is empty');
    }

    const metadata: Partial<TemplateMetadata> = templateData.metadata || {};

    const name = metadata.name?.trim() || this.toTitleCase(fallbackName);
    const description =
      metadata.description?.trim() || `Imported template for ${name}`;
    const category = metadata.category?.trim() || 'imported';
    let tags = Array.isArray(metadata.tags)
      ? metadata.tags.filter((tag) => Boolean(tag))
      : this.parseTagsInput(metadata.tags as unknown as string);

    if (tags.length === 0) {
      tags = ['imported'];
    }

    if (!templateData.content || !String(templateData.content).trim()) {
      throw new Error('Template content is missing');
    }

    const templateId = this.templateManager.generateUniqueTemplateId(
      templateData.id || name
    );

    return {
      id: templateId,
      metadata: {
        ...metadata,
        name,
        description,
        category,
        tags,
        author: metadata.author || 'Imported',
        version: metadata.version || '1.0.0',
      },
      content: String(templateData.content),
      filePath: '',
    };
  }

  private async importMarkdownTemplate(
    selectedUri: vscode.Uri,
    fileContent: string
  ): Promise<Template> {
    try {
      const installedTemplate = await this.templateManager.installTemplate(
        selectedUri.fsPath
      );
      return installedTemplate;
    } catch (error) {
      console.warn(
        'TemplateManagementPanel: Failed to install markdown template via TemplateManager. Falling back to manual import.',
        error
      );
      return this.createTemplateFromMarkdownContent(
        path.basename(selectedUri.fsPath, path.extname(selectedUri.fsPath)),
        fileContent
      );
    }
  }

  private async createTemplateFromMarkdownContent(
    baseName: string,
    fileContent: string
  ): Promise<Template> {
    const firstHeading = this.extractFirstHeading(fileContent);
    const name = firstHeading || this.toTitleCase(baseName);
    const templateId = this.templateManager.generateUniqueTemplateId(baseName);

    const template: Template = {
      id: templateId,
      metadata: {
        name,
        description: `Imported template from ${name}`,
        author: 'Imported',
        version: '1.0.0',
        category: 'imported',
        tags: ['imported'],
      },
      content: fileContent,
      filePath: '',
    };

    await this.templateManager.saveTemplate(template);
    return (
      this.templateManager.getTemplate(template.id) || template
    );
  }

  private async update() {
    this.panel.webview.html = this.getWebviewContent();
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Template Management</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
        }
        .actions {
            display: flex;
            gap: 10px;
        }
        .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
        }
        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .templates-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .template-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            padding: 15px;
            transition: border-color 0.2s;
        }
        .template-card:hover {
            border-color: var(--vscode-focusBorder);
        }
        .template-title {
            font-weight: bold;
            margin-bottom: 8px;
            color: var(--vscode-editor-foreground);
        }
        .template-meta {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 10px;
        }
        .template-description {
            font-size: 13px;
            color: var(--vscode-editor-foreground);
            margin-bottom: 10px;
        }
        .template-tags {
            margin-bottom: 15px;
        }
        .tag {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 11px;
            margin-right: 5px;
        }
        .template-actions {
            display: flex;
            gap: 8px;
        }
        .btn-small {
            padding: 4px 8px;
            font-size: 11px;
        }
        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Template Management</h1>
        <div class="actions">
            <button class="btn" id="import-btn">📁 Import Template</button>
            <button class="btn" id="create-btn">➕ Create New Template</button>
        </div>
    </div>

    <div id="loading" class="loading">Loading templates...</div>
    <div id="templates-container" style="display: none;">
        <div id="templates-grid" class="templates-grid"></div>
    </div>

    <div id="empty-state" class="empty-state" style="display: none;">
        <h3>No templates available</h3>
        <p>Import existing templates or create new ones to get started.</p>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        console.log('Template Management Panel script loaded');

        let templates = [];

        // Functions for button handlers
        function importTemplate() {
            console.log('Import template clicked');
            vscode.postMessage({ type: 'importTemplate' });
        }

        function createNewTemplate() {
            console.log('Create new template clicked');
            vscode.postMessage({
                type: 'createTemplate'
            });
        }

        function editTemplate(templateId) {
            console.log('Edit template:', templateId);
            vscode.postMessage({
                type: 'editTemplate',
                templateId: templateId
            });
        }

        function deleteTemplate(templateId, templateName) {
            if (confirm('Are you sure you want to delete template: ' + templateName + '?')) {
                console.log('Delete template:', templateId);
                vscode.postMessage({
                    type: 'deleteTemplate',
                    templateId: templateId
                });
            }
        }

        function exportTemplate(templateId) {
            console.log('Export template:', templateId);
            vscode.postMessage({
                type: 'exportTemplate',
                templateId: templateId
            });
        }

        function previewTemplate(templateId) {
            console.log('Preview template:', templateId);
            vscode.postMessage({
                type: 'previewTemplate',
                templateId: templateId,
                variables: {}
            });
        }

        // Message handler
        window.addEventListener('message', event => {
            const message = event.data;
            console.log('Received message:', message.type);

            switch (message.type) {
                case 'templatesLoaded':
                    templates = message.templates || [];
                    renderTemplates();
                    break;
            }
        });

        function renderTemplates() {
            const loadingEl = document.getElementById('loading');
            const containerEl = document.getElementById('templates-container');
            const emptyStateEl = document.getElementById('empty-state');
            const gridEl = document.getElementById('templates-grid');

            loadingEl.style.display = 'none';

            if (templates.length === 0) {
                containerEl.style.display = 'none';
                emptyStateEl.style.display = 'block';
                return;
            }

            emptyStateEl.style.display = 'none';
            containerEl.style.display = 'block';

            gridEl.innerHTML = templates.map(template => {
                const metadata = template.metadata || {};
                const name = metadata.name || 'Unnamed Template';
                const description = metadata.description || 'No description available';
                const author = metadata.author || 'Unknown';
                const version = metadata.version || '1.0.0';
                const category = metadata.category || 'general';
                const tags = metadata.tags || [];

                return \`
                <div class="template-card">
                    <div class="template-title">\${name}</div>
                    <div class="template-meta">
                        Category: \${category} | Version: \${version} | Author: \${author}
                    </div>
                    <div class="template-description">\${description}</div>
                    <div class="template-tags">
                        \${tags.map(tag => \`<span class="tag">\${tag}</span>\`).join('')}
                    </div>
                    <div class="template-actions">
                        <button class="btn btn-small template-action" data-action="preview" data-id="\${template.id}">👁 Preview</button>
                        <button class="btn btn-small btn-secondary template-action" data-action="edit" data-id="\${template.id}">✏️ Edit</button>
                        <button class="btn btn-small btn-secondary template-action" data-action="export" data-id="\${template.id}">📤 Export</button>
                        <button class="btn btn-small btn-secondary template-action" data-action="delete" data-id="\${template.id}" data-name="\${name}">🗑 Delete</button>
                    </div>
                </div>
                \`;
            }).join('');

            // Add event delegation for template action buttons
            gridEl.addEventListener('click', function(event) {
                const button = event.target.closest('.template-action');
                if (button) {
                    const action = button.dataset.action;
                    const templateId = button.dataset.id;
                    const templateName = button.dataset.name;

                    switch (action) {
                        case 'preview':
                            previewTemplate(templateId);
                            break;
                        case 'edit':
                            editTemplate(templateId);
                            break;
                        case 'export':
                            exportTemplate(templateId);
                            break;
                        case 'delete':
                            deleteTemplate(templateId, templateName);
                            break;
                    }
                }
            });
        }

        // Add event listeners immediately (DOM should be ready since script is at bottom)
        const importBtn = document.getElementById('import-btn');
        const createBtn = document.getElementById('create-btn');

        if (importBtn) {
            importBtn.addEventListener('click', importTemplate);
            console.log('Import button event listener added');
        } else {
            console.error('Import button not found in DOM');
        }

        if (createBtn) {
            createBtn.addEventListener('click', createNewTemplate);
            console.log('Create button event listener added');
        } else {
            console.error('Create button not found in DOM');
        }

        // Request templates on load
        console.log('Requesting templates...');
        vscode.postMessage({ type: 'getTemplates' });
    </script>
</body>
</html>`;
  }

  public dispose() {
    TemplateManagementPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
