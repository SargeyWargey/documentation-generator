import * as vscode from 'vscode';
import {
  TemplateManager,
  Template,
  TemplateMetadata,
  TemplateVariable,
} from '../templates/TemplateManager';
import {
  TemplateValidator,
  ValidationResult,
} from '../templates/TemplateValidator';

export interface TemplateEditorOptions {
  template?: Template;
  mode: 'create' | 'edit';
}

export class TemplateEditor {
  private templateManager: TemplateManager;
  private validator: TemplateValidator;
  private panel: vscode.WebviewPanel | undefined;

  constructor(templateManager: TemplateManager) {
    this.templateManager = templateManager;
    this.validator = new TemplateValidator();
  }

  /**
   * Open the template editor in a new webview panel
   */
  async openEditor(options: TemplateEditorOptions): Promise<void> {
    const { template, mode } = options;

    // Create webview panel
    this.panel = vscode.window.createWebviewPanel(
      'templateEditor',
      mode === 'create'
        ? 'Create Template'
        : `Edit Template: ${template?.metadata.name}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );

    // Set up message handling
    this.setupMessageHandling();

    // Generate and set HTML content
    this.panel.webview.html = this.generateWebviewContent(template);

    // Handle panel disposal
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  /**
   * Setup message handling between webview and extension
   */
  private setupMessageHandling(): void {
    if (!this.panel) return;

    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'validateTemplate':
          await this.handleValidateTemplate(message.data);
          break;
        case 'saveTemplate':
          await this.handleSaveTemplate(message.data);
          break;
        case 'previewTemplate':
          await this.handlePreviewTemplate(message.data);
          break;
        case 'addVariable':
          await this.handleAddVariable();
          break;
        case 'removeVariable':
          await this.handleRemoveVariable(message.data.index);
          break;
        case 'exportTemplate':
          await this.handleExportTemplate(message.data);
          break;
        case 'importTemplate':
          await this.handleImportTemplate();
          break;
      }
    });
  }

  /**
   * Handle template validation request
   */
  private async handleValidateTemplate(templateData: any): Promise<void> {
    try {
      const template: Template = {
        id: templateData.id || 'temp',
        metadata: templateData.metadata,
        content: templateData.content,
        filePath: '',
      };

      const validation = this.validator.validateTemplate(template);

      this.panel?.webview.postMessage({
        command: 'validationResult',
        data: validation,
      });
    } catch (error) {
      this.panel?.webview.postMessage({
        command: 'validationResult',
        data: {
          isValid: false,
          errors: [`Validation error: ${error}`],
          warnings: [],
        },
      });
    }
  }

  /**
   * Handle template save request
   */
  private async handleSaveTemplate(templateData: any): Promise<void> {
    try {
      // Validate template first
      const template: Template = {
        id: templateData.id || `template-${Date.now()}`,
        metadata: templateData.metadata,
        content: templateData.content,
        filePath: '',
      };

      const validation = this.validator.validateTemplate(template);

      if (!validation.isValid) {
        vscode.window.showErrorMessage(
          `Template validation failed: ${validation.errors.join(', ')}`
        );
        return;
      }

      // Create template content with frontmatter
      const frontmatter = this.serializeFrontmatter(template.metadata);
      const fullContent = `---\n${frontmatter}\n---\n${template.content}`;

      // Save template using TemplateManager
      const tempFilePath = vscode.Uri.file(`${template.id}.md`);
      await vscode.workspace.fs.writeFile(
        tempFilePath,
        Buffer.from(fullContent)
      );

      await this.templateManager.installTemplate(tempFilePath.fsPath);

      // Clean up temp file
      await vscode.workspace.fs.delete(tempFilePath);

      vscode.window.showInformationMessage(
        `Template '${template.metadata.name}' saved successfully!`
      );

      this.panel?.webview.postMessage({
        command: 'templateSaved',
        data: { success: true },
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save template: ${error}`);
      this.panel?.webview.postMessage({
        command: 'templateSaved',
        data: { success: false, error: String(error) },
      });
    }
  }

  /**
   * Handle template preview request
   */
  private async handlePreviewTemplate(templateData: any): Promise<void> {
    try {
      // Create sample variables for preview
      const sampleVariables: Record<string, any> = {};

      if (templateData.metadata.variables) {
        for (const variable of templateData.metadata.variables) {
          switch (variable.type) {
            case 'string':
              sampleVariables[variable.name] =
                variable.default || `Sample ${variable.name}`;
              break;
            case 'number':
              sampleVariables[variable.name] = variable.default || 42;
              break;
            case 'boolean':
              sampleVariables[variable.name] =
                variable.default !== undefined ? variable.default : true;
              break;
            case 'date':
              sampleVariables[variable.name] =
                variable.default || new Date().toISOString().split('T')[0];
              break;
            case 'select':
              sampleVariables[variable.name] =
                variable.default || variable.options?.[0] || 'Option 1';
              break;
          }
        }
      }

      // Process template with sample variables
      const processedContent = this.processTemplateContent(
        templateData.content,
        sampleVariables
      );

      this.panel?.webview.postMessage({
        command: 'previewResult',
        data: { content: processedContent },
      });
    } catch (error) {
      this.panel?.webview.postMessage({
        command: 'previewResult',
        data: { error: String(error) },
      });
    }
  }

  /**
   * Handle add variable request
   */
  private async handleAddVariable(): Promise<void> {
    const newVariable: TemplateVariable = {
      name: '',
      description: '',
      type: 'string',
      required: false,
    };

    this.panel?.webview.postMessage({
      command: 'variableAdded',
      data: newVariable,
    });
  }

  /**
   * Handle remove variable request
   */
  private async handleRemoveVariable(index: number): Promise<void> {
    this.panel?.webview.postMessage({
      command: 'variableRemoved',
      data: { index },
    });
  }

  /**
   * Handle export template request
   */
  private async handleExportTemplate(templateData: any): Promise<void> {
    try {
      const frontmatter = this.serializeFrontmatter(templateData.metadata);
      const fullContent = `---\n${frontmatter}\n---\n${templateData.content}`;

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${templateData.metadata.name}.md`),
        filters: {
          'Markdown Files': ['md'],
          'All Files': ['*'],
        },
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(fullContent));
        vscode.window.showInformationMessage(
          `Template exported to ${uri.fsPath}`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export template: ${error}`);
    }
  }

  /**
   * Handle import template request
   */
  private async handleImportTemplate(): Promise<void> {
    try {
      const uri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'Markdown Files': ['md'],
          'All Files': ['*'],
        },
      });

      if (uri && uri[0]) {
        const content = await vscode.workspace.fs.readFile(uri[0]);
        const contentStr = Buffer.from(content).toString('utf8');

        // Parse the template content
        const frontmatterMatch = contentStr.match(
          /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
        );

        if (frontmatterMatch) {
          const [, frontmatter, templateContent] = frontmatterMatch;
          const metadata = this.parseFrontmatter(frontmatter);

          this.panel?.webview.postMessage({
            command: 'templateImported',
            data: {
              metadata,
              content: templateContent,
            },
          });
        } else {
          vscode.window.showErrorMessage('Invalid template file format');
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to import template: ${error}`);
    }
  }

  /**
   * Generate webview HTML content
   */
  private generateWebviewContent(template?: Template): string {
    const templateData = template
      ? {
          id: template.id,
          metadata: template.metadata,
          content: template.content,
        }
      : {
          id: '',
          metadata: {
            name: '',
            description: '',
            category: '',
            version: '1.0.0',
            variables: [],
          },
          content: '',
        };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Template Editor</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
        }

        .editor-container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }

        .section h2 {
            margin-top: 0;
            color: var(--vscode-textLink-foreground);
        }

        .form-group {
            margin-bottom: 15px;
        }

        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }

        input, textarea, select {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: inherit;
        }

        textarea {
            min-height: 200px;
            font-family: var(--vscode-editor-font-family);
        }

        .variable-item {
            border: 1px solid var(--vscode-panel-border);
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 4px;
        }

        .variable-controls {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
        }

        .button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-family: inherit;
        }

        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .button.danger {
            background-color: var(--vscode-errorBackground);
            color: var(--vscode-errorForeground);
        }

        .toolbar {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            padding: 10px;
            background-color: var(--vscode-panel-background);
            border-radius: 4px;
        }

        .validation-results {
            margin-top: 15px;
            padding: 10px;
            border-radius: 4px;
        }

        .validation-error {
            background-color: var(--vscode-errorBackground);
            color: var(--vscode-errorForeground);
        }

        .validation-warning {
            background-color: var(--vscode-warningBackground);
            color: var(--vscode-warningForeground);
        }

        .validation-success {
            background-color: var(--vscode-diffEditor-insertedTextBackground);
            color: var(--vscode-diffEditor-insertedTextForeground);
        }

        .preview-container {
            border: 1px solid var(--vscode-panel-border);
            padding: 15px;
            margin-top: 15px;
            border-radius: 4px;
            background-color: var(--vscode-editor-background);
        }

        .variable-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        @media (max-width: 768px) {
            .variable-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="editor-container">
        <div class="toolbar">
            <button class="button" onclick="validateTemplate()">Validate</button>
            <button class="button" onclick="previewTemplate()">Preview</button>
            <button class="button" onclick="saveTemplate()">Save</button>
            <button class="button secondary" onclick="exportTemplate()">Export</button>
            <button class="button secondary" onclick="importTemplate()">Import</button>
        </div>

        <div class="section">
            <h2>Template Metadata</h2>
            <div class="form-group">
                <label for="templateName">Name *</label>
                <input type="text" id="templateName" value="${templateData.metadata.name}" placeholder="Enter template name">
            </div>

            <div class="form-group">
                <label for="templateDescription">Description *</label>
                <textarea id="templateDescription" placeholder="Describe what this template is for">${templateData.metadata.description}</textarea>
            </div>

            <div class="variable-grid">
                <div class="form-group">
                    <label for="templateCategory">Category</label>
                    <input type="text" id="templateCategory" value="${templateData.metadata.category || ''}" placeholder="e.g., documentation, planning">
                </div>

                <div class="form-group">
                    <label for="templateVersion">Version</label>
                    <input type="text" id="templateVersion" value="${templateData.metadata.version || '1.0.0'}" placeholder="1.0.0">
                </div>
            </div>

            <div class="form-group">
                <label for="templateAuthor">Author</label>
                <input type="text" id="templateAuthor" value="${templateData.metadata.author || ''}" placeholder="Your name">
            </div>
        </div>

        <div class="section">
            <h2>Variables</h2>
            <div class="variable-controls">
                <button class="button" onclick="addVariable()">Add Variable</button>
            </div>
            <div id="variablesContainer">
                <!-- Variables will be populated here -->
            </div>
        </div>

        <div class="section">
            <h2>Template Content</h2>
            <div class="form-group">
                <label for="templateContent">Content (Use {{variableName}} for variables) *</label>
                <textarea id="templateContent" placeholder="Enter your template content here...">${templateData.content}</textarea>
            </div>

            <div id="previewContainer" class="preview-container" style="display: none;">
                <h3>Preview</h3>
                <div id="previewContent"></div>
            </div>
        </div>

        <div id="validationResults" class="validation-results" style="display: none;"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let variables = ${JSON.stringify(templateData.metadata.variables || [])};

        // Initialize variables display
        renderVariables();

        function renderVariables() {
            const container = document.getElementById('variablesContainer');
            container.innerHTML = '';

            variables.forEach((variable, index) => {
                const variableDiv = document.createElement('div');
                variableDiv.className = 'variable-item';
                variableDiv.innerHTML = \`
                    <div class="variable-grid">
                        <div class="form-group">
                            <label>Name *</label>
                            <input type="text" value="\${variable.name}" onchange="updateVariable(\${index}, 'name', this.value)">
                        </div>
                        <div class="form-group">
                            <label>Type</label>
                            <select onchange="updateVariable(\${index}, 'type', this.value)">
                                <option value="string" \${variable.type === 'string' ? 'selected' : ''}>String</option>
                                <option value="number" \${variable.type === 'number' ? 'selected' : ''}>Number</option>
                                <option value="boolean" \${variable.type === 'boolean' ? 'selected' : ''}>Boolean</option>
                                <option value="date" \${variable.type === 'date' ? 'selected' : ''}>Date</option>
                                <option value="select" \${variable.type === 'select' ? 'selected' : ''}>Select</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Description *</label>
                        <input type="text" value="\${variable.description}" onchange="updateVariable(\${index}, 'description', this.value)">
                    </div>
                    <div class="variable-grid">
                        <div class="form-group">
                            <label>Default Value</label>
                            <input type="text" value="\${variable.default || ''}" onchange="updateVariable(\${index}, 'default', this.value)">
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" \${variable.required ? 'checked' : ''} onchange="updateVariable(\${index}, 'required', this.checked)">
                                Required
                            </label>
                        </div>
                    </div>
                    \${variable.type === 'select' ? \`
                        <div class="form-group">
                            <label>Options (comma-separated)</label>
                            <input type="text" value="\${(variable.options || []).join(', ')}" onchange="updateVariableOptions(\${index}, this.value)">
                        </div>
                    \` : ''}
                    <button class="button danger" onclick="removeVariable(\${index})">Remove Variable</button>
                \`;
                container.appendChild(variableDiv);
            });
        }

        function updateVariable(index, property, value) {
            variables[index][property] = value;
        }

        function updateVariableOptions(index, value) {
            variables[index].options = value.split(',').map(s => s.trim()).filter(s => s);
        }

        function addVariable() {
            vscode.postMessage({
                command: 'addVariable'
            });
        }

        function removeVariable(index) {
            variables.splice(index, 1);
            renderVariables();
        }

        function getTemplateData() {
            return {
                id: '',
                metadata: {
                    name: document.getElementById('templateName').value,
                    description: document.getElementById('templateDescription').value,
                    category: document.getElementById('templateCategory').value,
                    version: document.getElementById('templateVersion').value,
                    author: document.getElementById('templateAuthor').value,
                    variables: variables
                },
                content: document.getElementById('templateContent').value
            };
        }

        function validateTemplate() {
            const templateData = getTemplateData();
            vscode.postMessage({
                command: 'validateTemplate',
                data: templateData
            });
        }

        function previewTemplate() {
            const templateData = getTemplateData();
            vscode.postMessage({
                command: 'previewTemplate',
                data: templateData
            });
        }

        function saveTemplate() {
            const templateData = getTemplateData();
            vscode.postMessage({
                command: 'saveTemplate',
                data: templateData
            });
        }

        function exportTemplate() {
            const templateData = getTemplateData();
            vscode.postMessage({
                command: 'exportTemplate',
                data: templateData
            });
        }

        function importTemplate() {
            vscode.postMessage({
                command: 'importTemplate'
            });
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'validationResult':
                    showValidationResult(message.data);
                    break;
                case 'previewResult':
                    showPreview(message.data);
                    break;
                case 'variableAdded':
                    variables.push(message.data);
                    renderVariables();
                    break;
                case 'templateImported':
                    loadImportedTemplate(message.data);
                    break;
            }
        });

        function showValidationResult(result) {
            const container = document.getElementById('validationResults');
            container.style.display = 'block';

            if (result.isValid) {
                container.className = 'validation-results validation-success';
                container.innerHTML = '<strong>✓ Template is valid!</strong>';
            } else {
                container.className = 'validation-results validation-error';
                container.innerHTML = \`
                    <strong>❌ Validation Errors:</strong>
                    <ul>\${result.errors.map(error => \`<li>\${error}</li>\`).join('')}</ul>
                    \${result.warnings.length > 0 ? \`
                        <strong>⚠️ Warnings:</strong>
                        <ul>\${result.warnings.map(warning => \`<li>\${warning}</li>\`).join('')}</ul>
                    \` : ''}
                \`;
            }
        }

        function showPreview(result) {
            const container = document.getElementById('previewContainer');
            const content = document.getElementById('previewContent');

            container.style.display = 'block';

            if (result.error) {
                content.innerHTML = \`<div class="validation-error">Preview Error: \${result.error}</div>\`;
            } else {
                content.innerHTML = \`<pre>\${result.content}</pre>\`;
            }
        }

        function loadImportedTemplate(data) {
            document.getElementById('templateName').value = data.metadata.name || '';
            document.getElementById('templateDescription').value = data.metadata.description || '';
            document.getElementById('templateCategory').value = data.metadata.category || '';
            document.getElementById('templateVersion').value = data.metadata.version || '1.0.0';
            document.getElementById('templateAuthor').value = data.metadata.author || '';
            document.getElementById('templateContent').value = data.content || '';

            variables = data.metadata.variables || [];
            renderVariables();
        }
    </script>
</body>
</html>`;
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
   * Process template content with variables (simplified version for preview)
   */
  private processTemplateContent(
    content: string,
    variables: Record<string, any>
  ): string {
    let result = content;

    // Replace {{variable}} patterns
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value));
    }

    // Add common variables
    const now = new Date();
    result = result.replace(/{{date}}/g, now.toLocaleDateString());
    result = result.replace(/{{datetime}}/g, now.toLocaleString());
    result = result.replace(/{{year}}/g, now.getFullYear().toString());

    return result;
  }
}
