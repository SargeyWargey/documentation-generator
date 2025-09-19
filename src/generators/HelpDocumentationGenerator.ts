import { FolderContext } from '../utils/FolderAnalyzer';
import { TemplateManager } from '../templates/TemplateManager';
import { ClaudeIntegrator } from '../commands/ClaudeIntegrator';

export interface HelpDocumentationOptions {
    includeAPIReference: boolean;
    includeExamples: boolean;
    includeTroubleshooting: boolean;
    includeFAQ: boolean;
    includeGettingStarted: boolean;
    outputFormat: 'markdown' | 'html' | 'confluence';
    templateName?: string;
}

export interface APIDocumentation {
    className: string;
    methodName: string;
    parameters: Array<{
        name: string;
        type: string;
        description?: string;
        required: boolean;
    }>;
    returnType: string;
    description: string;
    examples: string[];
    filePath: string;
    lineNumber: number;
}

export interface FeatureAnalysis {
    featureName: string;
    description: string;
    mainFiles: string[];
    dependencies: string[];
    publicInterface: string[];
    usageExamples: string[];
    complexity: 'low' | 'medium' | 'high';
}

export interface GettingStartedSection {
    prerequisites: string[];
    installationSteps: string[];
    basicUsage: string[];
    firstExample: string;
    nextSteps: string[];
}

export interface TroubleshootingEntry {
    problem: string;
    symptoms: string[];
    solutions: string[];
    relatedCode: string[];
    severity: 'low' | 'medium' | 'high';
}

export interface FAQEntry {
    question: string;
    answer: string;
    category: string;
    codeReferences: string[];
    tags: string[];
}

export class HelpDocumentationGenerator {
    private templateManager: TemplateManager;
    private claudeIntegrator: ClaudeIntegrator;

    constructor(templateManager: TemplateManager, claudeIntegrator: ClaudeIntegrator) {
        this.templateManager = templateManager;
        this.claudeIntegrator = claudeIntegrator;
    }

    async generateHelpDocumentation(
        analysisResult: FolderContext,
        options: HelpDocumentationOptions
    ): Promise<string> {
        const sections: string[] = [];

        if (options.includeGettingStarted) {
            const gettingStarted = await this.generateGettingStartedSection(analysisResult);
            sections.push(this.formatGettingStartedSection(gettingStarted));
        }

        if (options.includeAPIReference) {
            const apiDocs = await this.detectAndParseAPIDocumentation(analysisResult);
            sections.push(this.formatAPIDocumentation(apiDocs));
        }

        if (options.includeExamples) {
            const examples = await this.generateExamplesSection(analysisResult);
            sections.push(examples);
        }

        if (options.includeTroubleshooting) {
            const troubleshooting = await this.generateTroubleshootingSection(analysisResult);
            sections.push(this.formatTroubleshootingSection(troubleshooting));
        }

        if (options.includeFAQ) {
            const faq = await this.generateFAQSection(analysisResult);
            sections.push(this.formatFAQSection(faq));
        }

        const templateName = options.templateName || 'help-documentation-default';
        const template = this.templateManager.getTemplate(templateName);
        if (!template) {
            throw new Error(`Template '${templateName}' not found`);
        }

        const variables = {
            projectName: analysisResult.name || 'Project',
            sections: sections.join('\n\n'),
            generatedDate: new Date().toISOString(),
            name: analysisResult.name,
            summary: analysisResult.summary
        };

        return await this.templateManager.processTemplate(templateName, variables);
    }

    async detectAndParseAPIDocumentation(analysisResult: FolderContext): Promise<APIDocumentation[]> {
        const apiDocs: APIDocumentation[] = [];

        for (const file of analysisResult.files) {
            if (this.isAPIFile(file)) {
                const fileDocs = await this.parseFileForAPI(file);
                apiDocs.push(...fileDocs);
            }
        }

        return apiDocs;
    }

    private isAPIFile(file: any): boolean {
        const apiPatterns = [
            /api\//i,
            /controller/i,
            /service/i,
            /handler/i,
            /route/i,
            /endpoint/i
        ];

        return apiPatterns.some(pattern => pattern.test(file.path)) ||
               file.exports?.some((exp: string) => exp.includes('API') || exp.includes('Controller'));
    }

    private async parseFileForAPI(file: any): Promise<APIDocumentation[]> {
        const docs: APIDocumentation[] = [];

        // Extract JSDoc comments and type information
        const classMatches = file.content?.match(/class\s+(\w+)/g) || [];
        const methodMatches = file.content?.match(/(?:public|private|protected)?\s*(\w+)\s*\([^)]*\)/g) || [];

        for (const classMatch of classMatches) {
            const className = classMatch.replace(/class\s+/, '');

            // Find associated methods and documentation
            const apiDoc: APIDocumentation = {
                className,
                methodName: 'constructor',
                parameters: [],
                returnType: 'void',
                description: `${className} class`,
                examples: [],
                filePath: file.path,
                lineNumber: 1
            };

            docs.push(apiDoc);
        }

        return docs;
    }

    async analyzeFeatures(analysisResult: FolderContext): Promise<FeatureAnalysis[]> {
        const features: FeatureAnalysis[] = [];

        // Group files by feature based on directory structure and naming
        const featureGroups = this.groupFilesByFeature(analysisResult.files);

        for (const [featureName, files] of featureGroups) {
            const analysis: FeatureAnalysis = {
                featureName,
                description: await this.generateFeatureDescription(files),
                mainFiles: files.map(f => f.path),
                dependencies: this.extractFeatureDependencies(files),
                publicInterface: this.extractPublicInterface(files),
                usageExamples: await this.generateFeatureExamples(files),
                complexity: this.assessFeatureComplexity(files)
            };

            features.push(analysis);
        }

        return features;
    }

    private groupFilesByFeature(files: any[]): Map<string, any[]> {
        const groups = new Map<string, any[]>();

        for (const file of files) {
            const featureName = this.extractFeatureName(file.path);
            if (!groups.has(featureName)) {
                groups.set(featureName, []);
            }
            groups.get(featureName)!.push(file);
        }

        return groups;
    }

    private extractFeatureName(filePath: string): string {
        const pathParts = filePath.split('/');

        // Look for feature directories or file prefixes
        for (let i = pathParts.length - 1; i >= 0; i--) {
            const part = pathParts[i];
            if (part.includes('feature') || part.includes('module') || part.includes('component')) {
                return part;
            }
        }

        // Fallback to parent directory
        return pathParts[pathParts.length - 2] || 'core';
    }

    private async generateFeatureDescription(files: any[]): Promise<string> {
        // Analyze README files, comments, and code structure
        const readmeFile = files.find(f => f.path.toLowerCase().includes('readme'));
        if (readmeFile?.content) {
            return this.extractDescriptionFromReadme(readmeFile.content);
        }

        // Generate from code analysis
        return `Feature managing ${files.length} files with core functionality`;
    }

    private extractFeatureDependencies(files: any[]): string[] {
        const dependencies = new Set<string>();

        for (const file of files) {
            const imports = file.imports || [];
            for (const imp of imports) {
                if (!imp.startsWith('.')) {
                    dependencies.add(imp);
                }
            }
        }

        return Array.from(dependencies);
    }

    private extractPublicInterface(files: any[]): string[] {
        const publicInterface: string[] = [];

        for (const file of files) {
            const exports = file.exports || [];
            publicInterface.push(...exports);
        }

        return publicInterface;
    }

    private async generateFeatureExamples(files: any[]): Promise<string[]> {
        const examples: string[] = [];

        // Look for test files for usage examples
        const testFiles = files.filter(f => f.path.includes('test') || f.path.includes('spec'));

        for (const testFile of testFiles) {
            const testExamples = this.extractExamplesFromTests(testFile.content);
            examples.push(...testExamples);
        }

        return examples;
    }

    private assessFeatureComplexity(files: any[]): 'low' | 'medium' | 'high' {
        const totalLines = files.reduce((sum, f) => sum + (f.size || 0), 0);
        const fileCount = files.length;

        if (totalLines > 5000 || fileCount > 10) return 'high';
        if (totalLines > 1000 || fileCount > 5) return 'medium';
        return 'low';
    }

    async generateGettingStartedSection(analysisResult: FolderContext): Promise<GettingStartedSection> {
        const packageJson = analysisResult.files.find(f => f.path.endsWith('package.json'));
        const readme = analysisResult.files.find(f => f.path.toLowerCase().includes('readme'));

        return {
            prerequisites: await this.extractPrerequisites(packageJson),
            installationSteps: await this.generateInstallationSteps(packageJson),
            basicUsage: await this.generateBasicUsage(analysisResult),
            firstExample: await this.generateFirstExample(analysisResult),
            nextSteps: await this.generateNextSteps()
        };
    }

    private async extractPrerequisites(packageJson: any): Promise<string[]> {
        const prerequisites: string[] = [];

        if (packageJson?.content) {
            try {
                const pkg = JSON.parse(packageJson.content);
                if (pkg.engines?.node) {
                    prerequisites.push(`Node.js ${pkg.engines.node}`);
                }
                if (pkg.engines?.npm) {
                    prerequisites.push(`npm ${pkg.engines.npm}`);
                }
            } catch (error) {
                // Ignore JSON parsing errors
            }
        }

        return prerequisites;
    }

    private async generateInstallationSteps(packageJson: any): Promise<string[]> {
        const steps: string[] = [];

        if (packageJson?.content) {
            try {
                const pkg = JSON.parse(packageJson.content);
                if (pkg.name) {
                    steps.push(`npm install ${pkg.name}`);
                }
            } catch (error) {
                steps.push('Clone the repository');
                steps.push('Run npm install');
            }
        } else {
            steps.push('Clone the repository');
            steps.push('Run npm install');
        }

        return steps;
    }

    private async generateBasicUsage(analysisResult: FolderContext): Promise<string[]> {
        const usage: string[] = [];

        // Look for main entry points
        const mainFile = analysisResult.files.find(f =>
            f.path.includes('index') ||
            f.path.includes('main') ||
            f.path.includes('app')
        );

        if (mainFile) {
            usage.push(`Import the main module: import { } from '${analysisResult.name}'`);
        }

        return usage;
    }

    private async generateFirstExample(analysisResult: FolderContext): Promise<string> {
        // Find the simplest example or create a basic one
        const exampleFiles = analysisResult.files.filter(f =>
            f.path.includes('example') ||
            f.path.includes('demo') ||
            f.path.includes('sample')
        );

        if (exampleFiles.length > 0) {
            return `// Basic example\n${exampleFiles[0].content?.substring(0, 500) || ''}`;
        }

        return `// Basic usage example\nconst ${analysisResult.name} = require('${analysisResult.name}');\nconsole.log('Hello World');`;
    }

    private async generateNextSteps(): Promise<string[]> {
        return [
            'Explore the API documentation below',
            'Check out the examples section',
            'Read the troubleshooting guide if you encounter issues',
            'Visit the FAQ for common questions'
        ];
    }

    async generateTroubleshootingSection(analysisResult: FolderContext): Promise<TroubleshootingEntry[]> {
        const troubleshooting: TroubleshootingEntry[] = [];

        // Analyze common error patterns
        const errorPatterns = await this.extractErrorPatterns(analysisResult);

        for (const pattern of errorPatterns) {
            const entry: TroubleshootingEntry = {
                problem: pattern.error,
                symptoms: pattern.symptoms,
                solutions: pattern.solutions,
                relatedCode: pattern.files,
                severity: pattern.severity
            };

            troubleshooting.push(entry);
        }

        return troubleshooting;
    }

    private async extractErrorPatterns(analysisResult: FolderContext): Promise<any[]> {
        const patterns: any[] = [];

        // Look for try-catch blocks, error handling, and common issues
        for (const file of analysisResult.files) {
            if (file.content?.includes('catch') || file.content?.includes('error')) {
                const errorPattern = {
                    error: 'Runtime Error',
                    symptoms: ['Application crashes', 'Unexpected behavior'],
                    solutions: ['Check error logs', 'Verify input parameters'],
                    files: [file.path],
                    severity: 'medium' as const
                };
                patterns.push(errorPattern);
            }
        }

        return patterns;
    }

    async generateFAQSection(analysisResult: FolderContext): Promise<FAQEntry[]> {
        const faq: FAQEntry[] = [];

        // Extract FAQ from comments, issues, and common patterns
        const faqEntries = await this.extractFAQFromCodeComments(analysisResult);

        faq.push(...faqEntries);

        return faq;
    }

    private async extractFAQFromCodeComments(analysisResult: FolderContext): Promise<FAQEntry[]> {
        const faqEntries: FAQEntry[] = [];

        for (const file of analysisResult.files) {
            const comments = this.extractComments(file.content || '');

            for (const comment of comments) {
                if (this.isFAQComment(comment)) {
                    const entry: FAQEntry = {
                        question: this.extractQuestionFromComment(comment),
                        answer: this.extractAnswerFromComment(comment),
                        category: 'General',
                        codeReferences: [file.path],
                        tags: ['code', 'documentation']
                    };

                    faqEntries.push(entry);
                }
            }
        }

        return faqEntries;
    }

    async generateExamplesSection(analysisResult: FolderContext): Promise<string> {
        const examples: string[] = [];

        // Find example files
        const exampleFiles = analysisResult.files.filter(f =>
            f.path.includes('example') ||
            f.path.includes('demo') ||
            f.path.includes('sample') ||
            f.path.includes('tutorial')
        );

        for (const file of exampleFiles) {
            if (file.content) {
                examples.push(`## ${file.path}\n\`\`\`\n${file.content}\n\`\`\``);
            }
        }

        // Generate examples from test files
        const testFiles = analysisResult.files.filter(f =>
            f.path.includes('test') || f.path.includes('spec')
        );

        for (const testFile of testFiles) {
            if (testFile.content) {
                const testExamples = this.extractExamplesFromTests(testFile.content);
                examples.push(...testExamples);
            }
        }

        return examples.join('\n\n');
    }

    // Helper methods
    private extractDescriptionFromReadme(content: string): string {
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.trim() && !line.startsWith('#') && !line.startsWith('!')) {
                return line.trim();
            }
        }
        return 'No description available';
    }

    private extractExamplesFromTests(content: string): string[] {
        const examples: string[] = [];

        // Extract test cases as examples
        const testMatches = content.match(/it\(['"`]([^'"`]+)['"`],.*?\{([\s\S]*?)\}/g) || [];

        for (const match of testMatches) {
            const testName = match.match(/it\(['"`]([^'"`]+)['"`]/)?.[1];
            if (testName) {
                examples.push(`### ${testName}\n\`\`\`javascript\n${match}\n\`\`\``);
            }
        }

        return examples;
    }

    private extractComments(content: string): string[] {
        const comments: string[] = [];

        // Extract single line comments
        const singleLineComments = content.match(/\/\/.*$/gm) || [];
        comments.push(...singleLineComments);

        // Extract multi-line comments
        const multiLineComments = content.match(/\/\*[\s\S]*?\*\//g) || [];
        comments.push(...multiLineComments);

        return comments;
    }

    private isFAQComment(comment: string): boolean {
        const faqKeywords = ['FAQ', 'Q:', 'Question:', 'Why', 'How', 'What'];
        return faqKeywords.some(keyword => comment.includes(keyword));
    }

    private extractQuestionFromComment(comment: string): string {
        // Extract question from comment
        const questionMatch = comment.match(/(?:Q:|Question:|Why|How|What)[^?]*\?/);
        return questionMatch?.[0] || 'How to use this feature?';
    }

    private extractAnswerFromComment(comment: string): string {
        // Extract answer portion of comment
        const lines = comment.split('\n');
        return lines.slice(1).join('\n').trim() || 'See code implementation for details.';
    }

    // Formatting methods
    private formatGettingStartedSection(gettingStarted: GettingStartedSection): string {
        return `## Getting Started

### Prerequisites
${gettingStarted.prerequisites.map(p => `- ${p}`).join('\n')}

### Installation
${gettingStarted.installationSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

### Basic Usage
${gettingStarted.basicUsage.map(u => `- ${u}`).join('\n')}

### First Example
\`\`\`javascript
${gettingStarted.firstExample}
\`\`\`

### Next Steps
${gettingStarted.nextSteps.map(step => `- ${step}`).join('\n')}`;
    }

    private formatAPIDocumentation(apiDocs: APIDocumentation[]): string {
        if (apiDocs.length === 0) {
            return '## API Reference\n\nNo API documentation found.';
        }

        const sections = apiDocs.map(doc => `### ${doc.className}.${doc.methodName}

${doc.description}

**Parameters:**
${doc.parameters.map(p => `- \`${p.name}\` (${p.type}${p.required ? ', required' : ''}): ${p.description || 'No description'}`).join('\n')}

**Returns:** \`${doc.returnType}\`

**Location:** ${doc.filePath}:${doc.lineNumber}

${doc.examples.length > 0 ? `**Examples:**\n${doc.examples.map(ex => `\`\`\`javascript\n${ex}\n\`\`\``).join('\n')}` : ''}`);

        return `## API Reference\n\n${sections.join('\n\n')}`;
    }

    private formatTroubleshootingSection(troubleshooting: TroubleshootingEntry[]): string {
        if (troubleshooting.length === 0) {
            return '## Troubleshooting\n\nNo common issues identified.';
        }

        const entries = troubleshooting.map(entry => `### ${entry.problem}

**Symptoms:**
${entry.symptoms.map(s => `- ${s}`).join('\n')}

**Solutions:**
${entry.solutions.map(s => `- ${s}`).join('\n')}

**Related Files:**
${entry.relatedCode.map(f => `- ${f}`).join('\n')}

**Severity:** ${entry.severity}`);

        return `## Troubleshooting\n\n${entries.join('\n\n')}`;
    }

    private formatFAQSection(faq: FAQEntry[]): string {
        if (faq.length === 0) {
            return '## FAQ\n\nNo frequently asked questions found.';
        }

        const entries = faq.map(entry => `### ${entry.question}

${entry.answer}

**Category:** ${entry.category}
**Tags:** ${entry.tags.join(', ')}`);

        return `## FAQ\n\n${entries.join('\n\n')}`;
    }
}
