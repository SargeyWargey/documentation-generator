import { Resource } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { ResourceProvider } from './ResourceManager.js';

export interface FolderContext {
  folderPath: string;
  name: string;
  projectType: string;
  totalFiles: number;
  totalLines: number;
  summary: string;
  dependencies: string[];
  documentation: {
    readme?: string;
    changelog?: string;
    license?: string;
    comments: string[];
    apiDocs: string[];
  };
  codeStructures: Map<string, CodeStructure>;
  files: FileInfo[];
}

export interface CodeStructure {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  exports: string[];
  imports: ImportInfo[];
}

export interface FunctionInfo {
  name: string;
  parameters: string[];
  returnType?: string;
  description?: string;
  line: number;
}

export interface ClassInfo {
  name: string;
  methods: string[];
  properties: string[];
  description?: string;
  line: number;
}

export interface InterfaceInfo {
  name: string;
  properties: string[];
  description?: string;
  line: number;
}

export interface ImportInfo {
  module: string;
  imports: string[];
  line: number;
}

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  lastModified: Date;
  content?: string;
  summary?: string;
}

export class FolderAnalysisProvider implements ResourceProvider {
  name = 'folder-analysis';
  private folderContexts = new Map<string, FolderContext>();

  async getResources(): Promise<Resource[]> {
    const resources: Resource[] = [];

    for (const [folderPath, context] of this.folderContexts.entries()) {
      resources.push({
        uri: `folder-context://${encodeURIComponent(folderPath)}`,
        name: `${context.name} Context`,
        description: `Project context for ${context.name} (${context.projectType})`,
        mimeType: 'application/json',
      });

      // Add individual file resources for important files
      const importantFiles = context.files.filter(
        (f) =>
          f.name.toLowerCase().includes('readme') ||
          f.name.toLowerCase().includes('package.json') ||
          f.name.includes('main') ||
          f.name.includes('index')
      );

      for (const file of importantFiles.slice(0, 5)) {
        resources.push({
          uri: `file-content://${encodeURIComponent(folderPath)}/${encodeURIComponent(file.path)}`,
          name: `${context.name}/${file.path}`,
          description: `File content: ${file.summary || file.name}`,
          mimeType: file.extension === '.json' ? 'application/json' : 'text/plain',
        });
      }
    }

    return resources;
  }

  async readResource(uri: string): Promise<string> {
    if (uri.startsWith('folder-context://')) {
      const folderPath = decodeURIComponent(uri.replace('folder-context://', ''));
      const context = this.folderContexts.get(folderPath);

      if (!context) {
        throw new Error(`Folder context not found for path: ${folderPath}`);
      }

      return JSON.stringify(this.serializeFolderContext(context), null, 2);
    }

    if (uri.startsWith('file-content://')) {
      const parts = uri.replace('file-content://', '').split('/');
      const folderPath = decodeURIComponent(parts[0]);
      const filePath = decodeURIComponent(parts.slice(1).join('/'));

      const context = this.folderContexts.get(folderPath);
      if (!context) {
        throw new Error(`Folder context not found for path: ${folderPath}`);
      }

      const file = context.files.find((f) => f.path === filePath);
      if (!file || !file.content) {
        throw new Error(`File content not found: ${filePath}`);
      }

      return file.content;
    }

    throw new Error(`Unsupported resource URI: ${uri}`);
  }

  async analyzeFolder(folderPath: string, excludePatterns: string[] = []): Promise<FolderContext> {
    const defaultExcludes = ['node_modules', '.git', 'dist', 'build', '.next', '.vscode', 'coverage'];
    const allExcludes = [...defaultExcludes, ...excludePatterns];

    try {
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${folderPath}`);
      }

      const context: FolderContext = {
        folderPath,
        name: path.basename(folderPath),
        projectType: 'unknown',
        totalFiles: 0,
        totalLines: 0,
        summary: '',
        dependencies: [],
        documentation: {
          comments: [],
          apiDocs: [],
        },
        codeStructures: new Map(),
        files: [],
      };

      await this.scanDirectory(folderPath, context, allExcludes);
      await this.detectProjectType(context);
      await this.generateSummary(context);

      this.folderContexts.set(folderPath, context);
      return context;
    } catch (error) {
      throw new Error(`Failed to analyze folder ${folderPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateContext(folderPath: string, contextData: Partial<FolderContext>): Promise<void> {
    const existingContext = this.folderContexts.get(folderPath);
    if (!existingContext) {
      throw new Error(`No context found for folder: ${folderPath}`);
    }

    const updatedContext = { ...existingContext, ...contextData };
    this.folderContexts.set(folderPath, updatedContext);
  }

  private async scanDirectory(
    dirPath: string,
    context: FolderContext,
    excludePatterns: string[],
    relativePath = ''
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);

        // Check if entry should be excluded
        if (excludePatterns.some(pattern => entry.name.includes(pattern) || entryRelativePath.includes(pattern))) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.scanDirectory(entryPath, context, excludePatterns, entryRelativePath);
        } else if (entry.isFile()) {
          await this.processFile(entryPath, entryRelativePath, context);
        }
      }
    } catch (error) {
      // Log error but continue processing
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }
  }

  private async processFile(filePath: string, relativePath: string, context: FolderContext): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      const extension = path.extname(filePath);
      const name = path.basename(filePath);

      const fileInfo: FileInfo = {
        path: relativePath,
        name,
        extension,
        size: stats.size,
        lastModified: stats.mtime,
      };

      // Read content for text files under a certain size
      if (stats.size < 1024 * 1024 && this.isTextFile(extension)) {
        try {
          fileInfo.content = await fs.readFile(filePath, 'utf-8');
          fileInfo.summary = this.generateFileSummary(fileInfo.content, extension);

          // Count lines
          const lines = fileInfo.content.split('\n').length;
          context.totalLines += lines;

          // Analyze code structure for source files
          if (this.isSourceFile(extension)) {
            const structure = this.analyzeCodeStructure(fileInfo.content, extension);
            if (structure) {
              context.codeStructures.set(relativePath, structure);
            }
          }

          // Check for documentation files
          this.checkDocumentationFile(fileInfo, context);
        } catch (error) {
          // File might be binary or permission denied
          fileInfo.summary = 'Could not read file content';
        }
      }

      context.files.push(fileInfo);
      context.totalFiles++;
    } catch (error) {
      console.warn(`Failed to process file ${filePath}:`, error);
    }
  }

  private isTextFile(extension: string): boolean {
    const textExtensions = [
      '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.py', '.java',
      '.cs', '.cpp', '.c', '.h', '.css', '.scss', '.html', '.xml', '.yaml',
      '.yml', '.toml', '.ini', '.cfg', '.conf', '.sh', '.bat', '.ps1', '.php',
      '.rb', '.go', '.rs', '.kt', '.swift', '.dart', '.vue', '.svelte', '.r',
      '.sql', '.graphql', '.dockerfile', '.gitignore', '.gitattributes',
    ];
    return textExtensions.includes(extension.toLowerCase()) || extension === '';
  }

  private isSourceFile(extension: string): boolean {
    const sourceExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.cpp', '.c',
      '.h', '.php', '.rb', '.go', '.rs', '.kt', '.swift', '.dart', '.vue',
      '.svelte',
    ];
    return sourceExtensions.includes(extension.toLowerCase());
  }

  private generateFileSummary(content: string, extension: string): string {
    const lines = content.split('\n');
    const firstNonEmptyLine = lines.find(line => line.trim() !== '');

    if (extension === '.json') {
      try {
        const json = JSON.parse(content);
        if (json.name && json.description) {
          return `${json.name}: ${json.description}`;
        }
      } catch {
        // Not valid JSON
      }
    }

    if (extension === '.md') {
      const firstHeader = lines.find(line => line.startsWith('#'));
      if (firstHeader) {
        return firstHeader.replace(/^#+\s*/, '');
      }
    }

    return firstNonEmptyLine?.substring(0, 100) || 'No summary available';
  }

  private analyzeCodeStructure(content: string, extension: string): CodeStructure | null {
    const structure: CodeStructure = {
      functions: [],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [],
    };

    const lines = content.split('\n');

    // Basic pattern matching - this is simplified
    // In a real implementation, you'd use proper AST parsing

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Detect imports
      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        const importMatch = trimmed.match(/import\s+(.+?)\s+from\s+['"](.+)['"]/);
        if (importMatch) {
          structure.imports.push({
            module: importMatch[2],
            imports: importMatch[1].split(',').map(i => i.trim()),
            line: index + 1,
          });
        }
      }

      // Detect exports
      if (trimmed.startsWith('export ')) {
        const exportMatch = trimmed.match(/export\s+(?:default\s+)?(?:function\s+|class\s+|const\s+|let\s+|var\s+)?(\w+)/);
        if (exportMatch) {
          structure.exports.push(exportMatch[1]);
        }
      }

      // Detect functions
      const functionMatch = trimmed.match(/(?:function\s+|const\s+|let\s+|var\s+)(\w+)\s*(?:=\s*)?(?:\([^)]*\)|\()/);
      if (functionMatch && !trimmed.includes('class ')) {
        structure.functions.push({
          name: functionMatch[1],
          parameters: [], // Simplified
          line: index + 1,
        });
      }

      // Detect classes
      const classMatch = trimmed.match(/class\s+(\w+)/);
      if (classMatch) {
        structure.classes.push({
          name: classMatch[1],
          methods: [],
          properties: [],
          line: index + 1,
        });
      }

      // Detect interfaces (TypeScript)
      const interfaceMatch = trimmed.match(/interface\s+(\w+)/);
      if (interfaceMatch) {
        structure.interfaces.push({
          name: interfaceMatch[1],
          properties: [],
          line: index + 1,
        });
      }
    });

    return structure;
  }

  private checkDocumentationFile(fileInfo: FileInfo, context: FolderContext): void {
    const lowerName = fileInfo.name.toLowerCase();

    if (lowerName.includes('readme')) {
      context.documentation.readme = fileInfo.content;
    } else if (lowerName.includes('changelog')) {
      context.documentation.changelog = fileInfo.content;
    } else if (lowerName.includes('license')) {
      context.documentation.license = fileInfo.content;
    }
  }

  private async detectProjectType(context: FolderContext): Promise<void> {
    const hasPackageJson = context.files.some(f => f.name === 'package.json');
    const hasPyprojectToml = context.files.some(f => f.name === 'pyproject.toml');
    const hasCargoToml = context.files.some(f => f.name === 'Cargo.toml');
    const hasPomXml = context.files.some(f => f.name === 'pom.xml');
    const hasGradleBuild = context.files.some(f => f.name.includes('build.gradle'));

    if (hasPackageJson) {
      context.projectType = 'Node.js/JavaScript';
      // Extract dependencies from package.json
      const packageFile = context.files.find(f => f.name === 'package.json');
      if (packageFile?.content) {
        try {
          const packageJson = JSON.parse(packageFile.content);
          context.dependencies = [
            ...Object.keys(packageJson.dependencies || {}),
            ...Object.keys(packageJson.devDependencies || {}),
          ];
        } catch {
          // Invalid JSON
        }
      }
    } else if (hasPyprojectToml || context.files.some(f => f.extension === '.py')) {
      context.projectType = 'Python';
    } else if (hasCargoToml || context.files.some(f => f.extension === '.rs')) {
      context.projectType = 'Rust';
    } else if (hasPomXml || hasGradleBuild || context.files.some(f => f.extension === '.java')) {
      context.projectType = 'Java';
    } else if (context.files.some(f => f.extension === '.cs')) {
      context.projectType = 'C#';
    } else if (context.files.some(f => f.extension === '.go')) {
      context.projectType = 'Go';
    } else {
      context.projectType = 'Unknown';
    }
  }

  private async generateSummary(context: FolderContext): Promise<void> {
    const summaryParts = [
      `${context.projectType} project with ${context.totalFiles} files`,
      `Total lines of code: ${context.totalLines}`,
    ];

    if (context.dependencies.length > 0) {
      summaryParts.push(`Dependencies: ${context.dependencies.slice(0, 5).join(', ')}${context.dependencies.length > 5 ? '...' : ''}`);
    }

    const totalFunctions = Array.from(context.codeStructures.values()).reduce(
      (sum, structure) => sum + structure.functions.length,
      0
    );
    const totalClasses = Array.from(context.codeStructures.values()).reduce(
      (sum, structure) => sum + structure.classes.length,
      0
    );

    if (totalFunctions > 0) {
      summaryParts.push(`${totalFunctions} functions`);
    }
    if (totalClasses > 0) {
      summaryParts.push(`${totalClasses} classes`);
    }

    context.summary = summaryParts.join(', ');
  }

  private serializeFolderContext(context: FolderContext) {
    return {
      folderPath: context.folderPath,
      name: context.name,
      projectType: context.projectType,
      totalFiles: context.totalFiles,
      totalLines: context.totalLines,
      summary: context.summary,
      dependencies: context.dependencies,
      documentation: {
        hasReadme: !!context.documentation.readme,
        hasChangelog: !!context.documentation.changelog,
        hasLicense: !!context.documentation.license,
        commentCount: context.documentation.comments.length,
        apiDocsCount: context.documentation.apiDocs.length,
      },
      codeStructure: {
        totalFunctions: Array.from(context.codeStructures.values()).reduce(
          (sum, structure) => sum + structure.functions.length,
          0
        ),
        totalClasses: Array.from(context.codeStructures.values()).reduce(
          (sum, structure) => sum + structure.classes.length,
          0
        ),
        totalInterfaces: Array.from(context.codeStructures.values()).reduce(
          (sum, structure) => sum + structure.interfaces.length,
          0
        ),
        fileCount: context.codeStructures.size,
      },
      importantFiles: context.files
        .filter(
          (f) =>
            f.name.toLowerCase().includes('readme') ||
            f.name.toLowerCase().includes('package.json') ||
            f.name.includes('main') ||
            f.name.includes('index')
        )
        .slice(0, 10)
        .map((f) => ({
          path: f.path,
          name: f.name,
          size: f.size,
          summary: f.summary,
          lastModified: f.lastModified,
        })),
    };
  }
}