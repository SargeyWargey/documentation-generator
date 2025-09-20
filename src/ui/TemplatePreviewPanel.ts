import * as vscode from 'vscode';
import { TemplateManager, Template, TemplateVariable } from '../templates/TemplateManager';
import { FolderAnalyzer } from '../utils/FolderAnalyzer';

export interface PreviewOptions {
  template: Template;
  testVariables?: Record<string, any>;
  sampleFolder?: string;
}

export interface TestScenario {
  name: string;
  description: string;
  variables: Record<string, any>;
  expectedOutputs?: string[];
}

export class TemplatePreviewPanel {
  private templateManager: TemplateManager;
  private folderAnalyzer: FolderAnalyzer;
  private panel: vscode.WebviewPanel | undefined;
  private currentTemplate: Template | undefined;

  constructor(templateManager: TemplateManager, folderAnalyzer: FolderAnalyzer) {
    this.templateManager = templateManager;
    this.folderAnalyzer = folderAnalyzer;
  }

  /**
   * Open the template preview panel
   */
  async openPreview(options: PreviewOptions): Promise<void> {
    const { template, testVariables, sampleFolder } = options;
    this.currentTemplate = template;

    // Create webview panel
    this.panel = vscode.window.createWebviewPanel(
      'templatePreview',
      `Preview: ${template.metadata.name}`,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );

    // Set up message handling
    this.setupMessageHandling();

    // Generate and set HTML content
    this.panel.webview.html = await this.generatePreviewHTML(template, testVariables, sampleFolder);

    // Handle panel disposal
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.currentTemplate = undefined;
    });
  }

  /**
   * Setup message handling between webview and extension
   */
  private setupMessageHandling(): void {
    if (!this.panel) return;

    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'updatePreview':
          await this.handleUpdatePreview(message.data);
          break;
        case 'runTest':
          await this.handleRunTest(message.data);
          break;
        case 'generateSampleData':
          await this.handleGenerateSampleData(message.data);
          break;
        case 'saveTestScenario':
          await this.handleSaveTestScenario(message.data);
          break;
        case 'exportPreview':
          await this.handleExportPreview(message.data);
          break;
        case 'selectFolder':
          await this.handleSelectFolder();
          break;
      }
    });
  }

  /**
   * Handle preview update request
   */
  private async handleUpdatePreview(data: { variables: Record<string, any>; folderPath?: string }): Promise<void> {
    if (!this.currentTemplate) return;

    try {
      // Add folder context if provided
      let contextVariables = { ...data.variables };

      if (data.folderPath) {
        const folderContext = await this.folderAnalyzer.analyzeFolder(data.folderPath);
        contextVariables = {
          ...contextVariables,
          projectName: folderContext.name,
          folderStructure: this.formatFolderStructure(folderContext.files),
          fileCount: folderContext.files.length,
          dependencies: folderContext.dependencies.join(', '),
          ...this.extractContextVariables(folderContext)
        };
      }

      // Process template
      const processedContent = await this.templateManager.processTemplate(
        this.currentTemplate.id,
        contextVariables
      );

      this.panel?.webview.postMessage({
        command: 'previewUpdated',
        data: {
          content: processedContent,
          variables: contextVariables
        }
      });

    } catch (error) {
      this.panel?.webview.postMessage({
        command: 'previewError',
        data: { error: String(error) }
      });
    }
  }

  /**
   * Handle test scenario execution
   */
  private async handleRunTest(data: { scenario: TestScenario; folderPath?: string }): Promise<void> {
    if (!this.currentTemplate) return;

    try {
      const { scenario, folderPath } = data;

      // Add folder context if provided
      let testVariables = { ...scenario.variables };

      if (folderPath) {
        const folderContext = await this.folderAnalyzer.analyzeFolder(folderPath);
        testVariables = {
          ...testVariables,
          ...this.extractContextVariables(folderContext)
        };
      }

      // Process template with test variables
      const result = await this.templateManager.processTemplate(
        this.currentTemplate.id,
        testVariables
      );

      // Analyze the result
      const analysis = this.analyzeTestResult(result, scenario);

      this.panel?.webview.postMessage({
        command: 'testResult',
        data: {
          scenario: scenario.name,
          result,
          analysis,
          success: analysis.success
        }
      });

    } catch (error) {
      this.panel?.webview.postMessage({
        command: 'testResult',
        data: {
          scenario: data.scenario.name,
          result: '',
          analysis: {
            success: false,
            errors: [String(error)],
            warnings: []
          },
          success: false
        }
      });
    }
  }

  /**
   * Handle sample data generation
   */
  private async handleGenerateSampleData(data: { folderPath?: string }): Promise<void> {
    if (!this.currentTemplate) return;

    try {
      const sampleData = await this.generateSampleVariables(this.currentTemplate, data.folderPath);

      this.panel?.webview.postMessage({
        command: 'sampleDataGenerated',
        data: sampleData
      });

    } catch (error) {
      this.panel?.webview.postMessage({
        command: 'sampleDataError',
        data: { error: String(error) }
      });
    }
  }

  /**
   * Handle save test scenario request
   */
  private async handleSaveTestScenario(data: { scenario: TestScenario }): Promise<void> {
    try {
      // Save test scenario to workspace settings or a dedicated file
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
      }

      const testFilePath = vscode.Uri.joinPath(
        workspaceFolder.uri,
        '.vscode',
        'template-tests.json'
      );

      let existingTests: TestScenario[] = [];
      try {
        const existingContent = await vscode.workspace.fs.readFile(testFilePath);
        existingTests = JSON.parse(Buffer.from(existingContent).toString());
      } catch {
        // File doesn't exist yet
      }

      // Add or update scenario
      const existingIndex = existingTests.findIndex(t => t.name === data.scenario.name);
      if (existingIndex >= 0) {
        existingTests[existingIndex] = data.scenario;
      } else {
        existingTests.push(data.scenario);
      }

      await vscode.workspace.fs.writeFile(
        testFilePath,
        Buffer.from(JSON.stringify(existingTests, null, 2))
      );

      vscode.window.showInformationMessage(`Test scenario '${data.scenario.name}' saved`);

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save test scenario: ${error}`);
    }
  }

  /**
   * Handle export preview request
   */
  private async handleExportPreview(data: { content: string; format: string }): Promise<void> {
    try {
      const fileName = `${this.currentTemplate?.metadata.name || 'template'}-preview`;
      const extension = data.format === 'html' ? 'html' : 'md';

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${fileName}.${extension}`),
        filters: {
          'Markdown Files': ['md'],
          'HTML Files': ['html'],
          'All Files': ['*']
        }
      });

      if (uri) {
        let content = data.content;

        if (data.format === 'html') {
          content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${this.currentTemplate?.metadata.name} Preview</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; }
        code { background: #f5f5f5; padding: 2px 4px; border-radius: 2px; }
    </style>
</head>
<body>
${this.markdownToHtml(data.content)}
</body>
</html>`;
        }

        await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
        vscode.window.showInformationMessage(`Preview exported to ${uri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export preview: ${error}`);
    }
  }

  /**
   * Handle folder selection
   */
  private async handleSelectFolder(): Promise<void> {
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Folder for Context'
    });

    if (folderUri && folderUri[0]) {
      this.panel?.webview.postMessage({
        command: 'folderSelected',
        data: { path: folderUri[0].fsPath }
      });
    }
  }

  /**
   * Generate sample variables for testing
   */
  private async generateSampleVariables(template: Template, folderPath?: string): Promise<Record<string, any>> {
    const variables: Record<string, any> = {};

    if (template.metadata.variables) {
      for (const variable of template.metadata.variables) {
        switch (variable.type) {
          case 'string':
            variables[variable.name] = variable.default || this.generateSampleString(variable.name);
            break;
          case 'number':
            variables[variable.name] = variable.default || Math.floor(Math.random() * 100) + 1;
            break;
          case 'boolean':
            variables[variable.name] = variable.default !== undefined ? variable.default : Math.random() > 0.5;
            break;
          case 'date':
            variables[variable.name] = variable.default || new Date().toISOString().split('T')[0];
            break;
          case 'select':
            variables[variable.name] = variable.default || variable.options?.[0] || 'Option 1';
            break;
        }
      }
    }

    // Add folder context if available
    if (folderPath) {
      const folderContext = await this.folderAnalyzer.analyzeFolder(folderPath);
      Object.assign(variables, this.extractContextVariables(folderContext));
    }

    return variables;
  }

  /**
   * Generate realistic sample string based on variable name
   */
  private generateSampleString(variableName: string): string {
    const name = variableName.toLowerCase();

    if (name.includes('name') || name.includes('title')) {
      return 'Sample Project';
    } else if (name.includes('description')) {
      return 'This is a sample description for testing purposes.';
    } else if (name.includes('author')) {
      return 'John Doe';
    } else if (name.includes('email')) {
      return 'john.doe@example.com';
    } else if (name.includes('url') || name.includes('link')) {
      return 'https://example.com';
    } else if (name.includes('version')) {
      return '1.0.0';
    } else {
      return `Sample ${variableName}`;
    }
  }

  /**
   * Extract context variables from folder analysis
   */
  private extractContextVariables(folderContext: any): Record<string, any> {
    return {
      projectName: folderContext.name || 'Unknown Project',
      fileCount: folderContext.files?.length || 0,
      folderCount: folderContext.folders?.length || 0,
      mainLanguage: this.detectMainLanguage(folderContext.files || []),
      hasTests: folderContext.files?.some((f: any) => f.name.includes('test') || f.name.includes('spec')) || false,
      hasReadme: folderContext.files?.some((f: any) => f.name.toLowerCase().includes('readme')) || false,
      dependencies: folderContext.dependencies?.slice(0, 5).join(', ') || 'None',
      totalLines: folderContext.totalLines || 0
    };
  }

  /**
   * Detect main programming language from files
   */
  private detectMainLanguage(files: any[]): string {
    const extensions: Record<string, number> = {};

    files.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext) {
        extensions[ext] = (extensions[ext] || 0) + 1;
      }
    });

    const sortedExts = Object.entries(extensions).sort((a, b) => b[1] - a[1]);
    const topExt = sortedExts[0]?.[0];

    const languageMap: Record<string, string> = {
      'js': 'JavaScript',
      'ts': 'TypeScript',
      'py': 'Python',
      'java': 'Java',
      'cs': 'C#',
      'cpp': 'C++',
      'c': 'C',
      'go': 'Go',
      'rs': 'Rust',
      'php': 'PHP',
      'rb': 'Ruby'
    };

    return languageMap[topExt] || 'Unknown';
  }

  /**
   * Format folder structure for display
   */
  private formatFolderStructure(structure: any): string {
    // Simplified folder structure formatting
    if (!structure) return 'No structure available';

    try {
      return JSON.stringify(structure, null, 2).slice(0, 500) + '...';
    } catch {
      return 'Unable to format structure';
    }
  }

  /**
   * Analyze test result
   */
  private analyzeTestResult(result: string, scenario: TestScenario): { success: boolean; errors: string[]; warnings: string[] } {
    const analysis = {
      success: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    // Check if result is empty
    if (!result.trim()) {
      analysis.success = false;
      analysis.errors.push('Generated content is empty');
      return analysis;
    }

    // Check for unresolved variables
    const unresolvedVariables = result.match(/{{[^}]+}}/g);
    if (unresolvedVariables) {
      analysis.success = false;
      analysis.errors.push(`Unresolved variables found: ${unresolvedVariables.join(', ')}`);
    }

    // Check expected outputs if provided
    if (scenario.expectedOutputs) {
      for (const expected of scenario.expectedOutputs) {
        if (!result.includes(expected)) {
          analysis.warnings.push(`Expected content not found: "${expected}"`);
        }
      }
    }

    // Check for basic markdown structure if it looks like markdown
    if (result.includes('#') || result.includes('##')) {
      if (!result.includes('# ')) {
        analysis.warnings.push('Markdown document may be missing proper heading structure');
      }
    }

    return analysis;
  }

  /**
   * Simple markdown to HTML conversion for export
   */
  private markdownToHtml(markdown: string): string {
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\`(.*)\`/gim, '<code>$1</code>')
      .replace(/\n/gim, '<br>');
  }

  /**
   * Generate the webview HTML content
   */
  private async generatePreviewHTML(template: Template, testVariables?: Record<string, any>, sampleFolder?: string): Promise<string> {
    const variables = testVariables || await this.generateSampleVariables(template, sampleFolder);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Template Preview</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 0;
            display: flex;
            height: 100vh;
        }

        .sidebar {
            width: 300px;
            background-color: var(--vscode-panel-background);
            border-right: 1px solid var(--vscode-panel-border);
            padding: 20px;
            overflow-y: auto;
        }

        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .toolbar {
            padding: 15px 20px;
            background-color: var(--vscode-panel-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .preview-container {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
        }

        .form-group {
            margin-bottom: 15px;
        }

        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            font-size: 0.9em;
        }

        input, select, textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: 0.9em;
            border-radius: 3px;
        }

        .button {
            padding: 8px 12px;
            border: none;
            border-radius: 3px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-family: inherit;
            font-size: 0.9em;
        }

        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .section {
            margin-bottom: 25px;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }

        .section h3 {
            margin-top: 0;
            margin-bottom: 15px;
            color: var(--vscode-textLink-foreground);
        }

        .preview-content {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 20px;
            font-family: var(--vscode-editor-font-family);
            white-space: pre-wrap;
            overflow-wrap: break-word;
        }

        .test-scenario {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 10px;
        }

        .test-result {
            margin-top: 10px;
            padding: 10px;
            border-radius: 4px;
        }

        .test-success {
            background-color: var(--vscode-diffEditor-insertedTextBackground);
            color: var(--vscode-diffEditor-insertedTextForeground);
        }

        .test-error {
            background-color: var(--vscode-errorBackground);
            color: var(--vscode-errorForeground);
        }

        .test-warning {
            background-color: var(--vscode-warningBackground);
            color: var(--vscode-warningForeground);
        }

        .context-info {
            background-color: var(--vscode-panel-background);
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 0.8em;
        }

        .variable-list {
            max-height: 300px;
            overflow-y: auto;
        }

        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 15px;
        }

        .tab {
            padding: 10px 15px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
        }

        .tab.active {
            border-bottom-color: var(--vscode-textLink-foreground);
            color: var(--vscode-textLink-foreground);
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="tabs">
            <div class="tab active" onclick="switchTab('variables')">Variables</div>
            <div class="tab" onclick="switchTab('testing')">Testing</div>
        </div>

        <div id="variablesTab" class="tab-content active">
            <div class="context-info" id="contextInfo">
                <strong>Template:</strong> ${template.metadata.name}<br>
                <strong>Version:</strong> ${template.metadata.version || 'N/A'}<br>
                <strong>Variables:</strong> ${template.metadata.variables?.length || 0}
            </div>

            <div class="section">
                <h3>Context</h3>
                <button class="button secondary" onclick="selectFolder()">Select Folder</button>
                <div id="folderInfo" style="margin-top: 10px; font-size: 0.8em;">
                    ${sampleFolder ? `Selected: ${sampleFolder}` : 'No folder selected'}
                </div>
            </div>

            <div class="section">
                <h3>Variables</h3>
                <div class="variable-list" id="variablesList">
                    <!-- Variables will be populated here -->
                </div>
                <div style="margin-top: 15px;">
                    <button class="button secondary" onclick="generateSampleData()">Generate Sample Data</button>
                    <button class="button" onclick="updatePreview()">Update Preview</button>
                </div>
            </div>
        </div>

        <div id="testingTab" class="tab-content">
            <div class="section">
                <h3>Test Scenarios</h3>
                <div id="testScenarios">
                    <!-- Test scenarios will be populated here -->
                </div>
                <button class="button secondary" onclick="addTestScenario()">Add Test Scenario</button>
            </div>

            <div class="section">
                <h3>Quick Test</h3>
                <button class="button" onclick="runQuickTest()">Run Quick Test</button>
                <div id="quickTestResult"></div>
            </div>
        </div>
    </div>

    <div class="main-content">
        <div class="toolbar">
            <button class="button" onclick="updatePreview()">Refresh</button>
            <button class="button secondary" onclick="exportPreview('md')">Export MD</button>
            <button class="button secondary" onclick="exportPreview('html')">Export HTML</button>
            <div style="margin-left: auto; font-size: 0.9em;">
                Preview will update automatically as you change variables
            </div>
        </div>

        <div class="preview-container">
            <div class="preview-content" id="previewContent">
                Loading preview...
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentVariables = ${JSON.stringify(variables)};
        let selectedFolder = ${sampleFolder ? `"${sampleFolder}"` : 'null'};
        let testScenarios = [];

        // Initialize
        renderVariables();
        updatePreview();

        function switchTab(tabName) {
            // Update tab appearance
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            document.querySelector(\`[onclick="switchTab('\${tabName}')"]\`).classList.add('active');
            document.getElementById(\`\${tabName}Tab\`).classList.add('active');
        }

        function renderVariables() {
            const container = document.getElementById('variablesList');
            const template = ${JSON.stringify(template)};

            if (!template.metadata.variables || template.metadata.variables.length === 0) {
                container.innerHTML = '<div style="color: var(--vscode-descriptionForeground);">No variables defined</div>';
                return;
            }

            container.innerHTML = '';

            template.metadata.variables.forEach(variable => {
                const value = currentVariables[variable.name] || variable.default || '';

                const variableDiv = document.createElement('div');
                variableDiv.className = 'form-group';

                let inputHtml = '';
                if (variable.type === 'select' && variable.options) {
                    inputHtml = \`<select onchange="updateVariable('\${variable.name}', this.value)">\`;
                    variable.options.forEach(option => {
                        const selected = value === option ? 'selected' : '';
                        inputHtml += \`<option value="\${option}" \${selected}>\${option}</option>\`;
                    });
                    inputHtml += '</select>';
                } else if (variable.type === 'boolean') {
                    const checked = value === true || value === 'true' ? 'checked' : '';
                    inputHtml = \`<input type="checkbox" \${checked} onchange="updateVariable('\${variable.name}', this.checked)">\`;
                } else if (variable.type === 'date') {
                    inputHtml = \`<input type="date" value="\${value}" onchange="updateVariable('\${variable.name}', this.value)">\`;
                } else if (variable.type === 'number') {
                    inputHtml = \`<input type="number" value="\${value}" onchange="updateVariable('\${variable.name}', this.value)">\`;
                } else {
                    inputHtml = \`<input type="text" value="\${value}" onchange="updateVariable('\${variable.name}', this.value)">\`;
                }

                variableDiv.innerHTML = \`
                    <label>\${variable.name} \${variable.required ? '*' : ''}</label>
                    \${inputHtml}
                    <div style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 5px;">
                        \${variable.description}
                    </div>
                \`;

                container.appendChild(variableDiv);
            });
        }

        function updateVariable(name, value) {
            currentVariables[name] = value;
            debounce(updatePreview, 500)();
        }

        function updatePreview() {
            vscode.postMessage({
                command: 'updatePreview',
                data: {
                    variables: currentVariables,
                    folderPath: selectedFolder
                }
            });
        }

        function generateSampleData() {
            vscode.postMessage({
                command: 'generateSampleData',
                data: {
                    folderPath: selectedFolder
                }
            });
        }

        function selectFolder() {
            vscode.postMessage({
                command: 'selectFolder'
            });
        }

        function exportPreview(format) {
            const content = document.getElementById('previewContent').textContent;
            vscode.postMessage({
                command: 'exportPreview',
                data: {
                    content: content,
                    format: format
                }
            });
        }

        function addTestScenario() {
            const name = prompt('Test scenario name:');
            if (!name) return;

            const description = prompt('Test scenario description:');

            const scenario = {
                name: name,
                description: description || '',
                variables: { ...currentVariables }
            };

            testScenarios.push(scenario);
            renderTestScenarios();
        }

        function renderTestScenarios() {
            const container = document.getElementById('testScenarios');
            container.innerHTML = '';

            testScenarios.forEach((scenario, index) => {
                const scenarioDiv = document.createElement('div');
                scenarioDiv.className = 'test-scenario';
                scenarioDiv.innerHTML = \`
                    <strong>\${scenario.name}</strong><br>
                    <small>\${scenario.description}</small><br>
                    <button class="button" onclick="runTest(\${index})">Run Test</button>
                    <button class="button secondary" onclick="saveTestScenario(\${index})">Save</button>
                    <div id="testResult\${index}"></div>
                \`;
                container.appendChild(scenarioDiv);
            });
        }

        function runTest(index) {
            const scenario = testScenarios[index];
            vscode.postMessage({
                command: 'runTest',
                data: {
                    scenario: scenario,
                    folderPath: selectedFolder
                }
            });
        }

        function runQuickTest() {
            const quickScenario = {
                name: 'Quick Test',
                description: 'Quick test with current variables',
                variables: currentVariables
            };

            vscode.postMessage({
                command: 'runTest',
                data: {
                    scenario: quickScenario,
                    folderPath: selectedFolder
                }
            });
        }

        function saveTestScenario(index) {
            const scenario = testScenarios[index];
            vscode.postMessage({
                command: 'saveTestScenario',
                data: { scenario: scenario }
            });
        }

        // Utility function for debouncing
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'previewUpdated':
                    document.getElementById('previewContent').textContent = message.data.content;
                    break;
                case 'previewError':
                    document.getElementById('previewContent').innerHTML =
                        \`<div class="test-error">Error: \${message.data.error}</div>\`;
                    break;
                case 'sampleDataGenerated':
                    currentVariables = message.data;
                    renderVariables();
                    updatePreview();
                    break;
                case 'folderSelected':
                    selectedFolder = message.data.path;
                    document.getElementById('folderInfo').textContent = \`Selected: \${selectedFolder}\`;
                    updatePreview();
                    break;
                case 'testResult':
                    showTestResult(message.data);
                    break;
            }
        });

        function showTestResult(data) {
            const resultId = data.scenario === 'Quick Test' ? 'quickTestResult' : \`testResult\${testScenarios.findIndex(s => s.name === data.scenario)}\`;
            const container = document.getElementById(resultId);

            if (!container) return;

            const cssClass = data.success ? 'test-success' : 'test-error';

            let resultHtml = \`<div class="test-result \${cssClass}">
                <strong>Result:</strong> \${data.success ? '✓ Pass' : '✗ Fail'}<br>
            \`;

            if (data.analysis.errors.length > 0) {
                resultHtml += \`<strong>Errors:</strong><ul>\${data.analysis.errors.map(e => \`<li>\${e}</li>\`).join('')}</ul>\`;
            }

            if (data.analysis.warnings.length > 0) {
                resultHtml += \`<strong>Warnings:</strong><ul>\${data.analysis.warnings.map(w => \`<li>\${w}</li>\`).join('')}</ul>\`;
            }

            resultHtml += '</div>';
            container.innerHTML = resultHtml;
        }
    </script>
</body>
</html>`;
  }
}