import * as vscode from 'vscode';
import { TemplateVariable } from '../templates/TemplateManager';
import { TemplateValidator } from '../templates/TemplateValidator';

export interface VariableEditorOptions {
  variable?: TemplateVariable;
  mode: 'create' | 'edit';
  existingVariables: TemplateVariable[];
}

export class VariableDefinitionEditor {
  private validator: TemplateValidator;

  constructor() {
    this.validator = new TemplateValidator();
  }

  /**
   * Show a detailed variable definition dialog
   */
  async showVariableEditor(
    options: VariableEditorOptions
  ): Promise<TemplateVariable | undefined> {
    const { variable, mode, existingVariables } = options;

    // Create and show the webview panel for variable editing
    const panel = vscode.window.createWebviewPanel(
      'variableEditor',
      mode === 'create'
        ? 'Create Variable'
        : `Edit Variable: ${variable?.name}`,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    return new Promise<TemplateVariable | undefined>((resolve) => {
      let resolved = false;

      // Handle messages from webview
      panel.webview.onDidReceiveMessage(async (message) => {
        if (resolved) return;

        switch (message.command) {
          case 'save':
            const validationResult = this.validateVariable(
              message.data,
              existingVariables
            );
            if (validationResult.isValid) {
              resolved = true;
              panel.dispose();
              resolve(message.data);
            } else {
              // Send validation errors back to webview
              panel.webview.postMessage({
                command: 'validationErrors',
                data: validationResult.errors,
              });
            }
            break;
          case 'cancel':
            resolved = true;
            panel.dispose();
            resolve(undefined);
            break;
          case 'validate':
            const result = this.validateVariable(
              message.data,
              existingVariables
            );
            panel.webview.postMessage({
              command: 'validationResult',
              data: result,
            });
            break;
        }
      });

      // Handle panel disposal
      panel.onDidDispose(() => {
        if (!resolved) {
          resolved = true;
          resolve(undefined);
        }
      });

      // Set webview content
      panel.webview.html = this.generateVariableEditorHTML(
        variable,
        existingVariables
      );
    });
  }

  /**
   * Show a quick variable creation input
   */
  async showQuickVariableInput(): Promise<TemplateVariable | undefined> {
    // Show input boxes for quick variable creation
    const name = await vscode.window.showInputBox({
      prompt: 'Variable name (alphanumeric and underscore only)',
      placeHolder: 'variable_name',
      validateInput: (value) => {
        if (!value) return 'Variable name is required';
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
          return 'Variable name must start with a letter and contain only letters, numbers, and underscores';
        }
        return undefined;
      },
    });

    if (!name) return undefined;

    const description = await vscode.window.showInputBox({
      prompt: 'Variable description',
      placeHolder: 'Describe what this variable is for',
    });

    if (!description) return undefined;

    const typeOptions = [
      { label: 'String', detail: 'Text value' },
      { label: 'Number', detail: 'Numeric value' },
      { label: 'Boolean', detail: 'True/false value' },
      { label: 'Date', detail: 'Date value' },
      { label: 'Select', detail: 'Choose from predefined options' },
    ];

    const selectedType = await vscode.window.showQuickPick(typeOptions, {
      placeHolder: 'Select variable type',
    });

    if (!selectedType) return undefined;

    const type = selectedType.label.toLowerCase() as TemplateVariable['type'];

    // For select type, get options
    let options: string[] | undefined;
    if (type === 'select') {
      const optionsInput = await vscode.window.showInputBox({
        prompt: 'Enter options (comma-separated)',
        placeHolder: 'Option 1, Option 2, Option 3',
      });

      if (optionsInput) {
        options = optionsInput
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s);
      }
    }

    // Ask if required
    const requiredChoice = await vscode.window.showQuickPick(
      [
        { label: 'Required', detail: 'User must provide this variable' },
        { label: 'Optional', detail: 'Variable has a default or can be empty' },
      ],
      { placeHolder: 'Is this variable required?' }
    );

    const required = requiredChoice?.label === 'Required';

    // Get default value if optional
    let defaultValue: any;
    if (!required) {
      const defaultInput = await vscode.window.showInputBox({
        prompt: 'Default value (optional)',
        placeHolder: type === 'select' ? options?.[0] : `Default ${type} value`,
      });

      if (defaultInput) {
        defaultValue = this.parseDefaultValue(defaultInput, type);
      }
    }

    return {
      name,
      description,
      type,
      required,
      default: defaultValue,
      options,
    };
  }

  /**
   * Validate a variable definition
   */
  private validateVariable(
    variable: TemplateVariable,
    existingVariables: TemplateVariable[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!variable.name || variable.name.trim() === '') {
      errors.push('Variable name is required');
    }

    if (!variable.description || variable.description.trim() === '') {
      errors.push('Variable description is required');
    }

    if (!variable.type) {
      errors.push('Variable type is required');
    }

    // Validate name format
    if (variable.name && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(variable.name)) {
      errors.push(
        'Variable name must start with a letter and contain only letters, numbers, and underscores'
      );
    }

    // Check for duplicate names
    if (
      variable.name &&
      existingVariables.some((v) => v.name === variable.name)
    ) {
      errors.push(`Variable name '${variable.name}' already exists`);
    }

    // Validate type-specific constraints
    if (variable.type === 'select') {
      if (!variable.options || variable.options.length === 0) {
        errors.push('Select variables must have at least one option');
      } else if (variable.options.some((opt) => !opt || opt.trim() === '')) {
        errors.push('All select options must be non-empty');
      }
    }

    // Validate default value
    if (variable.default !== undefined) {
      const isValid = this.isValidDefaultValue(
        variable.default,
        variable.type,
        variable.options
      );
      if (!isValid) {
        errors.push(`Default value is not valid for type '${variable.type}'`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if default value is valid for the given type
   */
  private isValidDefaultValue(
    value: any,
    type: string,
    options?: string[]
  ): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return typeof value === 'string' && !isNaN(Date.parse(value));
      case 'select':
        return typeof value === 'string' && (options?.includes(value) || false);
      default:
        return false;
    }
  }

  /**
   * Parse default value from string input
   */
  private parseDefaultValue(input: string, type: string): any {
    switch (type) {
      case 'string':
        return input;
      case 'number':
        const num = parseFloat(input);
        return isNaN(num) ? undefined : num;
      case 'boolean':
        return input.toLowerCase() === 'true';
      case 'date':
        return input;
      case 'select':
        return input;
      default:
        return input;
    }
  }

  /**
   * Generate HTML for the variable editor webview
   */
  private generateVariableEditorHTML(
    variable?: TemplateVariable,
    _existingVariables: TemplateVariable[] = []
  ): string {
    const varData = variable || {
      name: '',
      description: '',
      type: 'string' as const,
      required: false,
      default: undefined,
      options: undefined,
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Variable Editor</title>
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
            max-width: 600px;
            margin: 0 auto;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
        }

        input, textarea, select {
            width: 100%;
            padding: 10px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: inherit;
            border-radius: 4px;
        }

        textarea {
            min-height: 80px;
            resize: vertical;
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .checkbox-group input[type="checkbox"] {
            width: auto;
        }

        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 30px;
            justify-content: flex-end;
        }

        .button {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-family: inherit;
            font-size: inherit;
        }

        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .options-container {
            margin-top: 10px;
        }

        .option-item {
            display: flex;
            gap: 10px;
            margin-bottom: 8px;
            align-items: center;
        }

        .option-item input {
            flex: 1;
        }

        .option-item button {
            padding: 5px 10px;
            background-color: var(--vscode-errorBackground);
            color: var(--vscode-errorForeground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }

        .add-option {
            padding: 5px 10px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            margin-top: 5px;
        }

        .validation-errors {
            background-color: var(--vscode-errorBackground);
            color: var(--vscode-errorForeground);
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 20px;
        }

        .validation-success {
            background-color: var(--vscode-diffEditor-insertedTextBackground);
            color: var(--vscode-diffEditor-insertedTextForeground);
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 20px;
        }

        .help-text {
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }

        .type-options {
            display: none;
        }

        .type-options.visible {
            display: block;
        }
    </style>
</head>
<body>
    <div class="editor-container">
        <h2>${variable ? 'Edit Variable' : 'Create Variable'}</h2>

        <div id="validationFeedback"></div>

        <form id="variableForm">
            <div class="form-group">
                <label for="variableName">Name *</label>
                <input type="text" id="variableName" value="${varData.name}" required>
                <div class="help-text">Must start with a letter and contain only letters, numbers, and underscores</div>
            </div>

            <div class="form-group">
                <label for="variableDescription">Description *</label>
                <textarea id="variableDescription" required>${varData.description}</textarea>
                <div class="help-text">Explain what this variable is used for</div>
            </div>

            <div class="form-group">
                <label for="variableType">Type *</label>
                <select id="variableType" onchange="handleTypeChange()" required>
                    <option value="string" ${varData.type === 'string' ? 'selected' : ''}>String</option>
                    <option value="number" ${varData.type === 'number' ? 'selected' : ''}>Number</option>
                    <option value="boolean" ${varData.type === 'boolean' ? 'selected' : ''}>Boolean</option>
                    <option value="date" ${varData.type === 'date' ? 'selected' : ''}>Date</option>
                    <option value="select" ${varData.type === 'select' ? 'selected' : ''}>Select</option>
                </select>
            </div>

            <div class="form-group type-options" id="selectOptions">
                <label>Options</label>
                <div id="optionsContainer">
                    <!-- Options will be populated here -->
                </div>
                <button type="button" class="add-option" onclick="addOption()">Add Option</button>
                <div class="help-text">Define the available choices for this select variable</div>
            </div>

            <div class="form-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="variableRequired" ${varData.required ? 'checked' : ''}>
                    <label for="variableRequired">Required</label>
                </div>
                <div class="help-text">If checked, users must provide a value for this variable</div>
            </div>

            <div class="form-group">
                <label for="variableDefault">Default Value</label>
                <input type="text" id="variableDefault" value="${varData.default || ''}">
                <div class="help-text">Optional default value when variable is not required</div>
            </div>

            <div class="button-group">
                <button type="button" class="button secondary" onclick="validateVariable()">Validate</button>
                <button type="button" class="button secondary" onclick="cancel()">Cancel</button>
                <button type="button" class="button" onclick="save()">Save</button>
            </div>
        </form>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let options = ${JSON.stringify(varData.options || [])};

        // Initialize
        handleTypeChange();
        renderOptions();

        function handleTypeChange() {
            const type = document.getElementById('variableType').value;
            const selectOptions = document.getElementById('selectOptions');

            if (type === 'select') {
                selectOptions.classList.add('visible');
            } else {
                selectOptions.classList.remove('visible');
            }
        }

        function renderOptions() {
            const container = document.getElementById('optionsContainer');
            container.innerHTML = '';

            options.forEach((option, index) => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'option-item';
                optionDiv.innerHTML = \`
                    <input type="text" value="\${option}" onchange="updateOption(\${index}, this.value)">
                    <button onclick="removeOption(\${index})">Remove</button>
                \`;
                container.appendChild(optionDiv);
            });
        }

        function addOption() {
            options.push('');
            renderOptions();
        }

        function removeOption(index) {
            options.splice(index, 1);
            renderOptions();
        }

        function updateOption(index, value) {
            options[index] = value;
        }

        function getVariableData() {
            return {
                name: document.getElementById('variableName').value,
                description: document.getElementById('variableDescription').value,
                type: document.getElementById('variableType').value,
                required: document.getElementById('variableRequired').checked,
                default: document.getElementById('variableDefault').value || undefined,
                options: document.getElementById('variableType').value === 'select' ? options.filter(o => o.trim()) : undefined
            };
        }

        function validateVariable() {
            const variableData = getVariableData();
            vscode.postMessage({
                command: 'validate',
                data: variableData
            });
        }

        function save() {
            const variableData = getVariableData();
            vscode.postMessage({
                command: 'save',
                data: variableData
            });
        }

        function cancel() {
            vscode.postMessage({
                command: 'cancel'
            });
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'validationResult':
                    showValidationFeedback(message.data);
                    break;
                case 'validationErrors':
                    showValidationErrors(message.data);
                    break;
            }
        });

        function showValidationFeedback(result) {
            const feedback = document.getElementById('validationFeedback');

            if (result.isValid) {
                feedback.className = 'validation-success';
                feedback.innerHTML = '✓ Variable definition is valid';
            } else {
                feedback.className = 'validation-errors';
                feedback.innerHTML = \`
                    <strong>Validation Errors:</strong>
                    <ul>\${result.errors.map(error => \`<li>\${error}</li>\`).join('')}</ul>
                \`;
            }
        }

        function showValidationErrors(errors) {
            const feedback = document.getElementById('validationFeedback');
            feedback.className = 'validation-errors';
            feedback.innerHTML = \`
                <strong>Errors:</strong>
                <ul>\${errors.map(error => \`<li>\${error}</li>\`).join('')}</ul>
            \`;
        }
    </script>
</body>
</html>`;
  }
}
