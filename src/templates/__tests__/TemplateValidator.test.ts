import { TemplateValidator, ValidationResult } from '../TemplateValidator';
import { Template, TemplateMetadata, TemplateVariable } from '../TemplateManager';

describe('TemplateValidator', () => {
  let validator: TemplateValidator;

  beforeEach(() => {
    validator = new TemplateValidator();
  });

  describe('template validation', () => {
    it('should validate a complete valid template', () => {
      const template: Template = {
        id: 'valid-template',
        metadata: {
          name: 'Valid Template',
          description: 'A well-formed template',
          category: 'documentation',
          variables: [
            {
              name: 'title',
              description: 'Document title',
              type: 'string',
              required: true,
            },
            {
              name: 'priority',
              description: 'Priority level',
              type: 'select',
              options: ['High', 'Medium', 'Low'],
              default: 'Medium',
            },
          ],
        },
        content: '# {{title}}\n\nPriority: {{priority}}\n\nContent here.',
        filePath: '/templates/valid-template.md',
      };

      const result = validator.validateTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required metadata fields', () => {
      const template: Template = {
        id: 'invalid-template',
        metadata: {
          name: '', // Empty name
          description: 'Missing name template',
        },
        content: '# Template\n\nContent here.',
        filePath: '/templates/invalid-template.md',
      };

      const result = validator.validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template name is required');
    });

    it('should detect undefined variables in content', () => {
      const template: Template = {
        id: 'undefined-vars-template',
        metadata: {
          name: 'Undefined Variables Template',
          description: 'Template with undefined variables',
          variables: [
            {
              name: 'title',
              description: 'Document title',
              type: 'string',
              required: true,
            },
          ],
        },
        content: '# {{title}}\n\nMissing: {{undefinedVariable}}\n\nAnother: {{anotherMissing}}',
        filePath: '/templates/undefined-vars-template.md',
      };

      const result = validator.validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('undefinedVariable'))).toBe(true);
      expect(result.errors.some(e => e.includes('anotherMissing'))).toBe(true);
    });

    it('should detect unused variables', () => {
      const template: Template = {
        id: 'unused-vars-template',
        metadata: {
          name: 'Unused Variables Template',
          description: 'Template with unused variables',
          variables: [
            {
              name: 'title',
              description: 'Document title',
              type: 'string',
              required: true,
            },
            {
              name: 'unusedVariable',
              description: 'This variable is not used',
              type: 'string',
            },
          ],
        },
        content: '# {{title}}\n\nContent without unused variable.',
        filePath: '/templates/unused-vars-template.md',
      };

      const result = validator.validateTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('unusedVariable'))).toBe(true);
    });
  });

  describe('metadata validation', () => {
    it('should validate complete metadata', () => {
      const metadata: TemplateMetadata = {
        name: 'Test Template',
        description: 'A test template for validation',
        author: 'Test Author',
        version: '1.0.0',
        category: 'testing',
        tags: ['test', 'validation'],
        variables: [
          {
            name: 'testVar',
            description: 'Test variable',
            type: 'string',
            required: true,
          },
        ],
      };

      const result = validator.validateMetadata(metadata);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require name and description', () => {
      const metadata: TemplateMetadata = {
        name: '',
        description: '',
      };

      const result = validator.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template name is required');
      expect(result.errors).toContain('Template description is required');
    });

    it('should validate variable definitions', () => {
      const metadata: TemplateMetadata = {
        name: 'Test Template',
        description: 'Test description',
        variables: [
          {
            name: '',
            description: 'Empty name variable',
            type: 'string',
          },
          {
            name: 'validVar',
            description: '',
            type: 'string',
          },
          {
            name: 'selectVar',
            description: 'Select variable without options',
            type: 'select',
          },
        ],
      };

      const result = validator.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('name is required'))).toBe(true);
      expect(result.errors.some(e => e.includes('validVar'))).toBe(true);
    });

    it('should validate content is not empty', () => {
      const content = '';
      const variables: TemplateVariable[] = [];

      const result = validator.validateContent(content, variables);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template content cannot be empty');
    });

    it('should validate version format warning', () => {
      const metadata: TemplateMetadata = {
        name: 'Test Template',
        description: 'Test description',
        version: 'invalid-version-format',
      };

      const result = validator.validateMetadata(metadata);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Version should follow semantic versioning (e.g., 1.0.0)');
    });
  });

  describe('content validation', () => {
    it('should validate content with all variables used', () => {
      const content = '# {{title}}\n\n{{description}}\n\nPriority: {{priority}}';
      const variables: TemplateVariable[] = [
        { name: 'title', description: 'Title', type: 'string' },
        { name: 'description', description: 'Description', type: 'string' },
        { name: 'priority', description: 'Priority', type: 'string' },
      ];

      const result = validator.validateContent(content, variables);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle content with variables', () => {
      const content = '# {{title}}\n\n{{description}}';
      const variables: TemplateVariable[] = [
        { name: 'title', description: 'Title', type: 'string' },
        { name: 'description', description: 'Description', type: 'string' },
      ];

      const result = validator.validateContent(content, variables);

      expect(result.isValid).toBe(true);
    });


  });

  describe('template metadata validation integration', () => {
    it('should validate templates with variable errors through metadata', () => {
      const template: Template = {
        id: 'invalid-vars-template',
        metadata: {
          name: 'Invalid Variables Template',
          description: 'Template with invalid variables',
          variables: [
            {
              name: 'invalid-name',
              description: 'Invalid variable name',
              type: 'string',
            },
            {
              name: 'duplicate',
              description: 'First duplicate',
              type: 'string',
            },
            {
              name: 'duplicate',
              description: 'Second duplicate',
              type: 'number',
            },
          ],
        },
        content: '# {{duplicate}}',
        filePath: '/templates/invalid-vars-template.md',
      };

      const result = validator.validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle templates without variables', () => {
      const metadata: TemplateMetadata = {
        name: 'Test Template',
        description: 'Test description',
      };

      const result = validator.validateMetadata(metadata);

      expect(result.isValid).toBe(true);
    });


  });
});