// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SidebarProvider } from './providers/SidebarProvider';
import { ProgressManager } from './ui/ProgressManager';
import { DialogHelper } from './ui/DialogHelper';
import { FolderAnalyzer } from './utils/FolderAnalyzer';
import { TemplateManager } from './templates/TemplateManager';
import { ClaudeCodeIntegrator } from './commands/ClaudeIntegrator';
import {
  HelpDocumentationGenerator,
  PRDGenerator,
  TechnicalSpecGenerator,
  MeetingSummaryGenerator
} from './generators';

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

  // Initialize core services with error handling
  let folderAnalyzer: FolderAnalyzer;
  let templateManager: TemplateManager;
  let claudeIntegrator: ClaudeCodeIntegrator;
  let helpGenerator: HelpDocumentationGenerator;
  let prdGenerator: PRDGenerator;
  let techSpecGenerator: TechnicalSpecGenerator;
  let meetingGenerator: MeetingSummaryGenerator;

  try {
    folderAnalyzer = new FolderAnalyzer();
    templateManager = new TemplateManager(context);
    claudeIntegrator = new ClaudeCodeIntegrator({
      claudeCommandsPath: path.join(context.globalStorageUri?.fsPath || '', 'claude-commands'),
      tempDirectory: path.join(context.globalStorageUri?.fsPath || '', 'temp'),
      maxCommandRetries: 3,
      commandTimeout: 60000,
      cleanupAfterExecution: true
    }, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd());

    // Initialize template manager to load templates
    await templateManager.initialize();

    // Initialize document generators
    helpGenerator = new HelpDocumentationGenerator(templateManager, claudeIntegrator);
    prdGenerator = new PRDGenerator(templateManager, claudeIntegrator);
    techSpecGenerator = new TechnicalSpecGenerator(templateManager, claudeIntegrator);
    meetingGenerator = new MeetingSummaryGenerator(templateManager, claudeIntegrator);

    console.log('Documentation Generator services initialized successfully');
  } catch (error) {
    const errorMessage = `Failed to initialize Documentation Generator services: ${(error as Error).message}`;
    console.error(errorMessage, error);
    vscode.window.showErrorMessage(errorMessage);

    // Try to continue with limited functionality
    try {
      folderAnalyzer = new FolderAnalyzer();
      templateManager = new TemplateManager(context);
      claudeIntegrator = new ClaudeCodeIntegrator({
        claudeCommandsPath: path.join(context.globalStorageUri?.fsPath || '', 'claude-commands'),
        tempDirectory: path.join(context.globalStorageUri?.fsPath || '', 'temp'),
        maxCommandRetries: 3,
        commandTimeout: 60000,
        cleanupAfterExecution: true
      }, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd());

      // Create minimal generators
      helpGenerator = new HelpDocumentationGenerator(templateManager, claudeIntegrator);
      prdGenerator = new PRDGenerator(templateManager, claudeIntegrator);
      techSpecGenerator = new TechnicalSpecGenerator(templateManager, claudeIntegrator);
      meetingGenerator = new MeetingSummaryGenerator(templateManager, claudeIntegrator);

      vscode.window.showWarningMessage('Documentation Generator started with limited functionality. Some features may not work properly.');
    } catch (fallbackError) {
      vscode.window.showErrorMessage('Documentation Generator failed to start. Please reload the window to try again.');
      return; // Exit activation if we can't even create basic services
    }
  }

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
      // Validate inputs
      if (!uri || !uri.fsPath) {
        throw new Error('Invalid folder path provided');
      }

      const folderPath = uri.fsPath;
      const folderName = require('path').basename(folderPath);

      // Check if folder exists and is accessible
      try {
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) {
          throw new Error(`Path '${folderPath}' is not a directory`);
        }
      } catch (error) {
        throw new Error(`Cannot access folder '${folderPath}': ${(error as Error).message}`);
      }

      // Validate template type
      const validTemplates = ['help', 'prd', 'technical', 'meeting'];
      if (!validTemplates.includes(template)) {
        throw new Error(`Invalid template type '${template}'. Valid types: ${validTemplates.join(', ')}`);
      }

      const generatedOutputPath = await progressManager.showProgress(
        `Generating ${template} documentation for ${folderName}...`,
        async (progress) => {
          let analysisResult: any;
          let outputPath: string = '';

          try {
            // Step 1: Analyze folder structure
            progress.report({ increment: 20, message: 'Analyzing folder structure...' });

            try {
              analysisResult = await folderAnalyzer.analyzeFolder(folderPath);
              if (!analysisResult || !analysisResult.files) {
                throw new Error('Failed to analyze folder structure - no files found');
              }
            } catch (error) {
              throw new Error(`Folder analysis failed: ${(error as Error).message}`);
            }

            // Step 2: Load appropriate template
            progress.report({ increment: 20, message: 'Loading template...' });

            let templateData;
            try {
              templateData = templateManager.getTemplate(template);
              if (!templateData) {
                // Try to create a fallback basic template
                console.warn(`Template '${template}' not found, using fallback`);
                templateData = { id: template, content: '# {{title}}\n\nGenerated documentation for {{projectName}}.' };
              }
            } catch (error) {
              throw new Error(`Template loading failed: ${(error as Error).message}`);
            }

            // Step 3: Generate documentation based on template type
            progress.report({ increment: 20, message: 'Generating content...' });
            let generatedContent: string;

            try {
              // Add timeout to prevent hanging operations
              const GENERATION_TIMEOUT = 300000; // 5 minutes
              const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Content generation timed out after 5 minutes')), GENERATION_TIMEOUT);
              });

              const generationPromise = (async () => {
                switch (template) {
                  case 'help':
                    return await helpGenerator.generateHelpDocumentation(
                      analysisResult,
                      {
                        includeAPIReference: true,
                        includeExamples: true,
                        includeTroubleshooting: true,
                        includeFAQ: true,
                        includeGettingStarted: true,
                        outputFormat: 'markdown'
                      }
                    );
                  case 'prd':
                    return await prdGenerator.generatePRD(
                      analysisResult,
                      {
                        includeUserStories: true,
                        includeAcceptanceCriteria: true,
                        includeDependencyAnalysis: true,
                        includeSuccessMetrics: true,
                        includeTimeline: true,
                        businessContext: `Product requirements for ${analysisResult.name}`,
                        targetAudience: ['developers', 'product-managers', 'stakeholders'],
                        outputFormat: 'markdown'
                      }
                    );
                  case 'technical':
                    return await techSpecGenerator.generateTechnicalSpecification(
                      folderPath,
                      analysisResult,
                      {
                        includeArchitecture: true,
                        includeAPISpec: true,
                        includeDatabaseSchema: true,
                        includeConfiguration: true,
                        includeDeployment: true,
                        includeTestingStrategy: true,
                        includeIntegrationMap: true,
                        technicalLevel: 'intermediate',
                        outputFormat: 'markdown'
                      }
                    );
                  case 'meeting':
                    return await meetingGenerator.generateMeetingSummary(
                      {
                        title: `Meeting Summary for ${analysisResult.name}`,
                        date: new Date().toISOString(),
                        duration: '60 minutes',
                        meetingType: 'review',
                        participants: [],
                        agenda: ['Project review', 'Code analysis', 'Next steps'],
                        objectives: ['Review project status', 'Identify improvements']
                      },
                      `Project analysis and review for ${analysisResult.name}`,
                      analysisResult,
                      {
                        includeActionItems: true,
                        includeDecisionTracking: true,
                        includeFollowUpTasks: true,
                        includeParticipantTracking: true,
                        includeMeetingNotes: true,
                        includeSeriesTracking: false,
                        meetingType: 'review',
                        outputFormat: 'markdown'
                      }
                    );
                  default:
                    throw new Error(`Unknown template type: ${template}`);
                }
              })();

              generatedContent = await Promise.race([generationPromise, timeoutPromise]);

              if (!generatedContent || generatedContent.trim() === '') {
                throw new Error('Content generation failed - empty result');
              }
            } catch (error) {
              if ((error as Error).message.includes('timed out')) {
                throw new Error('Content generation timed out. The project may be too large or complex.');
              }
              throw new Error(`Content generation failed: ${(error as Error).message}`);
            }

            // Step 4: Save generated content to file
            progress.report({ increment: 20, message: 'Saving documentation...' });

            try {
              outputPath = path.join(folderPath, `${template}-documentation.md`);

              // Check if file already exists and handle appropriately
              try {
                await fs.access(outputPath);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                outputPath = path.join(folderPath, `${template}-documentation-${timestamp}.md`);
              } catch {
                // File doesn't exist, which is fine
              }

              await fs.writeFile(outputPath, generatedContent, 'utf-8');

              // Verify file was written correctly
              const writtenContent = await fs.readFile(outputPath, 'utf-8');
              if (writtenContent !== generatedContent) {
                throw new Error('File write verification failed');
              }
            } catch (error) {
              const fsError = error as NodeJS.ErrnoException;
              if (fsError.code === 'EACCES') {
                throw new Error(`Permission denied writing to '${outputPath}'. Check folder permissions.`);
              } else if (fsError.code === 'ENOSPC') {
                throw new Error('Insufficient disk space to save documentation file');
              } else {
                throw new Error(`File save failed: ${fsError.message}`);
              }
            }

            // Step 5: Finalize
            progress.report({ increment: 20, message: 'Finalizing documentation...' });

            return outputPath;
          } catch (error) {
            // Cleanup any partial files if needed
            if (outputPath && outputPath !== '') {
              try {
                await fs.unlink(outputPath);
              } catch {
                // Ignore cleanup errors
              }
            }
            throw error;
          }
        }
      );

      // Add to recent generations with error handling
      try {
        sidebarProvider.addRecentGeneration(
          `${template}-${folderName}-${new Date().toLocaleDateString()}`,
          generatedOutputPath,
          template
        );
      } catch (error) {
        console.warn('Failed to add to recent generations:', error);
        // Don't fail the entire operation for this
      }

      await dialogHelper.showSuccessDialog(
        `${template.charAt(0).toUpperCase() + template.slice(1)} documentation generated successfully!`,
        generatedOutputPath
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Documentation generation failed:', error);

      // Provide specific error messages for common issues
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('Permission denied')) {
        userFriendlyMessage = 'Permission denied. Please check that you have write access to the selected folder.';
      } else if (errorMessage.includes('not found')) {
        userFriendlyMessage = 'Template or folder not found. Please verify your selection and try again.';
      } else if (errorMessage.includes('Template') && errorMessage.includes('failed')) {
        userFriendlyMessage = 'Template processing failed. The template may be corrupted or missing required components.';
      } else if (errorMessage.includes('analysis failed')) {
        userFriendlyMessage = 'Folder analysis failed. The folder may be empty or contain unsupported file types.';
      }

      await dialogHelper.showErrorDialog(new Error(userFriendlyMessage), 'Document Generation');
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
      try {
        const selectedFolder = await dialogHelper.selectFolder();
        if (selectedFolder) {
          const template = await dialogHelper.selectTemplate();
          if (template) {
            const folderUri = vscode.Uri.file(selectedFolder);
            await generateDocumentationForFolder(
              folderUri,
              template,
              progressManager,
              sidebarProvider,
              dialogHelper
            );
          }
        }
      } catch (error) {
        await dialogHelper.showErrorDialog(error as Error, 'Document Generation');
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
      const { TemplateManagementPanel } = require('./ui/TemplateManagementPanel');
      TemplateManagementPanel.createOrShow(context.extensionUri, templateManager);
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
