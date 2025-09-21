import * as vscode from 'vscode';
import { TemplateManager, Template, TemplateMetadata } from '../templates/TemplateManager';

export class TemplateManagementPanel {
  public static readonly viewType = 'templateManagement';
  private static currentPanel: TemplateManagementPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, templateManager: TemplateManager) {
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
        retainContextWhenHidden: true
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
    console.log('TemplateManagementPanel: Initializing with template manager:', !!this.templateManager);
    this.initializeTemplates();
  }

  private async initializeTemplates() {
    // Give the webview a moment to load before sending initial templates
    setTimeout(async () => {
      console.log('TemplateManagementPanel: Sending initial templates to webview');
      await this.sendTemplates();
    }, 1000);
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
        await this.createTemplate(message.template);
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
      console.log(`TemplateManagementPanel: Loaded ${templatesArray.length} templates`);

      if (templatesArray.length > 0) {
        console.log('TemplateManagementPanel: Template details:', templatesArray.map(t => ({
          id: t.id,
          name: t.metadata.name,
          category: t.metadata.category,
          filePath: t.filePath
        })));
      }

      this.panel.webview.postMessage({
        type: 'templatesLoaded',
        templates: templatesArray
      });

      console.log('TemplateManagementPanel: Sent templates to webview');
    } catch (error) {
      console.error('TemplateManagementPanel: Error loading templates:', error);
      vscode.window.showErrorMessage(`Failed to load templates: ${error}`);

      // Send empty array so UI can show "no templates" state
      this.panel.webview.postMessage({
        type: 'templatesLoaded',
        templates: []
      });
    }
  }

  private async createTemplate(templateData: any) {
    try {
      const template: Template = {
        id: templateData.id || Date.now().toString(),
        metadata: templateData.metadata,
        content: templateData.content,
        filePath: ''
      };

      await this.templateManager.saveTemplate(template);
      await this.sendTemplates();
      vscode.window.showInformationMessage('Template created successfully!');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create template: ${error}`);
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
      const result = await this.templateManager.processTemplate(templateId, variables);
      this.panel.webview.postMessage({
        type: 'templatePreview',
        content: result
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
          'Template Files': ['json']
        }
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(JSON.stringify(template, null, 2))
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
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'Template Files': ['json']
        }
      });

      if (uri && uri[0]) {
        const content = await vscode.workspace.fs.readFile(uri[0]);
        const template: Template = JSON.parse(content.toString());

        // Generate new ID to avoid conflicts
        template.id = Date.now().toString();

        await this.templateManager.saveTemplate(template);
        await this.sendTemplates();
        vscode.window.showInformationMessage('Template imported successfully!');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to import template: ${error}`);
    }
  }

  private async update() {
    this.panel.webview.html = this.getWebviewContent();
  }

  private getWebviewContent(): string {
    const webview = this.panel.webview;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} https:; connect-src ${webview.cspSource};">
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
            border-bottom: 1px solid var(--vscode-widget-border);
            padding-bottom: 15px;
        }

        .header h1 {
            margin: 0;
            color: var(--vscode-title-foreground);
        }

        .actions {
            display: flex;
            gap: 10px;
        }

        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .template-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .template-card {
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            transition: border-color 0.2s;
        }

        .template-card:hover {
            border-color: var(--vscode-focusBorder);
        }

        .template-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 10px;
        }

        .template-title {
            font-weight: bold;
            color: var(--vscode-title-foreground);
            margin: 0;
        }

        .template-actions {
            display: flex;
            gap: 5px;
        }

        .template-actions button {
            padding: 4px 8px;
            font-size: 11px;
        }

        .template-description {
            color: var(--vscode-descriptionForeground);
            margin: 8px 0;
            font-size: 12px;
        }

        .template-meta {
            display: flex;
            gap: 10px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 10px;
        }

        .template-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 8px;
        }

        .tag {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
        }

        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .modal-content {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 20px;
            width: 90%;
            max-width: 600px;
            max-height: 80%;
            overflow-y: auto;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 3px;
            font-family: inherit;
            font-size: inherit;
        }

        .form-group textarea {
            min-height: 200px;
            font-family: var(--vscode-editor-font-family);
        }

        .form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
            border-top: 1px solid var(--vscode-widget-border);
            padding-top: 15px;
        }

        .variable-list {
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            padding: 10px;
            background-color: var(--vscode-input-background);
        }

        .variable-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 0;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .variable-item:last-child {
            border-bottom: none;
        }

        .preview-container {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 3px;
            padding: 15px;
            margin-top: 15px;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state h3 {
            margin: 0 0 10px 0;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Template Management</h1>
        <div class="actions">
            <button onclick="importTemplate()">Import Template</button>
            <button onclick="createNewTemplate()">Create New Template</button>
        </div>
    </div>

    <div id="templateGrid" class="template-grid">
        <div class="loading">Loading templates...</div>
    </div>

    <!-- Template Editor Modal -->
    <div id="templateModal" class="modal">
        <div class="modal-content">
            <h2 id="modalTitle">Create New Template</h2>
            <form id="templateForm">
                <div class="form-group">
                    <label for="templateName">Name *</label>
                    <input type="text" id="templateName" required>
                </div>

                <div class="form-group">
                    <label for="templateDescription">Description</label>
                    <textarea id="templateDescription" rows="3"></textarea>
                </div>

                <div class="form-group">
                    <label for="templateAuthor">Author</label>
                    <input type="text" id="templateAuthor">
                </div>

                <div class="form-group">
                    <label for="templateVersion">Version</label>
                    <input type="text" id="templateVersion" placeholder="1.0.0">
                </div>

                <div class="form-group">
                    <label for="templateCategory">Category</label>
                    <select id="templateCategory">
                        <option value="">Select category...</option>
                        <option value="documentation">Documentation</option>
                        <option value="prd">Product Requirements</option>
                        <option value="technical">Technical Specs</option>
                        <option value="help">Help Documentation</option>
                        <option value="meeting">Meeting Notes</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="templateTags">Tags (comma-separated)</label>
                    <input type="text" id="templateTags" placeholder="tag1, tag2, tag3">
                </div>

                <div class="form-group">
                    <label for="templateContent">Template Content *</label>
                    <textarea id="templateContent" required placeholder="Enter your template content with variables like {{variableName}}..."></textarea>
                </div>

                <div class="form-actions">
                    <button type="button" class="secondary" onclick="closeModal()">Cancel</button>
                    <button type="button" onclick="previewTemplate()">Preview</button>
                    <button type="submit">Save Template</button>
                </div>
            </form>

            <div id="previewSection" style="display: none;">
                <h3>Preview</h3>
                <div id="previewContent" class="preview-container"></div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const debugLog = (message) => {
            vscode.postMessage({ type: 'debugLog', message });
        };
        let templates = [];
        let currentTemplate = null;

        const requestTemplates = () => {
            debugLog('Requesting templates from extension');
            vscode.postMessage({ type: 'getTemplates' });
        };

        if (document.readyState === 'complete') {
            requestTemplates();
        } else {
            window.addEventListener('load', () => {
                debugLog('Webview load event fired');
                requestTemplates();
            });
        }

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            debugLog('Received message from extension: ' + message.type);

            switch (message.type) {
                case 'templatesLoaded':
                    templates = message.templates;
                    renderTemplates();
                    break;
                case 'templatePreview':
                    showPreview(message.content);
                    break;
            }
        });

        function renderTemplates() {
            const grid = document.getElementById('templateGrid');

            if (templates.length === 0) {
                grid.innerHTML = '<div class="empty-state"><h3>No templates found</h3><p>Create your first template to get started.</p></div>';
                return;
            }

            grid.innerHTML = templates.map(template => {
                const tagsHtml = template.metadata.tags && template.metadata.tags.length > 0
                    ? '<div class="template-tags">' +
                      template.metadata.tags.map(tag => '<span class="tag">' + tag + '</span>').join('') +
                      '</div>'
                    : '';

                return '<div class="template-card">' +
                    '<div class="template-header">' +
                        '<h3 class="template-title">' + template.metadata.name + '</h3>' +
                        '<div class="template-actions">' +
                            '<button onclick="editTemplate(\'' + template.id + '\')" class="secondary">Edit</button>' +
                            '<button onclick="exportTemplate(\'' + template.id + '\')" class="secondary">Export</button>' +
                            '<button onclick="deleteTemplate(\'' + template.id + '\')" class="secondary">Delete</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="template-description">' + (template.metadata.description || 'No description') + '</div>' +
                    '<div class="template-meta">' +
                        (template.metadata.author ? '<span>By: ' + template.metadata.author + '</span>' : '') +
                        (template.metadata.version ? '<span>v' + template.metadata.version + '</span>' : '') +
                        (template.metadata.category ? '<span>Category: ' + template.metadata.category + '</span>' : '') +
                    '</div>' +
                    tagsHtml +
                '</div>';
            }).join('');
        }

        function createNewTemplate() {
            currentTemplate = null;
            document.getElementById('modalTitle').textContent = 'Create New Template';
            document.getElementById('templateForm').reset();
            document.getElementById('previewSection').style.display = 'none';
            document.getElementById('templateModal').style.display = 'flex';
        }

        function editTemplate(templateId) {
            currentTemplate = templates.find(t => t.id === templateId);
            if (!currentTemplate) return;

            document.getElementById('modalTitle').textContent = 'Edit Template';
            document.getElementById('templateName').value = currentTemplate.metadata.name;
            document.getElementById('templateDescription').value = currentTemplate.metadata.description || '';
            document.getElementById('templateAuthor').value = currentTemplate.metadata.author || '';
            document.getElementById('templateVersion').value = currentTemplate.metadata.version || '';
            document.getElementById('templateCategory').value = currentTemplate.metadata.category || '';
            document.getElementById('templateTags').value = currentTemplate.metadata.tags ? currentTemplate.metadata.tags.join(', ') : '';
            document.getElementById('templateContent').value = currentTemplate.content;
            document.getElementById('previewSection').style.display = 'none';
            document.getElementById('templateModal').style.display = 'flex';
        }

        function closeModal() {
            document.getElementById('templateModal').style.display = 'none';
            currentTemplate = null;
        }

        function deleteTemplate(templateId) {
            if (confirm('Are you sure you want to delete this template?')) {
                debugLog('Requesting delete for template ' + templateId);
                vscode.postMessage({ type: 'deleteTemplate', templateId });
            }
        }

        function exportTemplate(templateId) {
            debugLog('Requesting export for template ' + templateId);
            vscode.postMessage({ type: 'exportTemplate', templateId });
        }

        function importTemplate() {
            debugLog('Requesting import template dialog');
            vscode.postMessage({ type: 'importTemplate' });
        }

        function previewTemplate() {
            const content = document.getElementById('templateContent').value;
            if (!content) {
                alert('Please enter template content first.');
                return;
            }

            // Extract variables from template content
            const variables = {};
            const matches = content.match(/\{\{(\w+)\}\}/g);
            if (matches) {
                matches.forEach(match => {
                    const varName = match.replace(/\{\{|\}\}/g, '');
                    variables[varName] = '[Sample ' + varName + ']';
                });
            }

            debugLog('Requesting preview for template ' + (currentTemplate?.id || 'preview'));
            vscode.postMessage({
                type: 'previewTemplate',
                templateId: currentTemplate?.id || 'preview',
                variables
            });
        }

        function showPreview(content) {
            document.getElementById('previewContent').textContent = content;
            document.getElementById('previewSection').style.display = 'block';
        }

        // Handle form submission
        document.getElementById('templateForm').addEventListener('submit', (e) => {
            e.preventDefault();

            const templateData = {
                id: currentTemplate?.id || Date.now().toString(),
                metadata: {
                    name: document.getElementById('templateName').value,
                    description: document.getElementById('templateDescription').value,
                    author: document.getElementById('templateAuthor').value,
                    version: document.getElementById('templateVersion').value,
                    category: document.getElementById('templateCategory').value,
                    tags: document.getElementById('templateTags').value
                        .split(',')
                        .map(tag => tag.trim())
                        .filter(tag => tag.length > 0)
                },
                content: document.getElementById('templateContent').value,
                filePath: currentTemplate?.filePath || ''
            };

            const messageType = currentTemplate ? 'updateTemplate' : 'createTemplate';
            debugLog('Submitting template with action ' + messageType);
            vscode.postMessage({ type: messageType, template: templateData });
            closeModal();
        });

        // Close modal when clicking outside
        document.getElementById('templateModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('templateModal')) {
                closeModal();
            }
        });
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
