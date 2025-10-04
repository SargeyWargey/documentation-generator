import {
  TemplateManager,
  Template,
  TemplateMetadata,
} from '../TemplateManager';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;

// Mock VS Code types
const mockVscode = {
  ExtensionContext: jest.fn(),
  Uri: {
    fsPath: jest.fn(),
  },
};

jest.mock('vscode', () => mockVscode, { virtual: true });

describe('TemplateManager', () => {
  let templateManager: TemplateManager;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      extensionPath: '/extension/path',
      globalStorageUri: { fsPath: '/global/storage' },
    } as any;

    templateManager = new TemplateManager(mockContext);
  });

  describe('initialization', () => {
    it('should initialize with empty template map', () => {
      expect(templateManager).toBeInstanceOf(TemplateManager);
    });

    it('should load templates from both default and user directories', async () => {
      // Mock directory structure
      mockFs.readdir.mockImplementation((dirPath: any) => {
        if (dirPath.includes('templates')) {
          return Promise.resolve(['template1.md', 'template2.md'] as any);
        }
        return Promise.resolve([]);
      });

      mockFs.stat.mockResolvedValue({
        isDirectory: () => false,
        mtime: new Date(),
      } as any);

      mockFs.readFile.mockImplementation((filePath: any) => {
        if (filePath.includes('template1.md')) {
          return Promise.resolve(`---
name: Test Template 1
description: A test template
category: documentation
variables:
  - name: title
    description: Document title
    type: string
    required: true
---

# {{title}}

This is a test template.`);
        }
        if (filePath.includes('template2.md')) {
          return Promise.resolve(`---
name: Test Template 2
description: Another test template
---

# Simple Template

No variables here.`);
        }
        return Promise.resolve('');
      });

      await templateManager.initialize();

      const templates = templateManager.getTemplates();
      expect(templates).toHaveLength(4); // 2 default + 2 user templates
    });
  });

  describe('template management', () => {
    beforeEach(async () => {
      // Setup mock templates
      mockFs.readdir.mockImplementation((dirPath: any) => {
        if (dirPath.includes('templates')) {
          return Promise.resolve(['prd-template.md'] as any);
        }
        return Promise.resolve([]);
      });

      mockFs.stat.mockResolvedValue({
        isDirectory: () => false,
        mtime: new Date(),
      } as any);

      mockFs.readFile.mockResolvedValue(`---
name: PRD Template
description: Product Requirements Document template
category: planning
variables:
  - name: productName
    description: Name of the product
    type: string
    required: true
  - name: priority
    description: Priority level
    type: select
    options: ["High", "Medium", "Low"]
    default: "Medium"
---

# Product Requirements Document: {{productName}}

Priority: {{priority}}

## Overview
...`);

      await templateManager.initialize();
    });

    it('should get template by ID', async () => {
      const template = await templateManager.getTemplate('prd-template');

      expect(template).toBeDefined();
      expect(template?.metadata.name).toBe('PRD Template');
      expect(template?.metadata.variables).toHaveLength(2);
    });

    it('should return undefined for non-existent template', async () => {
      const template = await templateManager.getTemplate('non-existent');
      expect(template).toBeUndefined();
    });

    it('should get templates by category', async () => {
      const planningTemplates =
        templateManager.getTemplatesByCategory('planning');
      expect(planningTemplates).toHaveLength(2); // default + user
      expect(planningTemplates[0].metadata.category).toBe('planning');
    });

    it('should process template with variables', async () => {
      const result = await templateManager.processTemplate('prd-template', {
        productName: 'Test Product',
        priority: 'High',
      });

      expect(result).toContain('Test Product');
      expect(result).toContain('High');
    });

    it('should handle template processing errors', async () => {
      await expect(
        templateManager.processTemplate('non-existent', {})
      ).rejects.toThrow();
    });

    it('should search templates', () => {
      const results = templateManager.searchTemplates('PRD');
      expect(results).toHaveLength(2); // Should find templates with 'PRD' in name
      expect(results[0].metadata.name).toContain('PRD');
    });
  });

  describe('template initialization', () => {
    it('should handle missing template directories', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);

      await expect(templateManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('frontmatter parsing', () => {
    it('should parse valid frontmatter', () => {
      const content = `---
name: Test Template
description: A test template
category: documentation
variables:
  - name: title
    type: string
    required: true
---

# Content here`;

      const result = (templateManager as any).parseFrontmatter(content);

      expect(result.metadata.name).toBe('Test Template');
      expect(result.metadata.category).toBe('documentation');
      expect(result.metadata.variables).toHaveLength(1);
      expect(result.content).toBe('# Content here');
    });

    it('should handle missing frontmatter', () => {
      const content = '# Just content\n\nNo frontmatter here.';

      const result = (templateManager as any).parseFrontmatter(content);

      expect(result.metadata.name).toBe('Untitled Template');
      expect(result.content).toBe(content);
    });

    it('should handle malformed YAML', () => {
      const content = `---
name: Test Template
invalid: yaml: structure: here
---

# Content`;

      const result = (templateManager as any).parseFrontmatter(content);

      expect(result.metadata.name).toBe('Untitled Template');
      expect(result.content).toBe('# Content');
    });
  });

  describe('error handling', () => {
    it('should handle directory read errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));

      await expect(templateManager.initialize()).resolves.not.toThrow();

      const templates = templateManager.getTemplates();
      expect(templates).toHaveLength(0);
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.readdir.mockResolvedValue(['template.md'] as any);
      mockFs.stat.mockResolvedValue({
        isDirectory: () => false,
        mtime: new Date(),
      } as any);
      mockFs.readFile.mockRejectedValue(new Error('File read failed'));

      await expect(templateManager.initialize()).resolves.not.toThrow();

      const templates = templateManager.getTemplates();
      expect(templates).toHaveLength(0);
    });
  });
});
