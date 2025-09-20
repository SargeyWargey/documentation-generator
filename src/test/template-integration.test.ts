import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TemplateManager, Template, TemplateVariable } from '../templates/TemplateManager';
import { HelpDocumentationGenerator } from '../generators/HelpDocumentationGenerator';
import { PRDGenerator } from '../generators/PRDGenerator';
import { TechnicalSpecGenerator } from '../generators/TechnicalSpecGenerator';
import { MeetingSummaryGenerator } from '../generators/MeetingSummaryGenerator';
import { ClaudeIntegrator } from '../commands/ClaudeIntegrator';
import { FolderContext } from '../utils/FolderAnalyzer';

describe('Template Integration Tests', () => {
    let mockExtensionContext: vscode.ExtensionContext;
    let templateManager: TemplateManager;
    let claudeIntegrator: ClaudeIntegrator;
    let testTemplatesPath: string;

    beforeEach(async () => {
        // Mock VS Code extension context
        mockExtensionContext = {
            extensionPath: path.join(__dirname, '../../'),
            globalStorageUri: vscode.Uri.file(path.join(__dirname, 'test-storage')),
            subscriptions: []
        } as any;

        templateManager = new TemplateManager(mockExtensionContext);
        claudeIntegrator = new ClaudeIntegrator(mockExtensionContext);
        testTemplatesPath = path.join(__dirname, 'test-templates');

        // Create test templates directory
        await fs.mkdir(testTemplatesPath, { recursive: true });
        await setupTestTemplates();
    });

    afterEach(async () => {
        // Cleanup test templates
        try {
            await fs.rmdir(testTemplatesPath, { recursive: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    async function setupTestTemplates(): Promise<void> {
        // Create help template
        const helpTemplate = `---
name: "Help Documentation Template"
description: "Template for generating help documentation"
category: "documentation"
version: "1.0.0"
author: "Documentation Generator"
tags: ["help", "documentation", "user-guide"]
variables:
  - name: "projectName"
    type: "string"
    required: true
    description: "Name of the project"
  - name: "projectDescription"
    type: "string"
    required: true
    description: "Brief description of the project"
  - name: "mainFeatures"
    type: "array"
    required: false
    description: "List of main features"
  - name: "installationSteps"
    type: "array"
    required: false
    description: "Installation steps"
  - name: "apiEndpoints"
    type: "array"
    required: false
    description: "API endpoints documentation"
---

# {{projectName}} - User Guide

## Overview
{{projectDescription}}

## Getting Started

### Installation
{{#installationSteps}}
{{@index}}. {{.}}
{{/installationSteps}}

## Features
{{#mainFeatures}}
- **{{name}}**: {{description}}
{{/mainFeatures}}

## API Reference
{{#apiEndpoints}}
### {{method}} {{endpoint}}
{{description}}
{{/apiEndpoints}}

---
*Generated on {{currentDate}}*
`;

        // Create PRD template
        const prdTemplate = `---
name: "Product Requirements Document Template"
description: "Template for generating PRDs"
category: "planning"
version: "1.0.0"
author: "Documentation Generator"
tags: ["prd", "requirements", "planning"]
variables:
  - name: "productName"
    type: "string"
    required: true
    description: "Name of the product"
  - name: "productVision"
    type: "string"
    required: true
    description: "Product vision statement"
  - name: "targetAudience"
    type: "array"
    required: true
    description: "Target audience segments"
  - name: "businessGoals"
    type: "array"
    required: true
    description: "Business goals and objectives"
  - name: "userStories"
    type: "array"
    required: false
    description: "User stories and requirements"
---

# {{productName}} - Product Requirements Document

## Product Vision
{{productVision}}

## Target Audience
{{#targetAudience}}
- {{name}}: {{description}}
{{/targetAudience}}

## Business Goals
{{#businessGoals}}
- {{goal}}: {{rationale}}
{{/businessGoals}}

## User Stories
{{#userStories}}
### {{title}}
**As a** {{asA}}
**I want** {{iWant}}
**So that** {{soThat}}

**Acceptance Criteria:**
{{#acceptanceCriteria}}
- {{.}}
{{/acceptanceCriteria}}
{{/userStories}}

---
*Generated on {{currentDate}}*
`;

        // Create technical template
        const technicalTemplate = `---
name: "Technical Specification Template"
description: "Template for generating technical specifications"
category: "technical"
version: "1.0.0"
author: "Documentation Generator"
tags: ["technical", "architecture", "specification"]
variables:
  - name: "systemName"
    type: "string"
    required: true
    description: "Name of the system"
  - name: "architectureType"
    type: "select"
    required: true
    description: "Type of architecture"
    options: ["microservices", "monolith", "serverless"]
  - name: "technologies"
    type: "array"
    required: true
    description: "Technology stack"
  - name: "apiEndpoints"
    type: "array"
    required: false
    description: "API endpoints specification"
  - name: "databaseTables"
    type: "array"
    required: false
    description: "Database schema tables"
---

# {{systemName}} - Technical Specification

## Architecture Overview
**Type**: {{architectureType}}

## Technology Stack
{{#technologies}}
- **{{category}}**: {{technology}}
{{/technologies}}

## API Specification
{{#apiEndpoints}}
### {{method}} {{endpoint}}
{{description}}

**Request:**
\`\`\`json
{{requestExample}}
\`\`\`

**Response:**
\`\`\`json
{{responseExample}}
\`\`\`
{{/apiEndpoints}}

## Database Schema
{{#databaseTables}}
### {{tableName}}
{{description}}

| Column | Type | Description |
|--------|------|-------------|
{{#columns}}
| {{name}} | {{type}} | {{description}} |
{{/columns}}
{{/databaseTables}}

---
*Generated on {{currentDate}}*
`;

        // Create meeting template
        const meetingTemplate = `---
name: "Meeting Summary Template"
description: "Template for generating meeting summaries"
category: "meeting"
version: "1.0.0"
author: "Documentation Generator"
tags: ["meeting", "summary", "collaboration"]
variables:
  - name: "meetingTitle"
    type: "string"
    required: true
    description: "Title of the meeting"
  - name: "meetingDate"
    type: "date"
    required: true
    description: "Date of the meeting"
  - name: "participants"
    type: "array"
    required: true
    description: "Meeting participants"
  - name: "meetingType"
    type: "select"
    required: true
    description: "Type of meeting"
    options: ["planning", "review", "standup", "retrospective"]
  - name: "duration"
    type: "string"
    required: false
    description: "Meeting duration"
  - name: "agenda"
    type: "array"
    required: false
    description: "Meeting agenda items"
  - name: "decisions"
    type: "array"
    required: false
    description: "Decisions made during meeting"
  - name: "actionItems"
    type: "array"
    required: false
    description: "Action items from meeting"
---

# {{meetingTitle}}

**Date**: {{meetingDate}}
**Duration**: {{duration}}
**Type**: {{meetingType}}

## Participants
{{#participants}}
- {{name}} ({{role}})
{{/participants}}

## Agenda
{{#agenda}}
{{@index}}. {{.}}
{{/agenda}}

## Decisions Made
{{#decisions}}
- **{{title}}**: {{description}}
{{/decisions}}

## Action Items
{{#actionItems}}
- [ ] {{description}} ({{assignee}} - {{dueDate}})
{{/actionItems}}

---
*Generated on {{currentDate}}*
`;

        // Write templates to test directory
        await fs.writeFile(path.join(testTemplatesPath, 'help-template.md'), helpTemplate);
        await fs.writeFile(path.join(testTemplatesPath, 'prd-template.md'), prdTemplate);
        await fs.writeFile(path.join(testTemplatesPath, 'technical-template.md'), technicalTemplate);
        await fs.writeFile(path.join(testTemplatesPath, 'meeting-template.md'), meetingTemplate);
    }

    function createMockFolderContext(): FolderContext {
        return {
            name: 'TestProject',
            summary: 'A test project for documentation generation',
            files: [
                {
                    path: 'src/index.js',
                    content: 'console.log("Hello World");',
                    exports: ['main'],
                    imports: ['express'],
                    size: 100
                },
                {
                    path: 'src/api/users.js',
                    content: 'app.get("/users", (req, res) => { res.json(users); });',
                    exports: ['getUsers'],
                    imports: ['express'],
                    size: 150
                },
                {
                    path: 'package.json',
                    content: '{"name": "test-project", "dependencies": {"express": "^4.18.0"}}',
                    exports: [],
                    imports: [],
                    size: 80
                }
            ],
            dependencies: [
                { name: 'express', version: '^4.18.0' },
                { name: 'lodash', version: '^4.17.21' }
            ]
        } as FolderContext;
    }

    describe('Template Loading and Validation', () => {
        it('should load templates from directory', async () => {
            // Mock template manager to use test templates
            const testTemplateManager = new TemplateManager(mockExtensionContext);
            testTemplateManager['defaultTemplatesPath'] = testTemplatesPath;

            await testTemplateManager.initialize();
            const templates = testTemplateManager.getTemplates();

            assert.strictEqual(templates.length, 4, 'Should load all 4 test templates');

            const helpTemplate = testTemplateManager.getTemplate('help-template');
            assert.ok(helpTemplate, 'Should load help template');
            assert.strictEqual(helpTemplate.metadata.name, 'Help Documentation Template');
            assert.strictEqual(helpTemplate.metadata.category, 'documentation');
        });

        it('should validate template structure', async () => {
            const testTemplateManager = new TemplateManager(mockExtensionContext);
            testTemplateManager['defaultTemplatesPath'] = testTemplatesPath;

            await testTemplateManager.initialize();
            const template = testTemplateManager.getTemplate('help-template');

            assert.ok(template, 'Template should exist');
            const validation = testTemplateManager.validateTemplate(template);

            assert.strictEqual(validation.isValid, true, 'Template should be valid');
            assert.strictEqual(validation.errors.length, 0, 'Should have no validation errors');
        });

        it('should extract template variables correctly', async () => {
            const testTemplateManager = new TemplateManager(mockExtensionContext);
            testTemplateManager['defaultTemplatesPath'] = testTemplatesPath;

            await testTemplateManager.initialize();
            const variables = testTemplateManager.getTemplateVariables('help-template');

            assert.ok(variables.length > 0, 'Should have template variables');

            const projectNameVar = variables.find(v => v.name === 'projectName');
            assert.ok(projectNameVar, 'Should have projectName variable');
            assert.strictEqual(projectNameVar.type, 'string', 'projectName should be string type');
            assert.strictEqual(projectNameVar.required, true, 'projectName should be required');
        });

        it('should handle missing variables gracefully', async () => {
            const testTemplateManager = new TemplateManager(mockExtensionContext);
            testTemplateManager['defaultTemplatesPath'] = testTemplatesPath;

            await testTemplateManager.initialize();

            const incompleteVariables = {
                projectName: 'Test Project'
                // Missing required projectDescription
            };

            try {
                await testTemplateManager.processTemplate('help-template', incompleteVariables);
                assert.fail('Should throw error for missing required variables');
            } catch (error) {
                assert.ok(error.message.includes('Missing required variables'), 'Should indicate missing variables');
            }
        });
    });

    describe('Variable Substitution', () => {
        let testTemplateManager: TemplateManager;

        beforeEach(async () => {
            testTemplateManager = new TemplateManager(mockExtensionContext);
            testTemplateManager['defaultTemplatesPath'] = testTemplatesPath;
            await testTemplateManager.initialize();
        });

        it('should substitute simple variables', async () => {
            const variables = {
                projectName: 'Amazing Project',
                projectDescription: 'An amazing test project'
            };

            const result = await testTemplateManager.processTemplate('help-template', variables);

            assert.ok(result.includes('Amazing Project'), 'Should substitute projectName');
            assert.ok(result.includes('An amazing test project'), 'Should substitute projectDescription');
        });

        it('should process array iterations', async () => {
            const variables = {
                projectName: 'Test Project',
                projectDescription: 'Test description',
                mainFeatures: [
                    { name: 'Feature 1', description: 'First feature' },
                    { name: 'Feature 2', description: 'Second feature' }
                ]
            };

            const result = await testTemplateManager.processTemplate('help-template', variables);

            assert.ok(result.includes('Feature 1'), 'Should include first feature');
            assert.ok(result.includes('Feature 2'), 'Should include second feature');
            assert.ok(result.includes('First feature'), 'Should include first feature description');
        });

        it('should process simple array values', async () => {
            const variables = {
                projectName: 'Test Project',
                projectDescription: 'Test description',
                installationSteps: [
                    'npm install',
                    'npm start',
                    'Open browser'
                ]
            };

            const result = await testTemplateManager.processTemplate('help-template', variables);

            assert.ok(result.includes('npm install'), 'Should include installation step');
            assert.ok(result.includes('npm start'), 'Should include start command');
            assert.ok(result.includes('Open browser'), 'Should include browser instruction');
        });

        it('should handle analysis data patterns', async () => {
            const variables = {
                projectName: 'Test Project',
                projectDescription: 'Test description',
                analysis: {
                    projectName: 'Analysis Project',
                    fileCount: 10,
                    dependencies: ['express', 'lodash']
                }
            };

            const content = '# {{projectName}}\n\nProject from analysis: {{analysis.projectName}}\nFiles: {{analysis.fileCount}}';
            const result = await testTemplateManager.processTemplateContent(content, variables);

            assert.ok(result.includes('Test Project'), 'Should substitute main projectName');
            assert.ok(result.includes('Analysis Project'), 'Should substitute analysis.projectName');
            assert.ok(result.includes('Files: 10'), 'Should substitute analysis.fileCount');
        });

        it('should add common variables automatically', async () => {
            const variables = {
                projectName: 'Test Project',
                projectDescription: 'Test description'
            };

            const result = await testTemplateManager.processTemplate('help-template', variables);

            // Should include automatically added currentDate
            const currentYear = new Date().getFullYear().toString();
            assert.ok(result.includes(currentYear), 'Should include current year from currentDate');
        });
    });

    describe('Content Generation with Real Data', () => {
        let helpGenerator: HelpDocumentationGenerator;
        let prdGenerator: PRDGenerator;
        let technicalGenerator: TechnicalSpecGenerator;
        let meetingGenerator: MeetingSummaryGenerator;
        let testTemplateManager: TemplateManager;

        beforeEach(async () => {
            testTemplateManager = new TemplateManager(mockExtensionContext);
            testTemplateManager['defaultTemplatesPath'] = testTemplatesPath;
            await testTemplateManager.initialize();

            helpGenerator = new HelpDocumentationGenerator(testTemplateManager, claudeIntegrator);
            prdGenerator = new PRDGenerator(testTemplateManager, claudeIntegrator);
            technicalGenerator = new TechnicalSpecGenerator(testTemplateManager, claudeIntegrator);
            meetingGenerator = new MeetingSummaryGenerator(testTemplateManager, claudeIntegrator);
        });

        it('should generate help documentation with template', async () => {
            const folderContext = createMockFolderContext();
            const options = {
                includeAPIReference: true,
                includeExamples: false,
                includeTroubleshooting: false,
                includeFAQ: false,
                includeGettingStarted: true,
                outputFormat: 'markdown' as const,
                templateName: 'help-template'
            };

            const result = await helpGenerator.generateHelpDocumentation(folderContext, options);

            assert.ok(result.includes('TestProject'), 'Should include project name');
            assert.ok(result.includes('User Guide'), 'Should include template header');
            assert.ok(result.includes('Getting Started'), 'Should include getting started section');
            assert.ok(result.length > 100, 'Should generate substantial content');
        });

        it('should generate PRD with template', async () => {
            const folderContext = createMockFolderContext();
            const options = {
                includeUserStories: true,
                includeAcceptanceCriteria: false,
                includeDependencyAnalysis: false,
                includeSuccessMetrics: false,
                includeTimeline: false,
                businessContext: 'Improve user experience',
                targetAudience: ['developers', 'end-users'],
                outputFormat: 'markdown' as const,
                templateName: 'prd-template'
            };

            const result = await prdGenerator.generatePRD(folderContext, options);

            assert.ok(result.includes('TestProject'), 'Should include project name');
            assert.ok(result.includes('Product Requirements Document'), 'Should include template header');
            assert.ok(result.includes('Product Vision'), 'Should include product vision section');
            assert.ok(result.length > 100, 'Should generate substantial content');
        });

        it('should generate technical specification with template', async () => {
            const folderContext = createMockFolderContext();
            const options = {
                includeArchitecture: true,
                includeAPISpec: true,
                includeDatabaseSchema: false,
                includeConfiguration: false,
                includeDeployment: false,
                includeTestingStrategy: false,
                includeIntegrationMap: false,
                technicalLevel: 'intermediate' as const,
                outputFormat: 'markdown' as const,
                templateName: 'technical-template'
            };

            const result = await technicalGenerator.generateTechnicalSpecification(
                '/test/path',
                folderContext,
                options
            );

            assert.ok(result.includes('TestProject'), 'Should include system name');
            assert.ok(result.includes('Technical Specification'), 'Should include template header');
            assert.ok(result.includes('Architecture Overview'), 'Should include architecture section');
            assert.ok(result.length > 100, 'Should generate substantial content');
        });

        it('should generate meeting summary with template', async () => {
            const meetingContext = {
                title: 'Sprint Planning Meeting',
                date: '2024-01-15',
                duration: '2 hours',
                meetingType: 'planning',
                participants: [
                    { name: 'John Doe', role: 'Developer', attendance: 'present', contributions: [], actionItemsAssigned: 0, expertise: [] },
                    { name: 'Jane Smith', role: 'Product Manager', attendance: 'present', contributions: [], actionItemsAssigned: 0, expertise: [] }
                ],
                agenda: ['Review previous sprint', 'Plan next sprint', 'Discuss blockers'],
                objectives: ['Define sprint goals', 'Assign tasks']
            };

            const options = {
                includeActionItems: true,
                includeDecisionTracking: true,
                includeFollowUpTasks: false,
                includeParticipantTracking: false,
                includeMeetingNotes: false,
                includeSeriesTracking: false,
                meetingType: 'planning' as const,
                outputFormat: 'markdown' as const,
                templateName: 'meeting-template'
            };

            const discussionContent = 'We discussed the sprint goals and assigned tasks to team members.';

            const result = await meetingGenerator.generateMeetingSummary(
                meetingContext,
                discussionContent,
                undefined,
                options
            );

            assert.ok(result.includes('Sprint Planning Meeting'), 'Should include meeting title');
            assert.ok(result.includes('2024-01-15'), 'Should include meeting date');
            assert.ok(result.includes('John Doe'), 'Should include participants');
            assert.ok(result.length > 100, 'Should generate substantial content');
        });
    });

    describe('Error Handling', () => {
        let testTemplateManager: TemplateManager;

        beforeEach(async () => {
            testTemplateManager = new TemplateManager(mockExtensionContext);
            testTemplateManager['defaultTemplatesPath'] = testTemplatesPath;
            await testTemplateManager.initialize();
        });

        it('should handle missing template gracefully', async () => {
            try {
                await testTemplateManager.processTemplate('non-existent-template', {});
                assert.fail('Should throw error for missing template');
            } catch (error) {
                assert.ok(error.message.includes('not found'), 'Should indicate template not found');
            }
        });

        it('should handle invalid template content', async () => {
            // Create invalid template without frontmatter
            const invalidTemplatePath = path.join(testTemplatesPath, 'invalid-template.md');
            await fs.writeFile(invalidTemplatePath, '# Just content without frontmatter');

            const testManager = new TemplateManager(mockExtensionContext);
            testManager['defaultTemplatesPath'] = testTemplatesPath;

            // Should handle invalid template during initialization
            await testManager.initialize();
            const invalidTemplate = testManager.getTemplate('invalid-template');
            assert.strictEqual(invalidTemplate, undefined, 'Should not load invalid template');
        });

        it('should validate variable types', async () => {
            const template = testTemplateManager.getTemplate('technical-template');
            assert.ok(template, 'Template should exist');

            const validation = testTemplateManager.validateTemplate(template);
            assert.strictEqual(validation.isValid, true, 'Template should be valid');

            // Check that select variable has options
            const archTypeVar = template.metadata.variables?.find(v => v.name === 'architectureType');
            assert.ok(archTypeVar, 'Should have architectureType variable');
            assert.strictEqual(archTypeVar.type, 'select', 'Should be select type');
            assert.ok(archTypeVar.options && archTypeVar.options.length > 0, 'Select variable should have options');
        });

        it('should handle unprocessed template syntax', async () => {
            const contentWithUnprocessed = '{{unprocessedVariable}} and {{#nonExistentArray}}{{/nonExistentArray}}';
            const result = await testTemplateManager.processTemplateContent(contentWithUnprocessed, {});

            // Should clean up unprocessed syntax
            assert.ok(!result.includes('{{unprocessedVariable}}'), 'Should remove unprocessed variables');
            assert.ok(!result.includes('{{#nonExistentArray}}'), 'Should remove unprocessed array syntax');
        });
    });

    describe('All Template Types Generation', () => {
        it('should generate content for all template types', async () => {
            const testTemplateManager = new TemplateManager(mockExtensionContext);
            testTemplateManager['defaultTemplatesPath'] = testTemplatesPath;
            await testTemplateManager.initialize();

            const folderContext = createMockFolderContext();
            const templates = ['help-template', 'prd-template', 'technical-template', 'meeting-template'];

            for (const templateName of templates) {
                const template = testTemplateManager.getTemplate(templateName);
                assert.ok(template, `Template ${templateName} should exist`);

                // Create appropriate variables for each template
                let variables: any = {};

                switch (templateName) {
                    case 'help-template':
                        variables = {
                            projectName: 'Test Project',
                            projectDescription: 'Test description',
                            mainFeatures: [{ name: 'Feature 1', description: 'Test feature' }]
                        };
                        break;
                    case 'prd-template':
                        variables = {
                            productName: 'Test Product',
                            productVision: 'Test vision',
                            targetAudience: [{ name: 'Users', description: 'End users' }],
                            businessGoals: [{ goal: 'Increase satisfaction', rationale: 'User feedback' }]
                        };
                        break;
                    case 'technical-template':
                        variables = {
                            systemName: 'Test System',
                            architectureType: 'monolith',
                            technologies: [{ category: 'Backend', technology: 'Node.js' }]
                        };
                        break;
                    case 'meeting-template':
                        variables = {
                            meetingTitle: 'Test Meeting',
                            meetingDate: '2024-01-15',
                            meetingType: 'planning',
                            participants: [{ name: 'John', role: 'Developer' }]
                        };
                        break;
                }

                const result = await testTemplateManager.processTemplate(templateName, variables);
                assert.ok(result.length > 50, `Template ${templateName} should generate content`);
                assert.ok(!result.includes('{{'), `Template ${templateName} should not have unprocessed variables`);
            }
        });
    });
});