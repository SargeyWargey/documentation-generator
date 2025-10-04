import * as vscode from 'vscode';
import * as path from 'path';

export class DialogHelper {
  /**
   * Shows a folder selection dialog
   */
  async selectFolder(): Promise<string | undefined> {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      canSelectFolders: true,
      canSelectFiles: false,
      openLabel: 'Select Folder for Documentation',
    };

    const folderUri = await vscode.window.showOpenDialog(options);
    if (folderUri && folderUri[0]) {
      return folderUri[0].fsPath;
    }

    // If no folder selected via dialog, offer workspace folders
    if (vscode.workspace.workspaceFolders) {
      const workspaceFolders = vscode.workspace.workspaceFolders.map(
        (folder) => ({
          label: folder.name,
          description: folder.uri.fsPath,
          detail: path.basename(folder.uri.fsPath),
        })
      );

      const selectedWorkspace = await vscode.window.showQuickPick(
        workspaceFolders,
        {
          placeHolder: 'Select a workspace folder or cancel to browse...',
          title: 'Choose Folder for Documentation Generation',
        }
      );

      if (selectedWorkspace) {
        return selectedWorkspace.description;
      }
    }

    return undefined;
  }

  /**
   * Shows a template selection dialog
   */
  async selectTemplate(): Promise<string | undefined> {
    const templates = [
      {
        label: '📋 Help Documentation',
        description: 'Generate user-friendly help documentation',
        detail:
          'Creates comprehensive help docs with API references, getting started guides, and troubleshooting',
      },
      {
        label: '📊 PRD (Product Requirements Document)',
        description: 'Generate product requirements documentation',
        detail:
          'Creates business-focused PRD with user stories, acceptance criteria, and success metrics',
      },
      {
        label: '⚙️ Technical Specification',
        description: 'Generate technical architecture documentation',
        detail:
          'Creates detailed technical specs with architecture diagrams, API docs, and implementation details',
      },
      {
        label: '🤝 Meeting Summary',
        description: 'Generate meeting notes and action items',
        detail:
          'Creates structured meeting summaries with decisions, action items, and follow-ups',
      },
      {
        label: '📝 Custom Template',
        description: 'Use a custom template',
        detail: 'Select from your custom templates or create a new one',
      },
    ];

    const selectedTemplate = await vscode.window.showQuickPick(templates, {
      placeHolder: 'Choose a documentation template',
      title: 'Select Documentation Template',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selectedTemplate) {
      // Extract template type from label
      const templateMap: { [key: string]: string } = {
        'Help Documentation': 'help',
        'PRD (Product Requirements Document)': 'prd',
        'Technical Specification': 'technical',
        'Meeting Summary': 'meeting',
        'Custom Template': 'custom',
      };

      const templateKey = Object.keys(templateMap).find((key) =>
        selectedTemplate.label.includes(key)
      );

      return templateKey ? templateMap[templateKey] : 'help';
    }

    return undefined;
  }

  /**
   * Shows a configuration dialog
   */
  async showConfigurationDialog(): Promise<any> {
    const options = [
      {
        label: '⚙️ Extension Settings',
        description: 'Open extension settings',
        action: 'settings',
      },
      {
        label: '📁 Template Directory',
        description: 'Configure custom template directory',
        action: 'templateDir',
      },
      {
        label: '📤 Output Settings',
        description: 'Configure output directory and naming',
        action: 'output',
      },
      {
        label: '🔗 Claude Integration',
        description: 'Configure Claude Code integration',
        action: 'claude',
      },
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'Choose configuration option',
      title: 'Documentation Generator Configuration',
    });

    if (selected) {
      switch (selected.action) {
        case 'settings':
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'documentation-generator'
          );
          break;
        case 'templateDir':
          await this.configureTemplateDirectory();
          break;
        case 'output':
          await this.configureOutputSettings();
          break;
        case 'claude':
          await this.configureClaudeIntegration();
          break;
      }
    }

    return selected?.action;
  }

  /**
   * Configure template directory
   */
  private async configureTemplateDirectory(): Promise<void> {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      canSelectFolders: true,
      canSelectFiles: false,
      openLabel: 'Select Template Directory',
    };

    const folderUri = await vscode.window.showOpenDialog(options);
    if (folderUri && folderUri[0]) {
      const config = vscode.workspace.getConfiguration(
        'documentation-generator'
      );
      await config.update(
        'templateDirectory',
        folderUri[0].fsPath,
        vscode.ConfigurationTarget.Global
      );
      vscode.window.showInformationMessage(
        `Template directory set to: ${folderUri[0].fsPath}`
      );
    }
  }

  /**
   * Configure output settings
   */
  private async configureOutputSettings(): Promise<void> {
    const outputName = await vscode.window.showInputBox({
      prompt: 'Enter default output filename pattern',
      value: 'generated-docs-{template}-{date}',
      placeHolder: 'Use {template}, {date}, {folder} as variables',
    });

    if (outputName) {
      const config = vscode.workspace.getConfiguration(
        'documentation-generator'
      );
      await config.update(
        'outputNamePattern',
        outputName,
        vscode.ConfigurationTarget.Global
      );
      vscode.window.showInformationMessage(
        `Output pattern set to: ${outputName}`
      );
    }
  }

  /**
   * Configure Claude integration
   */
  private async configureClaudeIntegration(): Promise<void> {
    const integrationOptions = [
      {
        label: 'Slash Commands',
        description: 'Use Claude Code slash commands for generation',
        picked: true,
      },
      {
        label: 'MCP Server',
        description: 'Use MCP server for real-time integration',
        picked: false,
      },
    ];

    const selected = await vscode.window.showQuickPick(integrationOptions, {
      placeHolder: 'Choose integration method',
      title: 'Claude Code Integration Method',
      canPickMany: false,
    });

    if (selected) {
      const config = vscode.workspace.getConfiguration(
        'documentation-generator'
      );
      await config.update(
        'claudeIntegrationMethod',
        selected.label.toLowerCase().replace(' ', '-'),
        vscode.ConfigurationTarget.Global
      );
      vscode.window.showInformationMessage(
        `Claude integration set to: ${selected.label}`
      );
    }
  }

  /**
   * Show error dialog with detailed information
   */
  async showErrorDialog(error: Error, context?: string): Promise<void> {
    const action = await vscode.window.showErrorMessage(
      `Documentation Generator Error${context ? ` (${context})` : ''}: ${error.message}`,
      'Show Details',
      'Report Issue',
      'Dismiss'
    );

    switch (action) {
      case 'Show Details':
        const outputChannel = vscode.window.createOutputChannel(
          'Documentation Generator'
        );
        outputChannel.appendLine(`Error: ${error.message}`);
        outputChannel.appendLine(`Stack: ${error.stack}`);
        outputChannel.appendLine(`Context: ${context || 'Unknown'}`);
        outputChannel.appendLine(`Timestamp: ${new Date().toISOString()}`);
        outputChannel.show();
        break;
      case 'Report Issue':
        vscode.env.openExternal(
          vscode.Uri.parse(
            'https://github.com/your-repo/documentation-generator/issues/new'
          )
        );
        break;
    }
  }

  /**
   * Show success notification with optional actions
   */
  async showSuccessDialog(message: string, filePath?: string): Promise<void> {
    const actions = ['Dismiss'];
    if (filePath) {
      actions.unshift('Open File', 'Open Folder');
    }

    const action = await vscode.window.showInformationMessage(
      message,
      ...actions
    );

    if (action === 'Open File' && filePath) {
      vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
    } else if (action === 'Open Folder' && filePath) {
      vscode.commands.executeCommand(
        'vscode.openFolder',
        vscode.Uri.file(path.dirname(filePath))
      );
    }
  }
}
