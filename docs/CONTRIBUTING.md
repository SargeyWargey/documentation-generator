# Contributing to Documentation Generator

Thank you for your interest in contributing to the Documentation Generator extension! This guide will help you get started with development, testing, and submitting contributions.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Project Architecture](#project-architecture)
4. [Development Workflow](#development-workflow)
5. [Testing](#testing)
6. [Code Style and Standards](#code-style-and-standards)
7. [Submitting Changes](#submitting-changes)
8. [Release Process](#release-process)

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **VS Code** 1.104.0+
- **Claude Code Pro** subscription (for testing)
- **Git** for version control
- **TypeScript** knowledge (extension is written in TypeScript)

### Quick Start

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/your-username/documentation-generator.git
   cd documentation-generator/extension
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Open in VS Code**:
   ```bash
   code .
   ```

4. **Start development**:
   - Press `F5` to launch Extension Development Host
   - Test your changes in the new VS Code window

## Development Setup

### Environment Configuration

1. **TypeScript configuration** (`tsconfig.json`):
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "commonjs",
       "lib": ["ES2020"],
       "outDir": "out",
       "strict": true,
       "esModuleInterop": true
     }
   }
   ```

2. **ESLint setup** (`.eslintrc.js`):
   ```javascript
   module.exports = {
     extends: ['@typescript-eslint/recommended'],
     rules: {
       // Project-specific rules
     }
   };
   ```

3. **VS Code settings** (`.vscode/settings.json`):
   ```json
   {
     "typescript.preferences.includePackageJsonAutoImports": "on",
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode"
   }
   ```

### Development Commands

```bash
# Compile TypeScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Run linting
npm run lint

# Format code
npm run format

# Run unit tests
npm run test:unit

# Run VS Code extension tests
npm run test

# Check formatting
npm run format:check
```

### Debugging

1. **Extension debugging**:
   - Set breakpoints in TypeScript files
   - Press `F5` to launch Extension Development Host
   - Breakpoints will hit when extension runs

2. **MCP Server debugging**:
   ```bash
   # Start MCP server in debug mode
   cd mcp-server
   node --inspect server.js
   ```

3. **Template debugging**:
   - Enable debug mode in extension settings
   - Check Output panel for detailed logs

## Project Architecture

### Directory Structure

```
extension/
├── src/                          # TypeScript source code
│   ├── commands/                 # Slash command generators
│   │   ├── SlashCommandGenerator.ts
│   │   └── CommandTemplateEngine.ts
│   ├── generators/               # Document type generators
│   │   ├── HelpDocumentationGenerator.ts
│   │   ├── PRDGenerator.ts
│   │   ├── TechnicalSpecGenerator.ts
│   │   └── MeetingSummaryGenerator.ts
│   ├── mcp/                      # MCP server implementation
│   │   ├── MCPServer.ts
│   │   ├── ResourceProviders.ts
│   │   └── CommunicationManager.ts
│   ├── providers/                # VS Code providers
│   │   ├── SidebarProvider.ts
│   │   ├── ContextMenuProvider.ts
│   │   └── SettingsProvider.ts
│   ├── templates/                # Template management
│   │   ├── TemplateManager.ts
│   │   ├── TemplateValidator.ts
│   │   └── VariableSubstitution.ts
│   ├── ui/                       # User interface components
│   │   ├── DialogHelper.ts
│   │   ├── ProgressManager.ts
│   │   └── StatusBar.ts
│   ├── utils/                    # Utility services
│   │   ├── FolderAnalyzer.ts
│   │   ├── ConfigurationService.ts
│   │   ├── ErrorHandler.ts
│   │   └── LoggingService.ts
│   ├── test/                     # Test files
│   └── extension.ts              # Main extension entry point
├── templates/                    # Default templates
├── mcp-server/                   # MCP server implementation
├── docs/                         # Documentation
└── package.json                  # Extension manifest
```

### Core Components

#### 1. Extension Entry Point (`extension.ts`)
- Activates/deactivates extension
- Registers commands and providers
- Initializes services

#### 2. Document Generators (`generators/`)
- Specialized generators for each document type
- Implement common `DocumentGenerator` interface
- Handle template processing and Claude integration

#### 3. Template System (`templates/`)
- `TemplateManager`: Discovers and loads templates
- `TemplateValidator`: Validates template syntax
- `VariableSubstitution`: Handles variable replacement

#### 4. Claude Integration (`commands/`, `mcp/`)
- `SlashCommandGenerator`: Creates dynamic slash commands
- `MCPServer`: Provides MCP protocol implementation
- Handles communication with Claude Code Pro

#### 5. VS Code Integration (`providers/`)
- `SidebarProvider`: Sidebar panel tree view
- `ContextMenuProvider`: Right-click menu items
- `SettingsProvider`: Extension configuration

### Key Interfaces

```typescript
// Core document generator interface
interface DocumentGenerator {
  generate(context: GenerationContext): Promise<GenerationResult>;
  getTemplateRequirements(): TemplateRequirements;
  validate(config: GeneratorConfig): ValidationResult;
}

// Template management
interface Template {
  name: string;
  description: string;
  variables: TemplateVariable[];
  content: string;
  metadata: TemplateMetadata;
}

// Folder analysis
interface AnalysisResult {
  structure: FolderStructure;
  codeAnalysis: CodeAnalysis;
  dependencies: Dependency[];
  metadata: ProjectMetadata;
}
```

### Service Architecture

```typescript
// Dependency injection pattern
class ExtensionContainer {
  private services = new Map<string, any>();

  register<T>(name: string, service: T): void;
  get<T>(name: string): T;
}

// Services are registered at startup
container.register('templateManager', new TemplateManager());
container.register('folderAnalyzer', new FolderAnalyzer());
container.register('claudeIntegrator', new ClaudeIntegrator());
```

## Development Workflow

### Feature Development Process

1. **Create feature branch**:
   ```bash
   git checkout -b feature/new-template-system
   ```

2. **Write tests first** (TDD approach):
   ```typescript
   describe('TemplateManager', () => {
     it('should load custom templates', () => {
       // Test implementation
     });
   });
   ```

3. **Implement feature**:
   - Follow existing code patterns
   - Add proper error handling
   - Include logging for debugging

4. **Test thoroughly**:
   ```bash
   npm run test:unit        # Unit tests
   npm run test            # VS Code extension tests
   npm run lint            # Code quality
   ```

5. **Update documentation**:
   - Update relevant guides
   - Add inline code comments
   - Update CHANGELOG.md

### Adding New Document Generators

1. **Create generator class**:
   ```typescript
   export class CustomDocumentationGenerator implements DocumentGenerator {
     async generate(context: GenerationContext): Promise<GenerationResult> {
       // Implementation
     }
   }
   ```

2. **Register in extension**:
   ```typescript
   // In extension.ts
   const customGenerator = new CustomDocumentationGenerator();
   context.subscriptions.push(
     vscode.commands.registerCommand('documentation-generator.generateCustom',
       () => customGenerator.generate(context))
   );
   ```

3. **Add to package.json**:
   ```json
   {
     "commands": [
       {
         "command": "documentation-generator.generateCustom",
         "title": "📝 Custom Documentation"
       }
     ]
   }
   ```

### Adding New Templates

1. **Create template file** in `templates/`:
   ```yaml
   ---
   name: "New Template"
   description: "Description of new template"
   ---

   # Template content
   ```

2. **Test template**:
   - Use template with various project structures
   - Verify variable substitution works
   - Check output quality

3. **Add template tests**:
   ```typescript
   describe('New Template', () => {
     it('should generate valid documentation', () => {
       // Test template processing
     });
   });
   ```

### Modifying Core Services

1. **Update interface** if needed:
   ```typescript
   interface TemplateManager {
     loadTemplates(): Promise<Template[]>;
     validateTemplate(template: Template): ValidationResult;
     // New method
     refreshTemplates(): Promise<void>;
   }
   ```

2. **Implement changes**:
   - Maintain backward compatibility
   - Add proper error handling
   - Update dependent code

3. **Update tests**:
   - Test new functionality
   - Verify existing tests still pass
   - Add integration tests if needed

## Testing

### Test Structure

```
src/
├── test/
│   ├── unit/                    # Unit tests
│   │   ├── templates/
│   │   ├── generators/
│   │   └── utils/
│   ├── integration/             # Integration tests
│   │   ├── extension-activation.test.ts
│   │   └── claude-integration.test.ts
│   ├── fixtures/                # Test data
│   │   ├── sample-projects/
│   │   └── test-templates/
│   └── extension.test.ts        # VS Code extension tests
```

### Unit Testing

Use Jest for unit tests:

```typescript
import { TemplateManager } from '../templates/TemplateManager';

describe('TemplateManager', () => {
  let templateManager: TemplateManager;

  beforeEach(() => {
    templateManager = new TemplateManager();
  });

  it('should load templates from directory', async () => {
    const templates = await templateManager.loadTemplates('./test-templates');
    expect(templates).toHaveLength(3);
    expect(templates[0].name).toBe('Test Template');
  });

  it('should validate template syntax', () => {
    const template = { /* test template */ };
    const result = templateManager.validateTemplate(template);
    expect(result.isValid).toBe(true);
  });
});
```

### Integration Testing

Test VS Code integration:

```typescript
import * as vscode from 'vscode';
import { activate } from '../extension';

suite('Extension Integration Tests', () => {
  test('should activate successfully', async () => {
    const context = {} as vscode.ExtensionContext;
    await activate(context);

    // Verify commands are registered
    const commands = await vscode.commands.getCommands();
    expect(commands).toContain('documentation-generator.generateDocs');
  });
});
```

### Manual Testing Checklist

Before submitting PR:

- [ ] Extension loads without errors
- [ ] All document types generate successfully
- [ ] Context menu appears on folder right-click
- [ ] Settings changes take effect
- [ ] Templates load correctly
- [ ] Error handling works appropriately
- [ ] Performance is acceptable on large projects

## Code Style and Standards

### TypeScript Style

```typescript
// Use explicit types
function generateDocumentation(folder: string): Promise<string> {
  return Promise.resolve('');
}

// Use interfaces for object shapes
interface GenerationConfig {
  templateName: string;
  outputPath: string;
  variables: Record<string, any>;
}

// Use enums for constants
enum DocumentType {
  HELP = 'help',
  PRD = 'prd',
  TECHNICAL = 'technical',
  MEETING = 'meeting'
}

// Use async/await instead of promises
async function processTemplate(template: Template): Promise<string> {
  try {
    const result = await templateEngine.process(template);
    return result;
  } catch (error) {
    logger.error('Template processing failed', error);
    throw error;
  }
}
```

### Error Handling

```typescript
// Use specific error types
class TemplateValidationError extends Error {
  constructor(message: string, public template: Template) {
    super(message);
    this.name = 'TemplateValidationError';
  }
}

// Handle errors gracefully
async function safeOperation(): Promise<Result | null> {
  try {
    return await riskyOperation();
  } catch (error) {
    if (error instanceof TemplateValidationError) {
      vscode.window.showErrorMessage(`Template error: ${error.message}`);
    } else {
      logger.error('Unexpected error', error);
      vscode.window.showErrorMessage('An unexpected error occurred');
    }
    return null;
  }
}
```

### Logging

```typescript
import { LoggingService } from './utils/LoggingService';

class MyClass {
  private logger = LoggingService.getLogger('MyClass');

  async doSomething(): Promise<void> {
    this.logger.info('Starting operation');
    try {
      // Operation
      this.logger.debug('Operation details', { data: 'value' });
      this.logger.info('Operation completed successfully');
    } catch (error) {
      this.logger.error('Operation failed', error);
      throw error;
    }
  }
}
```

### Documentation

```typescript
/**
 * Generates documentation for a given folder using the specified template.
 *
 * @param folderPath - Absolute path to the folder to analyze
 * @param templateName - Name of the template to use
 * @param options - Additional generation options
 * @returns Promise resolving to the generated documentation content
 *
 * @throws {TemplateNotFoundError} When the specified template doesn't exist
 * @throws {FolderAnalysisError} When folder analysis fails
 *
 * @example
 * ```typescript
 * const docs = await generateDocumentation('/path/to/project', 'api-docs', {
 *   includePrivate: false
 * });
 * ```
 */
async function generateDocumentation(
  folderPath: string,
  templateName: string,
  options: GenerationOptions = {}
): Promise<string> {
  // Implementation
}
```

## Submitting Changes

### Pull Request Process

1. **Create focused PRs**:
   - One feature/fix per PR
   - Keep changes small and reviewable
   - Include tests for new functionality

2. **PR Template**:
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Unit tests pass
   - [ ] Manual testing completed
   - [ ] Integration tests pass

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No new linting errors
   ```

3. **Review criteria**:
   - Code quality and style
   - Test coverage
   - Documentation updates
   - Performance impact
   - Security considerations

### Commit Message Format

```
type(scope): description

Longer description if needed

Fixes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(templates): add custom variable validation
fix(generator): handle empty folder analysis
docs(readme): update installation instructions
```

### Code Review Guidelines

**For reviewers**:
- Be constructive and specific
- Focus on code quality, not style preferences
- Test changes locally when possible
- Approve if changes are good enough, not perfect

**For authors**:
- Respond to all feedback
- Make requested changes or explain why not
- Keep discussions focused on code
- Push updates to same branch

## Release Process

### Version Management

Follow semantic versioning (semver):
- **Major** (x.0.0): Breaking changes
- **Minor** (0.x.0): New features, backward compatible
- **Patch** (0.0.x): Bug fixes, backward compatible

### Release Checklist

1. **Pre-release**:
   - [ ] All tests pass
   - [ ] Documentation updated
   - [ ] CHANGELOG.md updated
   - [ ] Version bumped in package.json

2. **Release**:
   - [ ] Tag release in Git
   - [ ] Package extension (vsce package)
   - [ ] Publish to marketplace
   - [ ] Create GitHub release

3. **Post-release**:
   - [ ] Announce in discussions
   - [ ] Update documentation links
   - [ ] Monitor for issues

### Publishing Commands

```bash
# Install VSCE
npm install -g vsce

# Package extension
vsce package

# Publish to marketplace
vsce publish

# Publish specific version
vsce publish patch
vsce publish minor
vsce publish major
```

---

**Questions?** Open a discussion on GitHub or reach out to the maintainers. We're here to help you contribute successfully!