import {
  FolderAnalyzer,
  FolderContext,
  FileInfo,
  CodeStructure,
} from './FolderAnalyzer';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs.promises
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FolderAnalyzer', () => {
  let analyzer: FolderAnalyzer;

  beforeEach(() => {
    analyzer = new FolderAnalyzer();
    jest.clearAllMocks();
  });

  test('should create instance', () => {
    expect(analyzer).toBeInstanceOf(FolderAnalyzer);
  });

  describe('analyzeFolder', () => {
    it('should analyze a simple TypeScript project', async () => {
      // Mock file system structure
      mockFs.readdir.mockImplementation((dirPath: any) => {
        if (dirPath === '/test-project') {
          return Promise.resolve([
            { name: 'package.json', isDirectory: () => false },
            { name: 'tsconfig.json', isDirectory: () => false },
            { name: 'src', isDirectory: () => true },
          ] as any);
        }
        if (dirPath === '/test-project/src') {
          return Promise.resolve([
            { name: 'index.ts', isDirectory: () => false },
          ] as any);
        }
        return Promise.resolve([]);
      });

      mockFs.stat.mockResolvedValue({
        size: 100,
        isDirectory: () => false,
        mtime: new Date(),
      } as any);

      mockFs.readFile.mockImplementation((filePath: any) => {
        if (filePath.includes('package.json')) {
          return Promise.resolve(
            JSON.stringify({
              name: 'test-project',
              dependencies: { lodash: '^4.0.0' },
              devDependencies: { typescript: '^4.0.0' },
            })
          );
        }
        if (filePath.includes('index.ts')) {
          return Promise.resolve(
            'export function hello(name: string): string { return `Hello ${name}`; }'
          );
        }
        return Promise.resolve('');
      });

      const result = await analyzer.analyzeFolder('/test-project');

      expect(result.projectType).toBe('typescript');
      expect(result.dependencies).toHaveLength(2);
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.name).toBe('test-project');
    });

    it('should handle Python projects', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'requirements.txt', isDirectory: () => false },
        { name: 'main.py', isDirectory: () => false },
      ] as any);

      mockFs.stat.mockResolvedValue({
        size: 50,
        isDirectory: () => false,
        mtime: new Date(),
      } as any);

      mockFs.readFile.mockImplementation((filePath: any) => {
        if (filePath.includes('requirements.txt')) {
          return Promise.resolve('requests==2.25.1\nnumpy>=1.20.0');
        }
        if (filePath.includes('main.py')) {
          return Promise.resolve('def main():\n    print("Hello World")');
        }
        return Promise.resolve('');
      });

      const result = await analyzer.analyzeFolder('/python-project');

      expect(result.projectType).toBe('python');
      expect(result.dependencies).toHaveLength(2);
      expect(result.dependencies[0].packageName).toBe('requests');
    });
  });

  describe('detectProjectType', () => {
    it('should detect React project', () => {
      const files: FileInfo[] = [
        {
          name: 'package.json',
          path: 'package.json',
          extension: '.json',
          size: 100,
          isDirectory: false,
          lastModified: new Date(),
        },
        {
          name: 'App.tsx',
          path: 'src/App.tsx',
          extension: '.tsx',
          size: 200,
          isDirectory: false,
          lastModified: new Date(),
        },
      ];

      const projectType = (analyzer as any).detectProjectType(files);
      expect(projectType).toBe('react');
    });

    it('should detect Node.js project', () => {
      const files: FileInfo[] = [
        {
          name: 'package.json',
          path: 'package.json',
          extension: '.json',
          size: 100,
          isDirectory: false,
          lastModified: new Date(),
        },
        {
          name: 'index.js',
          path: 'index.js',
          extension: '.js',
          size: 200,
          isDirectory: false,
          lastModified: new Date(),
        },
      ];

      const projectType = (analyzer as any).detectProjectType(files);
      expect(projectType).toBe('node');
    });
  });

  describe('parseCodeStructure', () => {
    it('should parse TypeScript functions and classes', () => {
      const content = `
export class TestClass {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  public getName(): string {
    return this.name;
  }
}

export function testFunction(param: string): boolean {
  return param.length > 0;
}

export interface TestInterface {
  id: number;
  name?: string;
}
`;

      const structure = (analyzer as any).parseCodeStructure(content, '.ts');

      expect(structure.classes).toHaveLength(1);
      expect(structure.classes[0].name).toBe('TestClass');
      expect(structure.classes[0].methods).toHaveLength(2); // constructor + getName
      expect(structure.classes[0].properties).toHaveLength(1);

      expect(structure.functions).toHaveLength(1);
      expect(structure.functions[0].name).toBe('testFunction');
      expect(structure.functions[0].isExported).toBe(true);

      expect(structure.interfaces).toHaveLength(1);
      expect(structure.interfaces[0].name).toBe('TestInterface');
      expect(structure.interfaces[0].properties).toHaveLength(2);
    });

    it('should parse Python functions and classes', () => {
      const content = `
class TestClass:
    def __init__(self, name):
        self.name = name

    def get_name(self):
        return self.name

    def _private_method(self):
        pass

def test_function(param):
    return len(param) > 0

async def async_function():
    return True
`;

      const structure = (analyzer as any).parseCodeStructure(content, '.py');

      expect(structure.classes).toHaveLength(1);
      expect(structure.classes[0].name).toBe('TestClass');
      expect(structure.classes[0].methods).toHaveLength(3);

      // Just check that we have functions parsed
      expect(structure.functions.length).toBeGreaterThan(0);

      // Find the specific functions we care about
      const testFunction = structure.functions.find(
        (f: any) => f.name === 'test_function'
      );
      expect(testFunction).toBeDefined();

      // Check for async function existence
      const hasAsyncFunction = structure.functions.some((f: any) => f.isAsync);
      expect(hasAsyncFunction).toBe(true);
    });
  });

  describe('extractComments', () => {
    it('should extract single line comments', () => {
      const content = `
// This is a single line comment
const value = 42; // Another comment
# Python style comment
`;

      const comments = (analyzer as any).extractComments(content, 'test.ts');

      expect(comments).toHaveLength(3);
      expect(comments[0].type).toBe('single');
      expect(comments[0].content).toBe('This is a single line comment');
    });

    it('should extract multi-line comments', () => {
      const content = `
/*
 * Multi-line comment
 * with multiple lines
 */
const value = 42;

/**
 * JSDoc comment
 * @param param The parameter
 * @returns The result
 */
function test(param) {}
`;

      const comments = (analyzer as any).extractComments(content, 'test.js');

      expect(comments).toHaveLength(2);
      expect(comments[0].type).toBe('multi');
      expect(comments[1].type).toBe('jsdoc');
    });
  });

  describe('helper methods', () => {
    it('should correctly identify excluded files', () => {
      expect((analyzer as any).shouldExclude('node_modules/package')).toBe(
        true
      );
      expect((analyzer as any).shouldExclude('src/index.ts')).toBe(false);
      expect((analyzer as any).shouldExclude('dist/bundle.js')).toBe(true);
      expect((analyzer as any).shouldExclude('test.log')).toBe(true);
    });

    it('should identify readable content files', () => {
      expect((analyzer as any).shouldReadContent('.ts')).toBe(true);
      expect((analyzer as any).shouldReadContent('.md')).toBe(true);
      expect((analyzer as any).shouldReadContent('.png')).toBe(false);
      expect((analyzer as any).shouldReadContent('.py')).toBe(true);
    });

    it('should extract function parameters', () => {
      const params1 = (analyzer as any).extractParameters(
        'function test(a: string, b: number)'
      );
      expect(params1).toEqual(['a: string', 'b: number']);

      const params2 = (analyzer as any).extractParameters('function empty()');
      expect(params2).toEqual([]);
    });
  });
});
