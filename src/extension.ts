// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SidebarProvider } from './providers/SidebarProvider';
import { ProgressManager } from './ui/ProgressManager';
import { DialogHelper } from './ui/DialogHelper';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "documentation-generator" is now active!'
  );

  // Initialize providers
  const sidebarProvider = new SidebarProvider();
  const progressManager = new ProgressManager();
  const dialogHelper = new DialogHelper();

  // Check if this is the first run
  const isFirstRun = context.globalState.get('documentation-generator.firstRun', true);
  if (isFirstRun) {
    await showWelcomeExperience(context, dialogHelper);
    await context.globalState.update('documentation-generator.firstRun', false);
  }

  // Register the tree data provider
  vscode.window.registerTreeDataProvider('documentationGenerator', sidebarProvider);

  // Helper function for folder-based documentation generation
  async function generateDocumentationForFolder(
    uri: vscode.Uri,
    template: string,
    progressManager: ProgressManager,
    sidebarProvider: SidebarProvider,
    dialogHelper: DialogHelper
  ): Promise<void> {
    try {
      const folderPath = uri.fsPath;
      const folderName = require('path').basename(folderPath);

      await progressManager.showProgress(`Generating ${template} documentation for ${folderName}...`, async (progress) => {
        // Simulate documentation generation steps
        progress.report({ increment: 20, message: 'Analyzing folder structure...' });
        await new Promise(resolve => setTimeout(resolve, 800));

        progress.report({ increment: 20, message: 'Extracting code patterns...' });
        await new Promise(resolve => setTimeout(resolve, 800));

        progress.report({ increment: 20, message: 'Processing template...' });
        await new Promise(resolve => setTimeout(resolve, 800));

        progress.report({ increment: 20, message: 'Generating content...' });
        await new Promise(resolve => setTimeout(resolve, 800));

        progress.report({ increment: 20, message: 'Finalizing documentation...' });
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      const outputPath = `${folderPath}/${template}-documentation.md`;

      // Add to recent generations
      sidebarProvider.addRecentGeneration(
        `${template}-${folderName}-${new Date().toLocaleDateString()}`,
        outputPath,
        template
      );

      await dialogHelper.showSuccessDialog(
        `${template.charAt(0).toUpperCase() + template.slice(1)} documentation generated successfully!`,
        outputPath
      );

    } catch (error) {
      await dialogHelper.showErrorDialog(error as Error, 'Document Generation');
    }
  }

  // Welcome experience for first-time users
  async function showWelcomeExperience(
    _context: vscode.ExtensionContext,
    dialogHelper: DialogHelper
  ): Promise<void> {
    const welcomeMessage = `🎉 Welcome to Documentation Generator!

This extension helps you generate comprehensive documentation for your projects using Claude Code Pro.

🚀 **Quick Start:**
• Use the sidebar to access templates and recent generations
• Right-click any folder to generate documentation
• Use Ctrl+Shift+D (Cmd+Shift+D on Mac) for quick generation

📋 **Available Templates:**
• Help Documentation - User guides and API docs
• PRD - Product Requirements Documents
• Technical Specifications - Architecture and implementation details
• Meeting Summaries - Action items and decisions

⚙️ **Settings:**
Configure templates, output patterns, and Claude integration in extension settings.

Would you like to:`;

    const actions = [
      '📋 Generate Sample Documentation',
      '⚙️ Open Settings',
      '📖 View Documentation',
      '✨ Start Using'
    ];

    const selectedAction = await vscode.window.showInformationMessage(
      welcomeMessage,
      { modal: true },
      ...actions
    );

    switch (selectedAction) {
      case '📋 Generate Sample Documentation':
        await demonstrateDocumentationGeneration(progressManager, sidebarProvider, dialogHelper);
        break;
      case '⚙️ Open Settings':
        vscode.commands.executeCommand('workbench.action.openSettings', 'documentation-generator');
        break;
      case '📖 View Documentation':
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/documentation-generator#readme'));
        break;
      case '✨ Start Using':
        // Show the sidebar
        vscode.commands.executeCommand('workbench.view.explorer');
        vscode.window.showInformationMessage('👍 Great! Check out the Documentation Generator panel in the Explorer sidebar.');
        break;
    }
  }

  // Demonstrate documentation generation with sample data
  async function demonstrateDocumentationGeneration(
    progressManager: ProgressManager,
    sidebarProvider: SidebarProvider,
    dialogHelper: DialogHelper
  ): Promise<void> {
    await progressManager.showProgress('Generating sample documentation...', async (progress) => {
      progress.report({ increment: 25, message: 'Setting up demo environment...' });
      await new Promise(resolve => setTimeout(resolve, 800));

      progress.report({ increment: 25, message: 'Analyzing sample project structure...' });
      await new Promise(resolve => setTimeout(resolve, 800));

      progress.report({ increment: 25, message: 'Applying help documentation template...' });
      await new Promise(resolve => setTimeout(resolve, 800));

      progress.report({ increment: 25, message: 'Finalizing sample documentation...' });
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    // Add a sample recent generation
    sidebarProvider.addRecentGeneration(
      'Sample Help Docs - Welcome Demo',
      '/demo/sample-help-documentation.md',
      'help'
    );

    await dialogHelper.showSuccessDialog(
      '🎉 Sample documentation generated! Check the Recent Generations section in the sidebar to see it.',
      '/demo/sample-help-documentation.md'
    );
  }

  // Register commands
  const commands = [
    vscode.commands.registerCommand('documentation-generator.helloWorld', () => {
      vscode.window.showInformationMessage(
        'Hello World from Documentation Generator!'
      );
    }),

    vscode.commands.registerCommand('documentation-generator.refreshSidebar', () => {
      sidebarProvider.refresh();
      vscode.window.showInformationMessage('Documentation Generator refreshed!');
    }),

    vscode.commands.registerCommand('documentation-generator.generateDocs', async () => {
      const selectedFolder = await dialogHelper.selectFolder();
      if (selectedFolder) {
        const template = await dialogHelper.selectTemplate();
        if (template) {
          progressManager.showProgress('Generating documentation...', async (progress) => {
            // Simulate documentation generation
            progress.report({ increment: 25, message: 'Analyzing folder structure...' });
            await new Promise(resolve => setTimeout(resolve, 1000));

            progress.report({ increment: 25, message: 'Processing templates...' });
            await new Promise(resolve => setTimeout(resolve, 1000));

            progress.report({ increment: 25, message: 'Generating content...' });
            await new Promise(resolve => setTimeout(resolve, 1000));

            progress.report({ increment: 25, message: 'Finalizing documentation...' });
            await new Promise(resolve => setTimeout(resolve, 1000));
          });

          vscode.window.showInformationMessage(
            `Documentation generated using ${template} template for ${selectedFolder}!`
          );

          // Add to recent generations
          sidebarProvider.addRecentGeneration(
            `${template}-docs-${new Date().toLocaleDateString()}`,
            `${selectedFolder}/generated-docs.md`,
            template
          );
        }
      }
    }),

    vscode.commands.registerCommand('documentation-generator.selectFolder', async () => {
      const selectedFolder = await dialogHelper.selectFolder();
      if (selectedFolder) {
        vscode.window.showInformationMessage(`Selected folder: ${selectedFolder}`);
      }
    }),

    vscode.commands.registerCommand('documentation-generator.selectTemplate', async () => {
      const template = await dialogHelper.selectTemplate();
      if (template) {
        vscode.window.showInformationMessage(`Selected template: ${template}`);
      }
    }),

    vscode.commands.registerCommand('documentation-generator.useTemplate', (templateType: string) => {
      vscode.window.showInformationMessage(`Using ${templateType} template`);
    }),

    vscode.commands.registerCommand('documentation-generator.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'documentation-generator');
    }),

    vscode.commands.registerCommand('documentation-generator.manageTemplates', () => {
      vscode.window.showInformationMessage('Template management will be available soon!');
    }),

    vscode.commands.registerCommand('documentation-generator.showHelp', () => {
      vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/documentation-generator#readme'));
    }),

    // Context menu commands for specific document types
    vscode.commands.registerCommand('documentation-generator.generateHelpDocs', async (uri: vscode.Uri) => {
      await generateDocumentationForFolder(uri, 'help', progressManager, sidebarProvider, dialogHelper);
    }),

    vscode.commands.registerCommand('documentation-generator.generatePRD', async (uri: vscode.Uri) => {
      await generateDocumentationForFolder(uri, 'prd', progressManager, sidebarProvider, dialogHelper);
    }),

    vscode.commands.registerCommand('documentation-generator.generateTechSpec', async (uri: vscode.Uri) => {
      await generateDocumentationForFolder(uri, 'technical', progressManager, sidebarProvider, dialogHelper);
    }),

    vscode.commands.registerCommand('documentation-generator.generateMeetingSummary', async (uri: vscode.Uri) => {
      await generateDocumentationForFolder(uri, 'meeting', progressManager, sidebarProvider, dialogHelper);
    }),

    vscode.commands.registerCommand('documentation-generator.generateCustomDocs', async (uri: vscode.Uri) => {
      const template = await dialogHelper.selectTemplate();
      if (template) {
        await generateDocumentationForFolder(uri, template, progressManager, sidebarProvider, dialogHelper);
      }
    })
  ];

  // Add all commands to subscriptions
  commands.forEach(command => context.subscriptions.push(command));
}

// This method is called when your extension is deactivated
export function deactivate() {}
