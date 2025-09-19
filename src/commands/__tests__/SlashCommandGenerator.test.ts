import { SlashCommandGenerator } from '../SlashCommandGenerator';
import { ClaudeCommandContext } from '../types';
import { FolderContext } from '../../utils/FolderAnalyzer';
import { Template } from '../../templates/TemplateManager';

const createMockFolderContext = (): FolderContext => ({
  folderPath: '/workspace/project',
  name: 'project',
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
  totalFiles: 5,
  totalLines: 1234,
  summary: 'Sample project summary',
});

const createMockTemplate = (): Template => ({
  id: 'sample-template',
  content: '# Sample Template\n\nDescribe the project here.',
  filePath: '/templates/sample-template.md',
  metadata: {
    name: 'Sample Doc',
    description: 'Generates a sample document',
    category: 'documentation',
    tags: ['sample'],
    variables: [
      {
        name: 'audience',
        description: 'Intended audience for the document',
        type: 'string',
        required: true,
      },
    ],
  },
});

describe('SlashCommandGenerator', () => {
  const generator = new SlashCommandGenerator();

  it('produces command metadata with arguments and versioning', async () => {
    const folderContext = createMockFolderContext();
    const template = createMockTemplate();

    const context: ClaudeCommandContext = {
      folderPath: folderContext.folderPath,
      folderContext,
      template,
      variables: {
        audience: 'Developers',
      },
    };

    const generated = await generator.generateSlashCommand(context);

    expect(generated.metadata.name).toContain('Sample Doc');
    expect(generated.metadata.arguments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'folder', required: true }),
        expect.objectContaining({ name: 'audience', required: true }),
      ])
    );
    expect(generated.metadata.version).toMatch(/^v\d+$/);
    expect(generated.fileName).toMatch(/sample-template-command-\d+\.md/);
    expect(generated.content).toContain('## Output Instructions');
    expect(generated.outputPath).toContain('docs');
  });
});
