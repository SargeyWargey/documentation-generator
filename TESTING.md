# Testing Documentation - Documentation Generator Extension

This guide provides comprehensive instructions for testing the Documentation Generator VS Code extension.

## Testing Overview

The extension uses a dual testing approach:
- **Unit Tests**: Fast tests using Jest for business logic
- **Integration Tests**: VS Code extension tests using @vscode/test-cli

## Prerequisites

Ensure you have the necessary dependencies installed:
```bash
cd extension/
npm install
```

## Test Types

### 1. Unit Tests (Jest)

Unit tests focus on testing individual services and components in isolation.

**Run Unit Tests:**
```bash
npm run test:unit
```

**Run Unit Tests with Coverage:**
```bash
npm run test:unit -- --coverage
```

**Run Specific Test File:**
```bash
npm run test:unit -- --testPathPattern=FolderAnalyzerService
```

**Watch Mode for Development:**
```bash
npm run test:unit -- --watch
```

#### Unit Test Configuration
- Framework: Jest with TypeScript support
- Configuration: `jest` section in `package.json`
- Test files: `**/__tests__/**/*.ts` or `**/*.test.ts` (excluding extension.test.ts)
- Setup file: `src/test/setup.ts`

### 2. Integration Tests (VS Code Extension Tests)

Integration tests run the extension within the VS Code Extension Development Host.

**Run Integration Tests:**
```bash
npm test
```

**Run Integration Tests with Debug Output:**
```bash
npm test -- --verbose
```

#### Integration Test Configuration
- Framework: @vscode/test-cli with Mocha
- Configuration: `.vscode-test.mjs`
- Test files: `out/test/**/*.test.js` (compiled from TypeScript)
- Main test file: `src/test/extension.test.ts`

## Test Structure

### Current Test Files
```
extension/src/test/
├── setup.ts              # Jest setup configuration
└── extension.test.ts     # VS Code integration tests
```

### Unit Test Locations
Unit tests should be placed alongside the code they test:
```
extension/src/
├── services/
│   ├── FolderAnalyzerService.ts
│   └── __tests__/
│       └── FolderAnalyzerService.test.ts
├── generators/
│   ├── DocumentationGenerator.ts
│   └── __tests__/
│       └── DocumentationGenerator.test.ts
```

## Testing Commands Reference

| Command | Purpose | Framework |
|---------|---------|-----------|
| `npm test` | Run VS Code integration tests | @vscode/test-cli |
| `npm run test:unit` | Run unit tests | Jest |
| `npm run pretest` | Compile and lint before testing | - |
| `npm run compile` | Compile TypeScript | tsc |
| `npm run lint` | Run code quality checks | ESLint |

## Testing Best Practices

### 1. Unit Testing Guidelines

**Service Testing:**
```typescript
// Example: Testing FolderAnalyzerService
describe('FolderAnalyzerService', () => {
  let service: FolderAnalyzerService;

  beforeEach(() => {
    service = new FolderAnalyzerService();
  });

  test('should analyze folder structure', async () => {
    const result = await service.analyzeFolderStructure('/test/path');
    expect(result).toBeDefined();
    expect(result.files).toBeInstanceOf(Array);
  });
});
```

**Mock VS Code APIs:**
```typescript
// Mock vscode module for unit tests
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(),
    workspaceFolders: []
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  }
}));
```

### 2. Integration Testing Guidelines

**Command Testing:**
```typescript
// Example: Testing extension commands
suite('Extension Commands', () => {
  test('should register all commands', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('documentation-generator.generateDocs'));
    assert.ok(commands.includes('documentation-generator.selectTemplate'));
  });

  test('should execute generateDocs command', async () => {
    await vscode.commands.executeCommand('documentation-generator.generateDocs');
    // Assert expected behavior
  });
});
```

## Debugging Tests

### 1. Debug Unit Tests
Add breakpoints in VS Code and run:
```bash
npm run test:unit -- --runInBand
```

### 2. Debug Integration Tests
Use the VS Code launch configuration:

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/out/test"
      ],
      "outFiles": ["${workspaceFolder}/out/test/**/*.js"],
      "preLaunchTask": "${workspaceFolder}/npm: compile"
    }
  ]
}
```

## Manual Testing

### 1. Extension Development Host
1. Press `F5` in VS Code to launch Extension Development Host
2. Open a test project folder
3. Test extension commands and UI elements

### 2. Command Testing Checklist
- [ ] Generate Documentation (`Ctrl+Shift+D`)
- [ ] Select Template (`Ctrl+Shift+T`)
- [ ] Open Settings (`Ctrl+Shift+,`)
- [ ] Sidebar refresh functionality
- [ ] Context menu integration
- [ ] Each documentation type generation

### 3. Integration Testing Checklist
- [ ] Extension activates correctly
- [ ] Commands register properly
- [ ] Views and sidebar appear
- [ ] Configuration settings work
- [ ] Error handling and user feedback
- [ ] File system operations
- [ ] Template processing
- [ ] Claude Code integration

## Test Data and Fixtures

### Sample Project Structure
Create test fixtures for consistent testing:
```
test-fixtures/
├── sample-project/
│   ├── src/
│   │   ├── components/
│   │   └── services/
│   ├── package.json
│   └── README.md
└── templates/
    ├── prd-template.md
    └── tech-spec-template.md
```

### Mock Data
Create mock data for services:
```typescript
// test/mocks/folderAnalysis.mock.ts
export const mockFolderAnalysis = {
  structure: { /* ... */ },
  codePatterns: { /* ... */ },
  dependencies: { /* ... */ }
};
```

## Continuous Integration

### GitHub Actions Setup
```yaml
# .github/workflows/test.yml
name: Test Extension
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run lint
      - run: npm run compile
```

## Troubleshooting

### Common Issues

**Test Discovery Issues:**
- Ensure test files follow naming convention
- Check Jest configuration in `package.json`
- Verify TypeScript compilation

**VS Code Test Issues:**
- Ensure `.vscode-test.mjs` configuration is correct
- Check that tests are compiled to `out/test/`
- Verify VS Code version compatibility

**Import/Module Issues:**
- Check TypeScript path mapping
- Verify mock configurations
- Ensure proper module resolution

### Test Environment Isolation
- Use `beforeEach`/`afterEach` for cleanup
- Mock external dependencies
- Avoid global state mutations
- Use temporary directories for file operations

## Performance Testing

### Load Testing
Test with large project structures:
```typescript
test('should handle large folder structures', async () => {
  const largeFolderPath = './test-fixtures/large-project';
  const startTime = Date.now();

  const result = await folderAnalyzer.analyzeFolderStructure(largeFolderPath);

  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  expect(result.files.length).toBeGreaterThan(100);
});
```

## Coverage Reports

View coverage reports after running unit tests:
```bash
npm run test:unit -- --coverage
open coverage/lcov-report/index.html
```

Coverage goals:
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

---

## Quick Start Testing Workflow

1. **Initial Setup:**
   ```bash
   cd extension/
   npm install
   npm run compile
   ```

2. **Run All Tests:**
   ```bash
   npm run test:unit  # Unit tests
   npm test          # Integration tests
   ```

3. **Development Workflow:**
   ```bash
   npm run watch     # Watch compilation
   npm run test:unit -- --watch  # Watch unit tests
   ```

4. **Pre-commit Checks:**
   ```bash
   npm run lint
   npm run test:unit
   npm run compile
   ```

This testing documentation provides a comprehensive framework for ensuring the reliability and quality of the Documentation Generator extension.