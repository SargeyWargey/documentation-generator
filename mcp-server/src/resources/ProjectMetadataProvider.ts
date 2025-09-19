import { Resource } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { ResourceProvider } from './ResourceManager.js';

export interface ProjectMetadata {
  workspacePath: string;
  projectName: string;
  projectType: string;
  version?: string;
  description?: string;
  author?: string;
  license?: string;
  repository?: {
    type: string;
    url: string;
  };
  dependencies: {
    runtime: string[];
    development: string[];
    peer: string[];
  };
  scripts: Record<string, string>;
  configuration: {
    hasTypeScript: boolean;
    hasLinting: boolean;
    hasFormatting: boolean;
    hasTesting: boolean;
    hasDocumentation: boolean;
    buildTool?: string;
    framework?: string;
    language: string;
  };
  structure: {
    totalDirectories: number;
    totalFiles: number;
    sourceFiles: number;
    testFiles: number;
    documentationFiles: number;
    configFiles: number;
  };
  gitInfo?: {
    branch: string;
    lastCommit: string;
    remoteUrl: string;
    hasUncommittedChanges: boolean;
  };
  lastAnalyzed: Date;
}

export class ProjectMetadataProvider implements ResourceProvider {
  name = 'project-metadata';
  private projectMetadata = new Map<string, ProjectMetadata>();

  async getResources(): Promise<Resource[]> {
    const resources: Resource[] = [];

    for (const [workspacePath, metadata] of this.projectMetadata.entries()) {
      resources.push({
        uri: `project-metadata://${encodeURIComponent(workspacePath)}`,
        name: `${metadata.projectName} Metadata`,
        description: `Project metadata for ${metadata.projectName} (${metadata.projectType})`,
        mimeType: 'application/json',
      });

      // Add project overview resource
      resources.push({
        uri: `project-overview://${encodeURIComponent(workspacePath)}`,
        name: `${metadata.projectName} Overview`,
        description: `High-level overview of ${metadata.projectName}`,
        mimeType: 'application/json',
      });

      // Add dependency analysis resource
      resources.push({
        uri: `project-dependencies://${encodeURIComponent(workspacePath)}`,
        name: `${metadata.projectName} Dependencies`,
        description: `Dependency analysis for ${metadata.projectName}`,
        mimeType: 'application/json',
      });
    }

    return resources;
  }

  async readResource(uri: string): Promise<string> {
    if (uri.startsWith('project-metadata://')) {
      const workspacePath = decodeURIComponent(uri.replace('project-metadata://', ''));
      const metadata = this.projectMetadata.get(workspacePath);

      if (!metadata) {
        throw new Error(`Project metadata not found for workspace: ${workspacePath}`);
      }

      return JSON.stringify(metadata, null, 2);
    }

    if (uri.startsWith('project-overview://')) {
      const workspacePath = decodeURIComponent(uri.replace('project-overview://', ''));
      const metadata = this.projectMetadata.get(workspacePath);

      if (!metadata) {
        throw new Error(`Project metadata not found for workspace: ${workspacePath}`);
      }

      return JSON.stringify(this.generateProjectOverview(metadata), null, 2);
    }

    if (uri.startsWith('project-dependencies://')) {
      const workspacePath = decodeURIComponent(uri.replace('project-dependencies://', ''));
      const metadata = this.projectMetadata.get(workspacePath);

      if (!metadata) {
        throw new Error(`Project metadata not found for workspace: ${workspacePath}`);
      }

      return JSON.stringify(this.generateDependencyAnalysis(metadata), null, 2);
    }

    throw new Error(`Unsupported resource URI: ${uri}`);
  }

  async analyzeWorkspace(workspacePath: string): Promise<ProjectMetadata> {
    try {
      const stats = await fs.stat(workspacePath);
      if (!stats.isDirectory()) {
        throw new Error(`Workspace path is not a directory: ${workspacePath}`);
      }

      const metadata: ProjectMetadata = {
        workspacePath,
        projectName: path.basename(workspacePath),
        projectType: 'unknown',
        dependencies: {
          runtime: [],
          development: [],
          peer: [],
        },
        scripts: {},
        configuration: {
          hasTypeScript: false,
          hasLinting: false,
          hasFormatting: false,
          hasTesting: false,
          hasDocumentation: false,
          language: 'unknown',
        },
        structure: {
          totalDirectories: 0,
          totalFiles: 0,
          sourceFiles: 0,
          testFiles: 0,
          documentationFiles: 0,
          configFiles: 0,
        },
        lastAnalyzed: new Date(),
      };

      // Analyze project files
      await this.analyzeProjectFiles(workspacePath, metadata);
      await this.analyzeProjectStructure(workspacePath, metadata);
      await this.analyzeGitInfo(workspacePath, metadata);

      this.projectMetadata.set(workspacePath, metadata);
      return metadata;
    } catch (error) {
      throw new Error(`Failed to analyze workspace ${workspacePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateProjectMetadata(workspacePath: string, updates: Partial<ProjectMetadata>): Promise<void> {
    const existing = this.projectMetadata.get(workspacePath);
    if (!existing) {
      throw new Error(`No project metadata found for workspace: ${workspacePath}`);
    }

    const updated = { ...existing, ...updates, lastAnalyzed: new Date() };
    this.projectMetadata.set(workspacePath, updated);
  }

  private async analyzeProjectFiles(workspacePath: string, metadata: ProjectMetadata): Promise<void> {
    // Check for package.json (Node.js)
    const packageJsonPath = path.join(workspacePath, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      metadata.projectType = 'Node.js/JavaScript';
      metadata.projectName = packageJson.name || metadata.projectName;
      metadata.version = packageJson.version;
      metadata.description = packageJson.description;
      metadata.author = packageJson.author;
      metadata.license = packageJson.license;
      metadata.repository = packageJson.repository;
      metadata.scripts = packageJson.scripts || {};

      metadata.dependencies.runtime = Object.keys(packageJson.dependencies || {});
      metadata.dependencies.development = Object.keys(packageJson.devDependencies || {});
      metadata.dependencies.peer = Object.keys(packageJson.peerDependencies || {});

      // Detect TypeScript
      metadata.configuration.hasTypeScript =
        metadata.dependencies.development.includes('typescript') ||
        metadata.dependencies.runtime.includes('typescript');

      // Detect testing frameworks
      metadata.configuration.hasTesting =
        metadata.dependencies.development.some(dep =>
          ['jest', 'mocha', 'jasmine', 'vitest', 'cypress', 'playwright'].includes(dep));

      // Detect linting
      metadata.configuration.hasLinting =
        metadata.dependencies.development.some(dep =>
          ['eslint', 'tslint', 'jshint'].includes(dep));

      // Detect formatting
      metadata.configuration.hasFormatting =
        metadata.dependencies.development.some(dep =>
          ['prettier', 'standard'].includes(dep));

      // Detect frameworks
      const frameworks = ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'express', 'fastify'];
      const detectedFramework = [...metadata.dependencies.runtime, ...metadata.dependencies.development]
        .find(dep => frameworks.some(fw => dep.includes(fw)));
      if (detectedFramework) {
        metadata.configuration.framework = detectedFramework;
      }

      metadata.configuration.language = metadata.configuration.hasTypeScript ? 'TypeScript' : 'JavaScript';
    } catch {
      // Not a Node.js project or invalid package.json
    }

    // Check for Python projects
    const pythonFiles = ['pyproject.toml', 'setup.py', 'requirements.txt', 'Pipfile'];
    for (const file of pythonFiles) {
      try {
        await fs.access(path.join(workspacePath, file));
        metadata.projectType = 'Python';
        metadata.configuration.language = 'Python';
        break;
      } catch {
        // File doesn't exist
      }
    }

    // Check for Rust projects
    try {
      const cargoToml = await fs.readFile(path.join(workspacePath, 'Cargo.toml'), 'utf-8');
      metadata.projectType = 'Rust';
      metadata.configuration.language = 'Rust';

      // Parse basic info from Cargo.toml
      const nameMatch = cargoToml.match(/name\s*=\s*"([^"]+)"/);
      const versionMatch = cargoToml.match(/version\s*=\s*"([^"]+)"/);
      const descriptionMatch = cargoToml.match(/description\s*=\s*"([^"]+)"/);

      if (nameMatch) metadata.projectName = nameMatch[1];
      if (versionMatch) metadata.version = versionMatch[1];
      if (descriptionMatch) metadata.description = descriptionMatch[1];
    } catch {
      // Not a Rust project
    }

    // Check for Java projects
    const javaFiles = ['pom.xml', 'build.gradle', 'build.gradle.kts'];
    for (const file of javaFiles) {
      try {
        await fs.access(path.join(workspacePath, file));
        metadata.projectType = 'Java';
        metadata.configuration.language = 'Java';
        metadata.configuration.buildTool = file.includes('gradle') ? 'Gradle' : 'Maven';
        break;
      } catch {
        // File doesn't exist
      }
    }

    // Check for documentation
    const docFiles = ['README.md', 'README.rst', 'docs/', 'documentation/'];
    for (const file of docFiles) {
      try {
        await fs.access(path.join(workspacePath, file));
        metadata.configuration.hasDocumentation = true;
        break;
      } catch {
        // File doesn't exist
      }
    }
  }

  private async analyzeProjectStructure(workspacePath: string, metadata: ProjectMetadata): Promise<void> {
    await this.countFiles(workspacePath, metadata, ['node_modules', '.git', 'dist', 'build']);
  }

  private async countFiles(
    dirPath: string,
    metadata: ProjectMetadata,
    excludePatterns: string[],
    isRoot: boolean = true
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        // Skip excluded directories
        if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
          continue;
        }

        if (entry.isDirectory()) {
          metadata.structure.totalDirectories++;
          await this.countFiles(entryPath, metadata, excludePatterns, false);
        } else if (entry.isFile()) {
          metadata.structure.totalFiles++;

          const ext = path.extname(entry.name).toLowerCase();
          const name = entry.name.toLowerCase();

          // Categorize files
          if (this.isSourceFile(ext)) {
            metadata.structure.sourceFiles++;
          } else if (this.isTestFile(name, ext)) {
            metadata.structure.testFiles++;
          } else if (this.isDocumentationFile(name, ext)) {
            metadata.structure.documentationFiles++;
          } else if (this.isConfigFile(name, ext)) {
            metadata.structure.configFiles++;
          }
        }
      }
    } catch (error) {
      // Continue on error
      console.warn(`Failed to analyze directory ${dirPath}:`, error);
    }
  }

  private async analyzeGitInfo(workspacePath: string, metadata: ProjectMetadata): Promise<void> {
    try {
      // Check if it's a git repository
      await fs.access(path.join(workspacePath, '.git'));

      // This is a simplified git analysis
      // In a real implementation, you'd use a git library like nodegit or simple-git
      metadata.gitInfo = {
        branch: 'main', // Would be detected from .git/HEAD
        lastCommit: 'unknown', // Would be detected from git log
        remoteUrl: 'unknown', // Would be detected from .git/config
        hasUncommittedChanges: false, // Would be detected by checking git status
      };
    } catch {
      // Not a git repository
    }
  }

  private isSourceFile(ext: string): boolean {
    const sourceExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.cpp', '.c',
      '.h', '.rs', '.go', '.kt', '.swift', '.dart', '.php', '.rb', '.vue',
      '.svelte', '.html', '.css', '.scss', '.sass', '.less',
    ];
    return sourceExtensions.includes(ext);
  }

  private isTestFile(name: string, ext: string): boolean {
    const testPatterns = ['test', 'spec', '__tests__', '.test.', '.spec.'];
    return testPatterns.some(pattern => name.includes(pattern)) && this.isSourceFile(ext);
  }

  private isDocumentationFile(name: string, ext: string): boolean {
    const docExtensions = ['.md', '.rst', '.txt'];
    const docPatterns = ['readme', 'changelog', 'license', 'contributing', 'docs'];

    return docExtensions.includes(ext) ||
           docPatterns.some(pattern => name.includes(pattern));
  }

  private isConfigFile(name: string, ext: string): boolean {
    const configExtensions = ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config'];
    const configPatterns = [
      'package.json', 'tsconfig', 'eslint', 'prettier', 'babel',
      'webpack', 'rollup', 'vite', 'jest', 'cypress', 'docker',
      '.env', '.gitignore', '.gitattributes',
    ];

    return configExtensions.includes(ext) ||
           configPatterns.some(pattern => name.includes(pattern));
  }

  private generateProjectOverview(metadata: ProjectMetadata) {
    return {
      summary: {
        name: metadata.projectName,
        type: metadata.projectType,
        language: metadata.configuration.language,
        version: metadata.version,
        description: metadata.description,
      },
      structure: {
        files: metadata.structure.totalFiles,
        directories: metadata.structure.totalDirectories,
        sourceFiles: metadata.structure.sourceFiles,
        testFiles: metadata.structure.testFiles,
        testCoverage: metadata.structure.testFiles > 0 ?
          `${((metadata.structure.testFiles / metadata.structure.sourceFiles) * 100).toFixed(1)}%` : 'No tests',
      },
      technology: {
        framework: metadata.configuration.framework || 'None detected',
        buildTool: metadata.configuration.buildTool || 'None detected',
        hasTypeScript: metadata.configuration.hasTypeScript,
        hasLinting: metadata.configuration.hasLinting,
        hasFormatting: metadata.configuration.hasFormatting,
        hasTesting: metadata.configuration.hasTesting,
      },
      dependencies: {
        total: metadata.dependencies.runtime.length +
               metadata.dependencies.development.length +
               metadata.dependencies.peer.length,
        runtime: metadata.dependencies.runtime.length,
        development: metadata.dependencies.development.length,
        peer: metadata.dependencies.peer.length,
      },
      lastAnalyzed: metadata.lastAnalyzed,
    };
  }

  private generateDependencyAnalysis(metadata: ProjectMetadata) {
    const allDeps = [
      ...metadata.dependencies.runtime,
      ...metadata.dependencies.development,
      ...metadata.dependencies.peer,
    ];

    // Categorize dependencies
    const categories = {
      frameworks: [] as string[],
      testing: [] as string[],
      building: [] as string[],
      linting: [] as string[],
      utilities: [] as string[],
      ui: [] as string[],
      database: [] as string[],
      other: [] as string[],
    };

    const categoryMap = {
      frameworks: ['react', 'vue', 'angular', 'express', 'fastify', 'next', 'nuxt', 'svelte'],
      testing: ['jest', 'mocha', 'jasmine', 'cypress', 'playwright', 'vitest', 'testing-library'],
      building: ['webpack', 'rollup', 'vite', 'parcel', 'esbuild', 'babel', 'typescript'],
      linting: ['eslint', 'prettier', 'tslint', 'stylelint'],
      ui: ['styled-components', 'emotion', 'material-ui', 'antd', 'bootstrap', 'tailwind'],
      database: ['mongoose', 'sequelize', 'typeorm', 'prisma', 'knex'],
      utilities: ['lodash', 'moment', 'date-fns', 'axios', 'fetch'],
    };

    for (const dep of allDeps) {
      let categorized = false;
      for (const [category, patterns] of Object.entries(categoryMap)) {
        if (patterns.some(pattern => dep.includes(pattern))) {
          (categories as any)[category].push(dep);
          categorized = true;
          break;
        }
      }
      if (!categorized) {
        categories.other.push(dep);
      }
    }

    return {
      summary: {
        totalDependencies: allDeps.length,
        runtime: metadata.dependencies.runtime.length,
        development: metadata.dependencies.development.length,
        peer: metadata.dependencies.peer.length,
      },
      categorized: categories,
      runtime: metadata.dependencies.runtime,
      development: metadata.dependencies.development,
      peer: metadata.dependencies.peer,
      analysis: {
        hasFramework: categories.frameworks.length > 0,
        hasTestingFramework: categories.testing.length > 0,
        hasBuildTools: categories.building.length > 0,
        hasLinting: categories.linting.length > 0,
        heavyDependencies: allDeps.length > 50,
        dependencyTypes: Object.entries(categories)
          .filter(([_, deps]) => deps.length > 0)
          .map(([category, deps]) => ({ category, count: deps.length })),
      },
    };
  }
}