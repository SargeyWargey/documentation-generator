import { ClaudeIntegrator, ClaudeIntegratorConfig } from '../ClaudeIntegrator';
import { ClaudeCommandContext, ClaudeCommandResult, SlashCommand } from '../types';
import { SlashCommandGenerator } from '../SlashCommandGenerator';
import { FolderContext } from '../../utils/FolderAnalyzer';
import { Template } from '../../templates/TemplateManager';

// Mock concrete implementation for testing
class MockClaudeIntegrator extends ClaudeIntegrator {
  public mockResults: Map<string, ClaudeCommandResult> = new Map();

  async generateDocumentation(context: ClaudeCommandContext): Promise<ClaudeCommandResult> {
    const command = await this.createSlashCommand(context);
    return this.executeCommand(command);
  }

  async createSlashCommand(context: ClaudeCommandContext): Promise<SlashCommand> {
    const generated = await this.commandGenerator.generateSlashCommand(context);

    const command: SlashCommand = {
      ...generated,
      filePath: `/test/commands/${generated.fileName}`,
    };

    this.activeCommands.set(command.id, command);
    return command;
  }

  async executeCommand(command: SlashCommand): Promise<ClaudeCommandResult> {
    // Simulate command execution
    const result = this.mockResults.get(command.id) || {
      success: true,
      output: `# Generated Documentation\n\nThis is mock generated content for ${command.metadata.name}`,
      outputPath: command.outputPath,
      executionTime: 2000,
      commandId: command.id,
      metadata: command.metadata,
    };

    return result;
  }

  async cleanup(commandId?: string): Promise<void> {
    if (commandId) {
      this.activeCommands.delete(commandId);
    } else {
      this.activeCommands.clear();
    }
  }

  // Test helpers
  setMockResult(commandId: string, result: ClaudeCommandResult): void {
    this.mockResults.set(commandId, result);
  }
}

const createMockFolderContext = (): FolderContext => ({
  folderPath: '/test/project',
  name: 'test-project',
  files: [],
  codeStructures: new Map(),
  dependencies: [],
  documentation: {
    readme: null,
    changelog: null,
    license: null,
    apiDocs: [],
    comments: [],
  },
  projectType: 'typescript',
  totalFiles: 10,
  totalLines: 500,
  summary: 'Test project summary',
});

const createMockTemplate = (): Template => ({
  id: 'test-template',
  content: '# {{title}}\n\nDescription: {{description}}',
  filePath: '/templates/test-template.md',
  metadata: {
    name: 'Test Template',
    description: 'A template for testing',
    category: 'testing',
    variables: [
      {
        name: 'title',
        description: 'Document title',
        type: 'string',
        required: true,
      },
      {
        name: 'description',
        description: 'Document description',
        type: 'string',
        required: false,
        default: 'Default description',
      },
    ],
  },
});

describe('ClaudeIntegrator', () => {
  let integrator: MockClaudeIntegrator;
  let config: ClaudeIntegratorConfig;

  beforeEach(() => {
    config = {
      claudeCommandsPath: '/test/.claude/commands',
      claudeResultsPath: '/test/.claude/results',
      tempDirectory: '/test/temp',
      maxCommandRetries: 3,
      commandTimeout: 30000,
      cleanupAfterExecution: true,
      commandFilePermissions: 0o644,
    };

    integrator = new MockClaudeIntegrator(config);
  });

  describe('initialization', () => {
    it('should initialize with provided config', () => {
      expect(integrator).toBeInstanceOf(ClaudeIntegrator);
      expect((integrator as any).config).toEqual(config);
    });

    it('should initialize with empty active commands', () => {
      expect(integrator.getActiveCommands()).toHaveLength(0);
    });
  });

  describe('command management', () => {
    let context: ClaudeCommandContext;

    beforeEach(() => {
      context = {
        folderPath: '/test/project',
        folderContext: createMockFolderContext(),
        template: createMockTemplate(),
        variables: {
          title: 'Test Document',
          description: 'This is a test document',
        },
      };
    });

    it('should create slash command from context', async () => {
      const command = await integrator.createSlashCommand(context);

      expect(command.id).toBeDefined();
      expect(command.fileName).toMatch(/test-template-command-\d+\.md/);
      expect(command.metadata.name).toContain('Test Template');
      expect(command.id).toBeDefined();
      expect(integrator.getActiveCommands()).toHaveLength(1);
    });

    it('should execute command and return result', async () => {
      const command = await integrator.createSlashCommand(context);
      const result = await integrator.executeCommand(command);

      expect(result.success).toBe(true);
      expect(result.commandId).toBe(command.id);
      expect(result.output).toContain('Generated Documentation');
      expect(result.success).toBe(true);
    });

    it('should handle command execution failure', async () => {
      const command = await integrator.createSlashCommand(context);

      // Set up failure mock
      integrator.setMockResult(command.id, {
        success: false,
        error: 'Execution failed',
        executionTime: 1000,
        commandId: command.id,
      });

      const result = await integrator.executeCommand(command);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    it('should generate documentation end-to-end', async () => {
      const result = await integrator.generateDocumentation(context);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Generated Documentation');
      expect(integrator.getActiveCommands()).toHaveLength(1);
    });
  });

  describe('active command tracking', () => {
    it('should track multiple active commands', async () => {
      const context1 = {
        folderPath: '/test/project1',
        folderContext: createMockFolderContext(),
        template: createMockTemplate(),
        variables: { title: 'Doc 1' },
      };

      const context2 = {
        folderPath: '/test/project2',
        folderContext: createMockFolderContext(),
        template: createMockTemplate(),
        variables: { title: 'Doc 2' },
      };

      await integrator.createSlashCommand(context1);
      await integrator.createSlashCommand(context2);

      expect(integrator.getActiveCommands()).toHaveLength(2);
    });
  });

  describe('cleanup', () => {
    it('should cleanup specific command', async () => {
      const context = {
        folderPath: '/test/project',
        folderContext: createMockFolderContext(),
        template: createMockTemplate(),
        variables: { title: 'Test' },
      };

      const command = await integrator.createSlashCommand(context);
      expect(integrator.getActiveCommands()).toHaveLength(1);

      await integrator.cleanup(command.id);
      expect(integrator.getActiveCommands()).toHaveLength(0);
    });

    it('should cleanup all commands', async () => {
      const context = {
        folderPath: '/test/project',
        folderContext: createMockFolderContext(),
        template: createMockTemplate(),
        variables: { title: 'Test' },
      };

      await integrator.createSlashCommand(context);
      await integrator.createSlashCommand(context);
      expect(integrator.getActiveCommands()).toHaveLength(2);

      await integrator.cleanup();
      expect(integrator.getActiveCommands()).toHaveLength(0);
    });
  });

  describe('validation', () => {
    it('should handle valid command contexts', async () => {
      const validContext: ClaudeCommandContext = {
        folderPath: '/test/project',
        folderContext: createMockFolderContext(),
        template: createMockTemplate(),
        variables: { title: 'Test' },
      };

      // Should be able to create command without errors
      const command = await integrator.createSlashCommand(validContext);
      expect(command).toBeDefined();
      expect(command.id).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle command generator errors', async () => {
      const mockGenerator = {
        generateSlashCommand: jest.fn().mockRejectedValue(new Error('Generator failed')),
      } as any;

      const integratorWithFailingGenerator = new MockClaudeIntegrator(config, mockGenerator);

      const context = {
        folderPath: '/test/project',
        folderContext: createMockFolderContext(),
        template: createMockTemplate(),
        variables: { title: 'Test' },
      };

      await expect(integratorWithFailingGenerator.createSlashCommand(context))
        .rejects.toThrow('Generator failed');
    });

    it('should provide error details in results', async () => {
      const context = {
        folderPath: '/test/project',
        folderContext: createMockFolderContext(),
        template: createMockTemplate(),
        variables: { title: 'Test' },
      };

      const command = await integrator.createSlashCommand(context);

      integrator.setMockResult(command.id, {
        success: false,
        error: 'Multiple errors occurred',
        executionTime: 1000,
        commandId: command.id,
      });

      const result = await integrator.executeCommand(command);

      expect(result.error).toBe('Multiple errors occurred');
    });
  });

  describe('configuration', () => {
    it('should handle missing optional config values', () => {
      const minimalConfig: ClaudeIntegratorConfig = {
        claudeCommandsPath: '/test/.claude/commands',
        tempDirectory: '/test/temp',
        maxCommandRetries: 1,
        commandTimeout: 10000,
        cleanupAfterExecution: false,
      };

      const minimalIntegrator = new MockClaudeIntegrator(minimalConfig);
      expect(minimalIntegrator).toBeInstanceOf(ClaudeIntegrator);
    });

    it('should use default command generator if not provided', () => {
      const integratorWithDefaults = new MockClaudeIntegrator(config);
      expect((integratorWithDefaults as any).commandGenerator).toBeInstanceOf(SlashCommandGenerator);
    });
  });
});