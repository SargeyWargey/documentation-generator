import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

export interface FileInfo {
  name: string;
  path: string;
  extension: string;
  size: number;
  isDirectory: boolean;
  lastModified: Date;
  content?: string;
  summary?: string;
}

export interface CodeStructure {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  exports: ExportInfo[];
  imports: ImportInfo[];
}

export interface FunctionInfo {
  name: string;
  parameters: string[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  documentation?: string;
  lineStart: number;
  lineEnd: number;
}

export interface ClassInfo {
  name: string;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  isExported: boolean;
  documentation?: string;
  lineStart: number;
  lineEnd: number;
}

export interface InterfaceInfo {
  name: string;
  properties: PropertyInfo[];
  isExported: boolean;
  documentation?: string;
  lineStart: number;
  lineEnd: number;
}

export interface MethodInfo {
  name: string;
  parameters: string[];
  returnType?: string;
  isAsync: boolean;
  isStatic: boolean;
  visibility: 'public' | 'private' | 'protected';
  documentation?: string;
  lineStart: number;
  lineEnd: number;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  isOptional: boolean;
  isStatic?: boolean;
  visibility?: 'public' | 'private' | 'protected';
  documentation?: string;
  lineNumber: number;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'default';
  isDefault: boolean;
  lineNumber: number;
}

export interface ImportInfo {
  source: string;
  imports: string[];
  isDefault: boolean;
  lineNumber: number;
}

export interface DependencyInfo {
  packageName: string;
  version?: string;
  isDevelopment: boolean;
  isLocal: boolean;
}

export interface DocumentationInfo {
  readme: string | null;
  changelog: string | null;
  license: string | null;
  apiDocs: string[];
  comments: CommentInfo[];
}

export interface CommentInfo {
  type: 'single' | 'multi' | 'jsdoc';
  content: string;
  file: string;
  lineStart: number;
  lineEnd: number;
}

export interface FolderContext {
  folderPath: string;
  name: string;
  files: FileInfo[];
  codeStructures: Map<string, CodeStructure>;
  dependencies: DependencyInfo[];
  documentation: DocumentationInfo;
  projectType:
    | 'node'
    | 'python'
    | 'typescript'
    | 'react'
    | 'vue'
    | 'angular'
    | 'unknown';
  totalFiles: number;
  totalLines: number;
  summary: string;
}

export class FolderAnalyzer {
  private readonly exclusionPatterns: string[] = [
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    'coverage',
    '.nyc_output',
    '__pycache__',
    '*.pyc',
    '.pytest_cache',
    '.DS_Store',
    'Thumbs.db',
    '*.log',
  ];

  private readonly codeExtensions: string[] = [
    '.ts',
    '.js',
    '.tsx',
    '.jsx',
    '.py',
    '.java',
    '.c',
    '.cpp',
    '.cs',
    '.go',
    '.rs',
    '.php',
    '.rb',
    '.swift',
    '.kt',
  ];

  private readonly documentationExtensions: string[] = [
    '.md',
    '.txt',
    '.rst',
    '.adoc',
  ];

  /**
   * Analyze a folder and return comprehensive context information
   */
  async analyzeFolder(
    folderPath: string,
    maxDepth: number = 10
  ): Promise<FolderContext> {
    const context: FolderContext = {
      folderPath,
      name: path.basename(folderPath),
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
      projectType: 'unknown',
      totalFiles: 0,
      totalLines: 0,
      summary: '',
    };

    // Scan files recursively
    await this.scanFiles(folderPath, context, 0, maxDepth);

    // Analyze project type
    context.projectType = this.detectProjectType(context.files);

    // Analyze dependencies
    context.dependencies = await this.analyzeDependencies(folderPath);

    // Analyze code structures
    await this.analyzeCodeStructures(context);

    // Analyze documentation
    await this.analyzeDocumentation(context);

    // Generate summary
    context.summary = this.generateSummary(context);

    return context;
  }

  /**
   * Recursively scan files in the folder
   */
  private async scanFiles(
    folderPath: string,
    context: FolderContext,
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    if (currentDepth > maxDepth) {
      return;
    }

    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relativePath = path.relative(context.folderPath, fullPath);

        // Skip excluded patterns
        if (this.shouldExclude(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanFiles(fullPath, context, currentDepth + 1, maxDepth);
        } else {
          // Process file
          const fileInfo = await this.analyzeFile(fullPath, relativePath);
          context.files.push(fileInfo);
          context.totalFiles++;

          if (fileInfo.content) {
            context.totalLines += fileInfo.content.split('\n').length;
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${folderPath}:`, error);
    }
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(
    filePath: string,
    relativePath: string
  ): Promise<FileInfo> {
    const stats = await fs.stat(filePath);
    const extension = path.extname(filePath);

    const fileInfo: FileInfo = {
      name: path.basename(filePath),
      path: relativePath,
      extension,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      lastModified: stats.mtime,
    };

    // Read content for code and documentation files
    if (this.shouldReadContent(extension) && stats.size < 1024 * 1024) {
      // Max 1MB
      try {
        fileInfo.content = await fs.readFile(filePath, 'utf-8');
        fileInfo.summary = this.generateFileSummary(fileInfo);
      } catch (error) {
        console.warn(`Failed to read file ${filePath}:`, error);
      }
    }

    return fileInfo;
  }

  /**
   * Detect the project type based on files present
   */
  private detectProjectType(
    files: FileInfo[]
  ):
    | 'node'
    | 'python'
    | 'typescript'
    | 'react'
    | 'vue'
    | 'angular'
    | 'unknown' {
    const fileNames = new Set(files.map((f) => f.name));
    const extensions = new Set(files.map((f) => f.extension));

    // Check for specific project markers
    if (fileNames.has('package.json')) {
      if (extensions.has('.tsx') || extensions.has('.jsx')) {
        return 'react';
      }
      if (fileNames.has('angular.json')) {
        return 'angular';
      }
      if (extensions.has('.vue')) {
        return 'vue';
      }
      if (extensions.has('.ts') || fileNames.has('tsconfig.json')) {
        return 'typescript';
      }
      return 'node';
    }

    if (
      fileNames.has('requirements.txt') ||
      fileNames.has('setup.py') ||
      fileNames.has('pyproject.toml')
    ) {
      return 'python';
    }

    return 'unknown';
  }

  /**
   * Analyze dependencies from package.json, requirements.txt, etc.
   */
  private async analyzeDependencies(
    folderPath: string
  ): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    // Node.js dependencies
    const packageJsonPath = path.join(folderPath, 'package.json');
    try {
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf-8')
      );

      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(
          packageJson.dependencies
        )) {
          dependencies.push({
            packageName: name,
            version: version as string,
            isDevelopment: false,
            isLocal: false,
          });
        }
      }

      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(
          packageJson.devDependencies
        )) {
          dependencies.push({
            packageName: name,
            version: version as string,
            isDevelopment: true,
            isLocal: false,
          });
        }
      }
    } catch (error) {
      // package.json not found or invalid
    }

    // Python dependencies
    const requirementsPath = path.join(folderPath, 'requirements.txt');
    try {
      const requirements = await fs.readFile(requirementsPath, 'utf-8');
      const lines = requirements
        .split('\n')
        .filter((line) => line.trim() && !line.startsWith('#'));

      for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9\-_]+)(?:==(.+))?/);
        if (match) {
          dependencies.push({
            packageName: match[1],
            version: match[2],
            isDevelopment: false,
            isLocal: false,
          });
        }
      }
    } catch (error) {
      // requirements.txt not found
    }

    return dependencies;
  }

  /**
   * Analyze code structures in all code files
   */
  private async analyzeCodeStructures(context: FolderContext): Promise<void> {
    const codeFiles = context.files.filter(
      (file) => this.codeExtensions.includes(file.extension) && file.content
    );

    for (const file of codeFiles) {
      try {
        const structure = this.parseCodeStructure(
          file.content!,
          file.extension
        );
        context.codeStructures.set(file.path, structure);
      } catch (error) {
        console.warn(`Failed to parse code structure for ${file.path}:`, error);
      }
    }
  }

  /**
   * Parse code structure from file content
   */
  private parseCodeStructure(
    content: string,
    extension: string
  ): CodeStructure {
    const structure: CodeStructure = {
      functions: [],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [],
    };

    const lines = content.split('\n');

    // JavaScript/TypeScript parsing
    if (['.js', '.ts', '.tsx', '.jsx'].includes(extension)) {
      this.parseJavaScriptStructure(lines, structure);
    }

    // Python parsing
    if (extension === '.py') {
      this.parsePythonStructure(lines, structure);
    }

    return structure;
  }

  /**
   * Parse JavaScript/TypeScript structure
   */
  private parseJavaScriptStructure(
    lines: string[],
    structure: CodeStructure
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Parse imports
      const importMatch = line.match(/^import\s+(.+)\s+from\s+['"`](.+)['"`]/);
      if (importMatch) {
        structure.imports.push({
          source: importMatch[2],
          imports: importMatch[1].split(',').map((s) => s.trim()),
          isDefault: !importMatch[1].includes('{'),
          lineNumber: i + 1,
        });
      }

      // Parse function declarations
      const functionMatch = line.match(
        /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/
      );
      if (functionMatch) {
        structure.functions.push({
          name: functionMatch[1],
          parameters: this.extractParameters(line),
          isAsync: line.includes('async'),
          isExported: line.includes('export'),
          lineStart: i + 1,
          lineEnd: this.findBlockEnd(lines, i),
        });
      }

      // Parse class declarations
      const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        const classEnd = this.findBlockEnd(lines, i);
        structure.classes.push({
          name: classMatch[1],
          methods: this.extractMethods(lines, i, classEnd),
          properties: this.extractProperties(lines, i, classEnd),
          isExported: line.includes('export'),
          lineStart: i + 1,
          lineEnd: classEnd,
        });
      }

      // Parse interface declarations (TypeScript)
      const interfaceMatch = line.match(/^(?:export\s+)?interface\s+(\w+)/);
      if (interfaceMatch) {
        const interfaceEnd = this.findBlockEnd(lines, i);
        structure.interfaces.push({
          name: interfaceMatch[1],
          properties: this.extractInterfaceProperties(lines, i, interfaceEnd),
          isExported: line.includes('export'),
          lineStart: i + 1,
          lineEnd: interfaceEnd,
        });
      }

      // Parse exports
      const exportMatch = line.match(/^export\s+(?:default\s+)?(.+)/);
      if (
        exportMatch &&
        !line.includes('function') &&
        !line.includes('class') &&
        !line.includes('interface')
      ) {
        structure.exports.push({
          name: exportMatch[1].split(/\s+/)[0],
          type: 'variable',
          isDefault: line.includes('default'),
          lineNumber: i + 1,
        });
      }
    }
  }

  /**
   * Parse Python structure (simplified)
   */
  private parsePythonStructure(
    lines: string[],
    structure: CodeStructure
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Parse imports
      const importMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)/);
      if (importMatch) {
        structure.imports.push({
          source: importMatch[1] || '',
          imports: importMatch[2].split(',').map((s) => s.trim()),
          isDefault: false,
          lineNumber: i + 1,
        });
      }

      // Parse function definitions
      const functionMatch = line.match(/^def\s+(\w+)/);
      if (functionMatch) {
        structure.functions.push({
          name: functionMatch[1],
          parameters: this.extractPythonParameters(line),
          isAsync: line.includes('async'),
          isExported: true, // Python functions are generally accessible
          lineStart: i + 1,
          lineEnd: this.findPythonBlockEnd(lines, i),
        });
      }

      // Parse class definitions
      const classMatch = line.match(/^class\s+(\w+)/);
      if (classMatch) {
        const classEnd = this.findPythonBlockEnd(lines, i);
        structure.classes.push({
          name: classMatch[1],
          methods: this.extractPythonMethods(lines, i, classEnd),
          properties: [],
          isExported: true,
          lineStart: i + 1,
          lineEnd: classEnd,
        });
      }
    }
  }

  /**
   * Analyze documentation in the project
   */
  private async analyzeDocumentation(context: FolderContext): Promise<void> {
    for (const file of context.files) {
      if (file.content) {
        // Look for README files
        if (file.name.toLowerCase().includes('readme')) {
          context.documentation.readme = file.content;
        }

        // Look for CHANGELOG files
        if (
          file.name.toLowerCase().includes('changelog') ||
          file.name.toLowerCase().includes('history')
        ) {
          context.documentation.changelog = file.content;
        }

        // Look for LICENSE files
        if (file.name.toLowerCase().includes('license')) {
          context.documentation.license = file.content;
        }

        // Look for API documentation
        if (
          file.path.toLowerCase().includes('doc') &&
          this.documentationExtensions.includes(file.extension)
        ) {
          context.documentation.apiDocs.push(file.content);
        }

        // Extract comments from code files
        if (this.codeExtensions.includes(file.extension)) {
          const comments = this.extractComments(file.content, file.path);
          context.documentation.comments.push(...comments);
        }
      }
    }
  }

  /**
   * Extract comments from code content
   */
  private extractComments(content: string, filePath: string): CommentInfo[] {
    const comments: CommentInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Single line comments
      const singleComment = line.match(/\/\/\s*(.+)/) || line.match(/#\s*(.+)/);
      if (singleComment) {
        comments.push({
          type: 'single',
          content: singleComment[1],
          file: filePath,
          lineStart: i + 1,
          lineEnd: i + 1,
        });
      }

      // Multi-line comments start
      if (line.includes('/*') || line.includes('"""') || line.includes("'''")) {
        const endPattern = line.includes('/*')
          ? '*/'
          : line.includes('"""')
            ? '"""'
            : "'''";
        let endLine = i;
        let commentContent = '';

        for (let j = i; j < lines.length; j++) {
          commentContent += lines[j] + '\n';
          if (lines[j].includes(endPattern) && j > i) {
            endLine = j;
            break;
          }
        }

        const isJSDoc =
          commentContent.includes('/**') ||
          commentContent.includes('@param') ||
          commentContent.includes('@return');

        comments.push({
          type: isJSDoc ? 'jsdoc' : 'multi',
          content: commentContent.trim(),
          file: filePath,
          lineStart: i + 1,
          lineEnd: endLine + 1,
        });

        i = endLine; // Skip processed lines
      }
    }

    return comments;
  }

  /**
   * Generate a summary of the entire folder context
   */
  private generateSummary(context: FolderContext): string {
    const summary: string[] = [];

    summary.push(`Project: ${context.name} (${context.projectType})`);
    summary.push(
      `Files: ${context.totalFiles} (${context.totalLines} lines of code)`
    );

    if (context.dependencies.length > 0) {
      summary.push(`Dependencies: ${context.dependencies.length} packages`);
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
      summary.push(
        `Code: ${totalFunctions} functions, ${totalClasses} classes`
      );
    }

    if (context.documentation.readme) {
      summary.push('Has README documentation');
    }

    return summary.join(' | ');
  }

  /**
   * Generate a summary for a single file
   */
  private generateFileSummary(file: FileInfo): string {
    if (!file.content) {
      return '';
    }

    const lines = file.content.split('\n');
    const nonEmptyLines = lines.filter((line) => line.trim() !== '').length;

    let summary = `${nonEmptyLines} lines`;

    if (this.codeExtensions.includes(file.extension)) {
      const functionCount = (
        file.content.match(/function\s+\w+|def\s+\w+/g) || []
      ).length;
      const classCount = (file.content.match(/class\s+\w+/g) || []).length;

      if (functionCount > 0 || classCount > 0) {
        summary += ` - ${functionCount} functions, ${classCount} classes`;
      }
    }

    return summary;
  }

  // Helper methods
  private shouldExclude(relativePath: string): boolean {
    return this.exclusionPatterns.some((pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(relativePath);
      }
      return relativePath.includes(pattern);
    });
  }

  private shouldReadContent(extension: string): boolean {
    return (
      this.codeExtensions.includes(extension) ||
      this.documentationExtensions.includes(extension)
    );
  }

  private extractParameters(line: string): string[] {
    const match = line.match(/\(([^)]*)\)/);
    if (!match) {
      return [];
    }

    return match[1]
      .split(',')
      .map((param) => param.trim())
      .filter((param) => param !== '');
  }

  private extractPythonParameters(line: string): string[] {
    const match = line.match(/\(([^)]*)\)/);
    if (!match) {
      return [];
    }

    return match[1]
      .split(',')
      .map((param) => param.trim().split(':')[0]) // Remove type annotations
      .filter((param) => param !== '' && param !== 'self');
  }

  private findBlockEnd(lines: string[], start: number): number {
    let braceCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = start; i < lines.length; i++) {
      const line = lines[i];

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (!inString && (char === '"' || char === "'" || char === '`')) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar && line[j - 1] !== '\\') {
          inString = false;
        } else if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
          }
        }
      }

      if (braceCount === 0 && i > start) {
        return i + 1;
      }
    }

    return lines.length;
  }

  private findPythonBlockEnd(lines: string[], start: number): number {
    const startIndent = lines[start].length - lines[start].trimStart().length;

    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        continue;
      }

      const indent = line.length - line.trimStart().length;
      if (indent <= startIndent) {
        return i;
      }
    }

    return lines.length;
  }

  private extractMethods(
    lines: string[],
    start: number,
    end: number
  ): MethodInfo[] {
    const methods: MethodInfo[] = [];

    for (let i = start; i < end; i++) {
      const line = lines[i].trim();
      const methodMatch = line.match(
        /^(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(async)\s+)?(\w+)\s*\(/
      );

      if (methodMatch && !line.includes('function')) {
        methods.push({
          name: methodMatch[4],
          parameters: this.extractParameters(line),
          isAsync: !!methodMatch[3],
          isStatic: !!methodMatch[2],
          visibility: (methodMatch[1] as any) || 'public',
          lineStart: i + 1,
          lineEnd: this.findBlockEnd(lines, i),
        });
      }
    }

    return methods;
  }

  private extractPythonMethods(
    lines: string[],
    start: number,
    end: number
  ): MethodInfo[] {
    const methods: MethodInfo[] = [];

    for (let i = start; i < end; i++) {
      const line = lines[i].trim();
      const methodMatch = line.match(/^def\s+(\w+)/);

      if (methodMatch) {
        methods.push({
          name: methodMatch[1],
          parameters: this.extractPythonParameters(line),
          isAsync: line.includes('async'),
          isStatic: false,
          visibility: methodMatch[1].startsWith('_') ? 'private' : 'public',
          lineStart: i + 1,
          lineEnd: this.findPythonBlockEnd(lines, i),
        });
      }
    }

    return methods;
  }

  private extractProperties(
    lines: string[],
    start: number,
    end: number
  ): PropertyInfo[] {
    const properties: PropertyInfo[] = [];

    for (let i = start; i < end; i++) {
      const line = lines[i].trim();
      const propertyMatch = line.match(
        /^(?:(public|private|protected)\s+)?(?:(static)\s+)?(\w+):\s*([^;=]+)/
      );

      if (propertyMatch) {
        properties.push({
          name: propertyMatch[3],
          type: propertyMatch[4].trim(),
          isOptional: propertyMatch[4].includes('?'),
          isStatic: !!propertyMatch[2],
          visibility: (propertyMatch[1] as any) || 'public',
          lineNumber: i + 1,
        });
      }
    }

    return properties;
  }

  private extractInterfaceProperties(
    lines: string[],
    start: number,
    end: number
  ): PropertyInfo[] {
    const properties: PropertyInfo[] = [];

    for (let i = start; i < end; i++) {
      const line = lines[i].trim();
      const propertyMatch = line.match(/^(\w+)(\?)?\s*:\s*([^;]+)/);

      if (propertyMatch) {
        properties.push({
          name: propertyMatch[1],
          type: propertyMatch[3].trim(),
          isOptional: !!propertyMatch[2],
          lineNumber: i + 1,
        });
      }
    }

    return properties;
  }
}
