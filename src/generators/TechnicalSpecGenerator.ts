import { FolderContext } from '../utils/FolderAnalyzer';
import { TemplateManager } from '../templates/TemplateManager';
import { ClaudeIntegrator } from '../commands/ClaudeIntegrator';

export interface TechnicalSpecOptions {
  includeArchitecture: boolean;
  includeAPISpec: boolean;
  includeDatabaseSchema: boolean;
  includeConfiguration: boolean;
  includeDeployment: boolean;
  includeTestingStrategy: boolean;
  includeIntegrationMap: boolean;
  technicalLevel: 'basic' | 'intermediate' | 'advanced';
  outputFormat: 'markdown' | 'confluence' | 'docx';
  templateName?: string;
}

export interface ArchitectureAnalysis {
  systemOverview: string;
  components: Array<{
    name: string;
    type: 'service' | 'library' | 'database' | 'ui' | 'api' | 'middleware';
    description: string;
    responsibilities: string[];
    interfaces: string[];
    dependencies: string[];
    files: string[];
    complexity: 'low' | 'medium' | 'high';
  }>;
  dataFlow: Array<{
    source: string;
    destination: string;
    dataType: string;
    protocol: string;
    description: string;
  }>;
  patterns: Array<{
    name: string;
    description: string;
    implementation: string[];
    benefits: string[];
    tradeoffs: string[];
  }>;
  scalingConsiderations: string[];
}

export interface APISpecification {
  endpoints: Array<{
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    description: string;
    parameters: Array<{
      name: string;
      type: string;
      location: 'query' | 'path' | 'body' | 'header';
      required: boolean;
      description: string;
      example?: any;
    }>;
    responses: Array<{
      statusCode: number;
      description: string;
      schema?: string;
      example?: any;
    }>;
    authentication: string[];
    rateLimit?: string;
    files: string[];
  }>;
  schemas: Array<{
    name: string;
    type: 'request' | 'response' | 'model';
    description: string;
    properties: Array<{
      name: string;
      type: string;
      required: boolean;
      description: string;
      validation?: string[];
    }>;
    example: any;
  }>;
  authentication: Array<{
    type: 'bearer' | 'basic' | 'apikey' | 'oauth2';
    description: string;
    implementation: string;
  }>;
}

export interface DatabaseSchema {
  databases: Array<{
    name: string;
    type: 'relational' | 'nosql' | 'cache' | 'search';
    description: string;
    tables: Array<{
      name: string;
      description: string;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primaryKey: boolean;
        foreignKey?: string;
        description: string;
        constraints: string[];
      }>;
      indexes: Array<{
        name: string;
        columns: string[];
        unique: boolean;
        type: string;
      }>;
      relationships: Array<{
        type: 'one-to-one' | 'one-to-many' | 'many-to-many';
        target: string;
        description: string;
      }>;
    }>;
  }>;
  migrations: Array<{
    version: string;
    description: string;
    operations: string[];
    rollback: string[];
  }>;
  seedData: Array<{
    table: string;
    description: string;
    purpose: string;
  }>;
}

export interface ConfigurationDocumentation {
  environments: Array<{
    name: string;
    description: string;
    variables: Array<{
      name: string;
      type: string;
      required: boolean;
      defaultValue?: string;
      description: string;
      example: string;
      sensitive: boolean;
    }>;
  }>;
  configFiles: Array<{
    path: string;
    format: 'json' | 'yaml' | 'ini' | 'env';
    description: string;
    sections: Array<{
      name: string;
      description: string;
      options: string[];
    }>;
  }>;
  secrets: Array<{
    name: string;
    description: string;
    storage: string;
    rotation: string;
  }>;
}

export interface DeploymentDocumentation {
  environments: Array<{
    name: string;
    description: string;
    infrastructure: string[];
    requirements: string[];
    scaling: string;
  }>;
  deploymentSteps: Array<{
    phase: string;
    description: string;
    steps: string[];
    rollback: string[];
    validation: string[];
  }>;
  monitoring: Array<{
    metric: string;
    description: string;
    threshold: string;
    action: string;
  }>;
  troubleshooting: Array<{
    issue: string;
    symptoms: string[];
    diagnosis: string[];
    resolution: string[];
  }>;
}

export interface TestingStrategy {
  levels: Array<{
    name: string;
    description: string;
    scope: string;
    tools: string[];
    coverage: string;
    examples: string[];
  }>;
  frameworks: Array<{
    name: string;
    purpose: string;
    configuration: string;
    examples: string[];
  }>;
  testData: Array<{
    type: string;
    description: string;
    generation: string;
    cleanup: string;
  }>;
  automation: Array<{
    trigger: string;
    description: string;
    pipeline: string[];
    reporting: string;
  }>;
}

export interface IntegrationMapping {
  externalServices: Array<{
    name: string;
    type: 'rest' | 'graphql' | 'soap' | 'grpc' | 'websocket' | 'message-queue';
    description: string;
    endpoint: string;
    authentication: string;
    dataFormat: string;
    errorHandling: string[];
    retryPolicy: string;
    monitoring: string[];
  }>;
  internalServices: Array<{
    name: string;
    description: string;
    interface: string;
    protocol: string;
    dependencies: string[];
    consumers: string[];
  }>;
  dataflow: Array<{
    source: string;
    destination: string;
    data: string;
    frequency: string;
    transformation: string;
  }>;
  protocols: Array<{
    name: string;
    usage: string;
    configuration: string;
    security: string[];
  }>;
}

export class TechnicalSpecGenerator {
  private templateManager: TemplateManager;
  private claudeIntegrator: ClaudeIntegrator;

  constructor(
    templateManager: TemplateManager,
    claudeIntegrator: ClaudeIntegrator
  ) {
    this.templateManager = templateManager;
    this.claudeIntegrator = claudeIntegrator;
  }

  async generateTechnicalSpecification(
    _folderPath: string,
    analysisResult: FolderContext,
    options: TechnicalSpecOptions
  ): Promise<string> {
    const sections: string[] = [];

    // Generate system overview
    const overview = await this.generateSystemOverview(analysisResult, options);
    sections.push(overview);

    if (options.includeArchitecture) {
      const architecture = await this.analyzeArchitecture(analysisResult);
      sections.push(this.formatArchitectureAnalysis(architecture));
    }

    if (options.includeAPISpec) {
      const apiSpec = await this.generateAPISpecification(analysisResult);
      sections.push(this.formatAPISpecification(apiSpec));
    }

    if (options.includeDatabaseSchema) {
      const dbSchema = await this.generateDatabaseSchema(analysisResult);
      sections.push(this.formatDatabaseSchema(dbSchema));
    }

    if (options.includeConfiguration) {
      const config = await this.generateConfigurationDocs(analysisResult);
      sections.push(this.formatConfigurationDocs(config));
    }

    if (options.includeDeployment) {
      const deployment = await this.generateDeploymentDocs(analysisResult);
      sections.push(this.formatDeploymentDocs(deployment));
    }

    if (options.includeTestingStrategy) {
      const testing = await this.generateTestingStrategy(analysisResult);
      sections.push(this.formatTestingStrategy(testing));
    }

    if (options.includeIntegrationMap) {
      const integration = await this.generateIntegrationMapping(analysisResult);
      sections.push(this.formatIntegrationMapping(integration));
    }

    const templateName = options.templateName || 'technical-template';
    const template = await this.templateManager.loadTemplate(templateName);

    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    // Map analysis data to template variables
    const templateVariables = {
      systemName: analysisResult.name || 'System',
      architectureType: this.detectArchitectureType(analysisResult),
      technologies: this.extractTechnologies(analysisResult),
      apiEndpoints: options.includeAPISpec
        ? await this.generateAPIDocumentation(analysisResult)
        : [],
      databaseTables: options.includeDatabaseSchema
        ? await this.analyzeDatabaseTables(analysisResult)
        : [],
      deploymentStrategy: options.includeDeployment
        ? await this.analyzeDeploymentStrategy(analysisResult)
        : 'Standard deployment',
      testingApproach: options.includeTestingStrategy
        ? await this.analyzeTestingApproach(analysisResult)
        : 'Unit and integration testing',
      securityRequirements:
        await this.analyzeSecurityRequirements(analysisResult),
      analysis: {
        projectName: analysisResult.name,
        fileCount: analysisResult.files.length,
        dependencies: analysisResult.dependencies,
      },
    };

    return await this.templateManager.processTemplateContent(
      template.content,
      templateVariables
    );
  }

  async analyzeArchitecture(
    analysisResult: FolderContext
  ): Promise<ArchitectureAnalysis> {
    const components = await this.identifyComponents(analysisResult);
    const dataFlow = await this.analyzeDataFlow(analysisResult);
    const patterns = await this.identifyArchitecturalPatterns(analysisResult);

    return {
      systemOverview: await this.generateSystemOverview(analysisResult, {
        technicalLevel: 'intermediate',
      } as TechnicalSpecOptions),
      components,
      dataFlow,
      patterns,
      scalingConsiderations:
        await this.analyzeScalingConsiderations(analysisResult),
    };
  }

  private async identifyComponents(
    analysisResult: FolderContext
  ): Promise<ArchitectureAnalysis['components']> {
    const components: ArchitectureAnalysis['components'] = [];
    const componentGroups = this.groupFilesByComponent(analysisResult.files);

    for (const [componentName, files] of componentGroups) {
      const component = {
        name: componentName,
        type: this.inferComponentType(componentName, files),
        description: await this.generateComponentDescription(
          componentName,
          files
        ),
        responsibilities: this.extractComponentResponsibilities(files),
        interfaces: this.extractComponentInterfaces(files),
        dependencies: this.extractComponentDependencies(files),
        files: files.map((f) => f.path),
        complexity: this.assessComponentComplexity(files),
      };

      components.push(component);
    }

    return components;
  }

  private groupFilesByComponent(files: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const file of files) {
      const component = this.extractComponentFromPath(file.path);
      if (!groups.has(component)) {
        groups.set(component, []);
      }
      groups.get(component)!.push(file);
    }

    return groups;
  }

  private extractComponentFromPath(filePath: string): string {
    const pathParts = filePath.split('/');

    // Look for component indicators
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (
        part.includes('service') ||
        part.includes('controller') ||
        part.includes('model') ||
        part.includes('component') ||
        part.includes('util') ||
        part.includes('lib')
      ) {
        return part;
      }
    }

    // Use directory structure
    if (pathParts.length > 2) {
      return pathParts[pathParts.length - 2];
    }

    return 'core';
  }

  private inferComponentType(
    name: string,
    files: any[]
  ): ArchitectureAnalysis['components'][number]['type'] {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('service')) {
      return 'service';
    }
    if (lowerName.includes('controller') || lowerName.includes('handler')) {
      return 'api';
    }
    if (lowerName.includes('model') || lowerName.includes('entity')) {
      return 'database';
    }
    if (lowerName.includes('component') || lowerName.includes('ui')) {
      return 'ui';
    }
    if (lowerName.includes('middleware')) {
      return 'middleware';
    }
    if (lowerName.includes('util') || lowerName.includes('helper')) {
      return 'library';
    }

    // Infer from file extensions
    const hasReactComponents = files.some(
      (f) => f.path.includes('.jsx') || f.path.includes('.tsx')
    );
    if (hasReactComponents) {
      return 'ui';
    }

    const hasAPIFiles = files.some(
      (f) => f.content?.includes('app.') || f.content?.includes('router')
    );
    if (hasAPIFiles) {
      return 'api';
    }

    return 'library';
  }

  private async generateComponentDescription(
    name: string,
    files: any[]
  ): Promise<string> {
    const fileCount = files.length;
    const componentType = this.inferComponentType(name, files);

    return `${name} component serves as a ${componentType} module with ${fileCount} implementation files, handling core functionality for the system.`;
  }

  private extractComponentResponsibilities(files: any[]): string[] {
    const responsibilities: string[] = [];

    // Extract from comments and function names
    for (const file of files) {
      if (file.content) {
        const comments = this.extractComments(file.content);
        const functions = this.extractFunctions(file.content);

        // Add responsibilities based on function names
        for (const func of functions) {
          if (func.includes('create') || func.includes('insert')) {
            responsibilities.push('Data creation and insertion');
          }
          if (func.includes('update') || func.includes('modify')) {
            responsibilities.push('Data modification and updates');
          }
          if (func.includes('delete') || func.includes('remove')) {
            responsibilities.push('Data deletion and cleanup');
          }
          if (
            func.includes('get') ||
            func.includes('fetch') ||
            func.includes('read')
          ) {
            responsibilities.push('Data retrieval and access');
          }
          if (func.includes('validate') || func.includes('check')) {
            responsibilities.push('Validation and verification');
          }
        }
      }
    }

    return [...new Set(responsibilities)]; // Remove duplicates
  }

  private extractComponentInterfaces(files: any[]): string[] {
    const interfaces: string[] = [];

    for (const file of files) {
      const exports = file.exports || [];
      interfaces.push(...exports);
    }

    return [...new Set(interfaces)];
  }

  private extractComponentDependencies(files: any[]): string[] {
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

  private assessComponentComplexity(files: any[]): 'low' | 'medium' | 'high' {
    const totalLines = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const fileCount = files.length;

    if (totalLines > 5000 || fileCount > 15) {
      return 'high';
    }
    if (totalLines > 1500 || fileCount > 8) {
      return 'medium';
    }
    return 'low';
  }

  private async analyzeDataFlow(
    analysisResult: FolderContext
  ): Promise<ArchitectureAnalysis['dataFlow']> {
    const dataFlows: ArchitectureAnalysis['dataFlow'] = [];

    // Analyze API endpoints and data flow
    const apiFiles = analysisResult.files.filter(
      (f) =>
        f.path.includes('route') ||
        f.path.includes('controller') ||
        f.path.includes('handler')
    );

    for (const apiFile of apiFiles) {
      if (apiFile.content) {
        const flows = this.extractDataFlowFromAPI(apiFile);
        dataFlows.push(...flows);
      }
    }

    return dataFlows;
  }

  private extractDataFlowFromAPI(file: any): ArchitectureAnalysis['dataFlow'] {
    const flows: ArchitectureAnalysis['dataFlow'] = [];

    // Extract HTTP routes and their data flow
    const routeMatches =
      file.content.match(
        /\.(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/g
      ) || [];

    for (const match of routeMatches) {
      const methodMatch = match.match(/\.(get|post|put|delete|patch)/);
      const pathMatch = match.match(/['"`]([^'"`]+)['"`]/);

      if (methodMatch && pathMatch) {
        flows.push({
          source: 'Client',
          destination: 'API Server',
          dataType: this.inferDataType(methodMatch[1]),
          protocol: 'HTTP',
          description: `${methodMatch[1].toUpperCase()} request to ${pathMatch[1]}`,
        });
      }
    }

    return flows;
  }

  private inferDataType(method: string): string {
    switch (method.toLowerCase()) {
      case 'get':
        return 'Query parameters, Response data';
      case 'post':
        return 'Request body, Response data';
      case 'put':
        return 'Request body, Updated data';
      case 'delete':
        return 'Resource identifier';
      case 'patch':
        return 'Partial update data';
      default:
        return 'Data';
    }
  }

  private async identifyArchitecturalPatterns(
    analysisResult: FolderContext
  ): Promise<ArchitectureAnalysis['patterns']> {
    const patterns: ArchitectureAnalysis['patterns'] = [];

    // Identify common patterns
    if (this.hasPattern(analysisResult, 'mvc')) {
      patterns.push({
        name: 'Model-View-Controller (MVC)',
        description:
          'Separation of concerns between data, presentation, and control logic',
        implementation: [
          'Models for data layer',
          'Views for presentation',
          'Controllers for business logic',
        ],
        benefits: [
          'Clear separation of concerns',
          'Maintainable code structure',
          'Testability',
        ],
        tradeoffs: [
          'Increased complexity for simple applications',
          'Potential over-engineering',
        ],
      });
    }

    if (this.hasPattern(analysisResult, 'repository')) {
      patterns.push({
        name: 'Repository Pattern',
        description: 'Abstraction layer for data access operations',
        implementation: [
          'Repository interfaces',
          'Concrete repository implementations',
          'Domain models',
        ],
        benefits: [
          'Testable data access',
          'Flexible data sources',
          'Clean architecture',
        ],
        tradeoffs: [
          'Additional abstraction layer',
          'Potential over-abstraction',
        ],
      });
    }

    return patterns;
  }

  private hasPattern(analysisResult: FolderContext, pattern: string): boolean {
    const paths = analysisResult.files.map((f) => f.path.toLowerCase());

    switch (pattern) {
      case 'mvc':
        return (
          paths.some((p) => p.includes('model')) &&
          paths.some((p) => p.includes('view')) &&
          paths.some((p) => p.includes('controller'))
        );
      case 'repository':
        return paths.some((p) => p.includes('repository'));
      default:
        return false;
    }
  }

  private async analyzeScalingConsiderations(
    analysisResult: FolderContext
  ): Promise<string[]> {
    const considerations: string[] = [];

    // Analyze for scaling patterns
    const hasDatabase = analysisResult.files.some(
      (f) =>
        f.path.includes('database') ||
        f.path.includes('db') ||
        f.content?.includes('query')
    );

    if (hasDatabase) {
      considerations.push('Database connection pooling and query optimization');
      considerations.push('Database sharding and replication strategies');
    }

    const hasCaching = analysisResult.files.some(
      (f) => f.content?.includes('cache') || f.content?.includes('redis')
    );

    if (hasCaching) {
      considerations.push('Cache invalidation and consistency strategies');
    }

    const hasAPI = analysisResult.files.some(
      (f) => f.path.includes('api') || f.path.includes('route')
    );

    if (hasAPI) {
      considerations.push('API rate limiting and load balancing');
      considerations.push('Horizontal scaling with load balancers');
    }

    return considerations;
  }

  async generateAPISpecification(
    analysisResult: FolderContext
  ): Promise<APISpecification> {
    const endpoints = await this.extractAPIEndpoints(analysisResult);
    const schemas = await this.extractAPISchemas(analysisResult);
    const authentication =
      await this.extractAuthenticationMethods(analysisResult);

    return {
      endpoints,
      schemas,
      authentication,
    };
  }

  private async extractAPIEndpoints(
    analysisResult: FolderContext
  ): Promise<APISpecification['endpoints']> {
    const endpoints: APISpecification['endpoints'] = [];

    const apiFiles = analysisResult.files.filter(
      (f) =>
        f.path.includes('route') ||
        f.path.includes('controller') ||
        f.path.includes('handler') ||
        f.path.includes('api')
    );

    for (const file of apiFiles) {
      if (file.content) {
        const fileEndpoints = this.parseEndpointsFromFile(file);
        endpoints.push(...fileEndpoints);
      }
    }

    return endpoints;
  }

  private parseEndpointsFromFile(file: any): APISpecification['endpoints'] {
    const endpoints: APISpecification['endpoints'] = [];

    // Parse Express.js style routes
    const routePattern =
      /\.(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/g;
    let match;

    while ((match = routePattern.exec(file.content)) !== null) {
      const method = match[1].toUpperCase() as
        | 'GET'
        | 'POST'
        | 'PUT'
        | 'DELETE'
        | 'PATCH';
      const path = match[2];

      const endpoint = {
        path,
        method,
        description: `${method} ${path}`,
        parameters: this.extractParametersFromPath(path),
        responses: this.generateDefaultResponses(method),
        authentication: this.inferAuthentication(file.content),
        files: [file.path],
      };

      endpoints.push(endpoint);
    }

    return endpoints;
  }

  private extractParametersFromPath(
    path: string
  ): APISpecification['endpoints'][number]['parameters'] {
    const parameters: APISpecification['endpoints'][number]['parameters'] = [];

    // Extract path parameters
    const pathParams = path.match(/:(\w+)/g) || [];
    for (const param of pathParams) {
      parameters.push({
        name: param.slice(1), // Remove ':'
        type: 'string',
        location: 'path',
        required: true,
        description: `${param.slice(1)} identifier`,
      });
    }

    return parameters;
  }

  private generateDefaultResponses(
    method: string
  ): APISpecification['endpoints'][number]['responses'] {
    const responses: APISpecification['endpoints'][number]['responses'] = [
      {
        statusCode: 200,
        description: 'Success',
        schema: 'SuccessResponse',
      },
    ];

    if (method === 'POST') {
      responses.push({
        statusCode: 201,
        description: 'Created',
        schema: 'CreatedResponse',
      });
    }

    responses.push(
      {
        statusCode: 400,
        description: 'Bad Request',
        schema: 'ErrorResponse',
      },
      {
        statusCode: 500,
        description: 'Internal Server Error',
        schema: 'ErrorResponse',
      }
    );

    return responses;
  }

  private inferAuthentication(content: string): string[] {
    const auth: string[] = [];

    if (content.includes('jwt') || content.includes('token')) {
      auth.push('Bearer Token');
    }
    if (content.includes('basicAuth') || content.includes('basic')) {
      auth.push('Basic Auth');
    }
    if (content.includes('apikey') || content.includes('api-key')) {
      auth.push('API Key');
    }

    return auth.length > 0 ? auth : ['None'];
  }

  private async extractAPISchemas(
    analysisResult: FolderContext
  ): Promise<APISpecification['schemas']> {
    const schemas: APISpecification['schemas'] = [];

    // Look for model files or schema definitions
    const modelFiles = analysisResult.files.filter(
      (f) =>
        f.path.includes('model') ||
        f.path.includes('schema') ||
        f.path.includes('type')
    );

    for (const file of modelFiles) {
      if (file.content) {
        const fileSchemas = this.parseSchemaFromFile(file);
        schemas.push(...fileSchemas);
      }
    }

    return schemas;
  }

  private parseSchemaFromFile(file: any): APISpecification['schemas'] {
    const schemas: APISpecification['schemas'] = [];

    // Parse TypeScript interfaces or class definitions
    const interfacePattern = /interface\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = interfacePattern.exec(file.content)) !== null) {
      const name = match[1];
      const body = match[2];

      const schema: APISpecification['schemas'][number] = {
        name,
        type: 'model',
        description: `${name} data model`,
        properties: this.parsePropertiesFromInterface(body),
        example: {},
      };

      schemas.push(schema);
    }

    return schemas;
  }

  private parsePropertiesFromInterface(
    body: string
  ): APISpecification['schemas'][number]['properties'] {
    const properties: APISpecification['schemas'][number]['properties'] = [];
    const lines = body.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//')) {
        const propMatch = trimmed.match(/(\w+)(\?)?:\s*([^;]+)/);
        if (propMatch) {
          properties.push({
            name: propMatch[1],
            type: propMatch[3].trim(),
            required: !propMatch[2], // No '?' means required
            description: `${propMatch[1]} field`,
          });
        }
      }
    }

    return properties;
  }

  private async extractAuthenticationMethods(
    analysisResult: FolderContext
  ): Promise<APISpecification['authentication']> {
    const authMethods: APISpecification['authentication'] = [];

    const authFiles = analysisResult.files.filter(
      (f) =>
        f.path.includes('auth') ||
        f.path.includes('security') ||
        f.path.includes('middleware')
    );

    for (const file of authFiles) {
      if (file.content) {
        if (file.content.includes('jwt')) {
          authMethods.push({
            type: 'bearer',
            description: 'JWT Bearer Token Authentication',
            implementation: 'JWT tokens with configurable expiration',
          });
        }

        if (
          file.content.includes('basic') ||
          file.content.includes('basicAuth')
        ) {
          authMethods.push({
            type: 'basic',
            description: 'HTTP Basic Authentication',
            implementation: 'Username and password encoded in Base64',
          });
        }
      }
    }

    return authMethods.length > 0
      ? authMethods
      : [
          {
            type: 'bearer',
            description: 'Default authentication required',
            implementation: 'Authentication method not specified in code',
          },
        ];
  }

  async generateDatabaseSchema(
    analysisResult: FolderContext
  ): Promise<DatabaseSchema> {
    const databases = await this.identifyDatabases(analysisResult);
    const migrations = await this.extractMigrations(analysisResult);
    const seedData = await this.extractSeedData(analysisResult);

    return {
      databases,
      migrations,
      seedData,
    };
  }

  private async identifyDatabases(
    analysisResult: FolderContext
  ): Promise<DatabaseSchema['databases']> {
    const databases: DatabaseSchema['databases'] = [];

    // Look for database configuration and models
    const dbFiles = analysisResult.files.filter(
      (f) =>
        f.path.includes('database') ||
        f.path.includes('db') ||
        f.path.includes('model') ||
        f.path.includes('schema')
    );

    if (dbFiles.length > 0) {
      const database = {
        name: 'main',
        type: this.inferDatabaseType(dbFiles),
        description: 'Primary application database',
        tables: await this.extractTables(dbFiles),
      };

      databases.push(database);
    }

    return databases;
  }

  private inferDatabaseType(
    files: any[]
  ): DatabaseSchema['databases'][number]['type'] {
    const content = files
      .map((f) => f.content || '')
      .join(' ')
      .toLowerCase();

    if (content.includes('mongodb') || content.includes('mongoose')) {
      return 'nosql';
    }
    if (content.includes('redis')) {
      return 'cache';
    }
    if (content.includes('elasticsearch')) {
      return 'search';
    }
    return 'relational'; // Default
  }

  private async extractTables(
    files: any[]
  ): Promise<DatabaseSchema['databases'][number]['tables']> {
    const tables: DatabaseSchema['databases'][number]['tables'] = [];

    for (const file of files) {
      if (file.content) {
        const fileTables = this.parseTablesFromFile(file);
        tables.push(...fileTables);
      }
    }

    return tables;
  }

  private parseTablesFromFile(
    file: any
  ): DatabaseSchema['databases'][number]['tables'] {
    const tables: DatabaseSchema['databases'][number]['tables'] = [];

    // Parse Sequelize models or similar
    const modelPattern = /(?:class|const)\s+(\w+).*?(?:Model|Schema)/gi;
    let match;

    while ((match = modelPattern.exec(file.content)) !== null) {
      const tableName = match[1];

      const table: DatabaseSchema['databases'][number]['tables'][number] = {
        name: tableName,
        description: `${tableName} table`,
        columns: this.extractColumnsFromModel(file.content, tableName),
        indexes: [],
        relationships: [],
      };

      tables.push(table);
    }

    return tables;
  }

  private extractColumnsFromModel(
    content: string,
    _modelName: string
  ): DatabaseSchema['databases'][number]['tables'][number]['columns'] {
    const columns: DatabaseSchema['databases'][number]['tables'][number]['columns'] =
      [];

    // Extract field definitions (simplified)
    const fieldPattern = /(\w+):\s*{([^}]+)}/g;
    let match;

    while ((match = fieldPattern.exec(content)) !== null) {
      const fieldName = match[1];
      const fieldDef = match[2];

      const column = {
        name: fieldName,
        type: this.extractTypeFromField(fieldDef),
        nullable: !fieldDef.includes('allowNull: false'),
        primaryKey: fieldDef.includes('primaryKey: true'),
        description: `${fieldName} column`,
        constraints: [],
        foreignKey: fieldDef.includes('references')
          ? 'Referenced table'
          : undefined,
      };

      columns.push(column);
    }

    return columns;
  }

  private extractTypeFromField(fieldDef: string): string {
    if (fieldDef.includes('DataTypes.STRING')) {
      return 'VARCHAR';
    }
    if (fieldDef.includes('DataTypes.INTEGER')) {
      return 'INTEGER';
    }
    if (fieldDef.includes('DataTypes.BOOLEAN')) {
      return 'BOOLEAN';
    }
    if (fieldDef.includes('DataTypes.DATE')) {
      return 'TIMESTAMP';
    }
    return 'VARCHAR'; // Default
  }

  private async extractMigrations(
    analysisResult: FolderContext
  ): Promise<DatabaseSchema['migrations']> {
    const migrations: DatabaseSchema['migrations'] = [];

    const migrationFiles = analysisResult.files.filter(
      (f) => f.path.includes('migration') || f.path.includes('migrate')
    );

    for (const file of migrationFiles) {
      migrations.push({
        version: this.extractVersionFromMigration(file.path),
        description: `Migration from ${file.path}`,
        operations: ['Schema changes defined in migration file'],
        rollback: ['Reverse operations for rollback'],
      });
    }

    return migrations;
  }

  private extractVersionFromMigration(path: string): string {
    const match = path.match(/(\d{8,14})/); // Date-based version
    return match ? match[1] : 'unknown';
  }

  private async extractSeedData(
    analysisResult: FolderContext
  ): Promise<DatabaseSchema['seedData']> {
    const seedData: DatabaseSchema['seedData'] = [];

    const seedFiles = analysisResult.files.filter(
      (f) => f.path.includes('seed') || f.path.includes('fixture')
    );

    for (const file of seedFiles) {
      seedData.push({
        table: this.extractTableFromSeedFile(file.path),
        description: `Seed data from ${file.path}`,
        purpose: 'Initial data for application setup',
      });
    }

    return seedData;
  }

  private extractTableFromSeedFile(path: string): string {
    const fileName = path.split('/').pop() || '';
    return fileName.replace(/seed|\.js|\.ts|\.sql/gi, '').trim() || 'unknown';
  }

  async generateConfigurationDocs(
    analysisResult: FolderContext
  ): Promise<ConfigurationDocumentation> {
    const environments = await this.extractEnvironments(analysisResult);
    const configFiles = await this.extractConfigFiles(analysisResult);
    const secrets = await this.extractSecrets(analysisResult);

    return {
      environments,
      configFiles,
      secrets,
    };
  }

  private async extractEnvironments(
    analysisResult: FolderContext
  ): Promise<ConfigurationDocumentation['environments']> {
    const environments: ConfigurationDocumentation['environments'] = [];

    const envFiles = analysisResult.files.filter(
      (f) => f.path.includes('.env') || f.path.includes('config')
    );

    // Default environments
    const defaultEnvs = ['development', 'staging', 'production'];

    for (const env of defaultEnvs) {
      environments.push({
        name: env,
        description: `${env.charAt(0).toUpperCase() + env.slice(1)} environment configuration`,
        variables: await this.extractEnvironmentVariables(envFiles, env),
      });
    }

    return environments;
  }

  private async extractEnvironmentVariables(
    files: any[],
    env: string
  ): Promise<ConfigurationDocumentation['environments'][number]['variables']> {
    const variables: ConfigurationDocumentation['environments'][number]['variables'] =
      [];

    for (const file of files) {
      if (file.content) {
        const envVars = this.parseEnvironmentVariables(file.content);
        variables.push(...envVars);
      }
    }

    // Add common variables if none found
    if (variables.length === 0) {
      variables.push(
        {
          name: 'NODE_ENV',
          type: 'string',
          required: true,
          defaultValue: env,
          description: 'Node.js environment setting',
          example: env,
          sensitive: false,
        },
        {
          name: 'PORT',
          type: 'number',
          required: false,
          defaultValue: '3000',
          description: 'Application port number',
          example: '3000',
          sensitive: false,
        }
      );
    }

    return variables;
  }

  private parseEnvironmentVariables(
    content: string
  ): ConfigurationDocumentation['environments'][number]['variables'] {
    const variables: ConfigurationDocumentation['environments'][number]['variables'] =
      [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [name, value] = trimmed.split('=', 2);

        variables.push({
          name: name.trim(),
          type: this.inferVariableType(value),
          required: true,
          description: `Configuration for ${name.trim()}`,
          example: value?.trim() || 'value',
          sensitive: this.isSensitiveVariable(name.trim()),
        });
      }
    }

    return variables;
  }

  private inferVariableType(value: string): string {
    if (!value) {
      return 'string';
    }

    const trimmed = value.trim();
    if (trimmed === 'true' || trimmed === 'false') {
      return 'boolean';
    }
    if (/^\d+$/.test(trimmed)) {
      return 'number';
    }
    return 'string';
  }

  private isSensitiveVariable(name: string): boolean {
    const sensitiveKeywords = ['password', 'secret', 'key', 'token', 'api_key'];
    return sensitiveKeywords.some((keyword) =>
      name.toLowerCase().includes(keyword)
    );
  }

  private async extractConfigFiles(
    analysisResult: FolderContext
  ): Promise<ConfigurationDocumentation['configFiles']> {
    const configFiles: ConfigurationDocumentation['configFiles'] = [];

    const configs = analysisResult.files.filter(
      (f) =>
        f.path.includes('config') ||
        f.path.endsWith('.json') ||
        f.path.endsWith('.yaml') ||
        f.path.endsWith('.yml')
    );

    for (const file of configs) {
      configFiles.push({
        path: file.path,
        format: this.inferConfigFormat(file.path),
        description: `Configuration file: ${file.path}`,
        sections: this.extractConfigSections(file.content || ''),
      });
    }

    return configFiles;
  }

  private inferConfigFormat(
    path: string
  ): ConfigurationDocumentation['configFiles'][number]['format'] {
    if (path.endsWith('.json')) {
      return 'json';
    }
    if (path.endsWith('.yaml') || path.endsWith('.yml')) {
      return 'yaml';
    }
    if (path.endsWith('.ini')) {
      return 'ini';
    }
    if (path.endsWith('.env')) {
      return 'env';
    }
    return 'json'; // Default
  }

  private extractConfigSections(
    content: string
  ): ConfigurationDocumentation['configFiles'][number]['sections'] {
    const sections: ConfigurationDocumentation['configFiles'][number]['sections'] =
      [];

    try {
      const config = JSON.parse(content);
      for (const [key, value] of Object.entries(config)) {
        sections.push({
          name: key,
          description: `Configuration section for ${key}`,
          options:
            typeof value === 'object'
              ? Object.keys(value as object)
              : [String(value)],
        });
      }
    } catch {
      // If not valid JSON, create generic section
      sections.push({
        name: 'configuration',
        description: 'Configuration options',
        options: ['See file for details'],
      });
    }

    return sections;
  }

  private async extractSecrets(
    analysisResult: FolderContext
  ): Promise<ConfigurationDocumentation['secrets']> {
    const secrets: ConfigurationDocumentation['secrets'] = [];

    // Look for secret management patterns
    const hasSecretManager = analysisResult.files.some(
      (f) =>
        f.content?.includes('secrets') ||
        f.content?.includes('vault') ||
        f.content?.includes('keychain')
    );

    if (hasSecretManager) {
      secrets.push({
        name: 'Application Secrets',
        description: 'Sensitive configuration data',
        storage: 'Secret management system',
        rotation: 'Manual or automated rotation',
      });
    }

    return secrets;
  }

  async generateDeploymentDocs(
    analysisResult: FolderContext
  ): Promise<DeploymentDocumentation> {
    const environments =
      await this.extractDeploymentEnvironments(analysisResult);
    const deploymentSteps = await this.generateDeploymentSteps(analysisResult);
    const monitoring = await this.generateMonitoringSpecs(analysisResult);
    const troubleshooting =
      await this.generateDeploymentTroubleshooting(analysisResult);

    return {
      environments,
      deploymentSteps,
      monitoring,
      troubleshooting,
    };
  }

  private async extractDeploymentEnvironments(
    _analysisResult: FolderContext
  ): Promise<DeploymentDocumentation['environments']> {
    const environments: DeploymentDocumentation['environments'] = [
      {
        name: 'Development',
        description: 'Local development environment',
        infrastructure: ['Local machine', 'Development database'],
        requirements: ['Node.js', 'Package manager'],
        scaling: 'Single instance',
      },
      {
        name: 'Staging',
        description: 'Pre-production testing environment',
        infrastructure: ['Cloud server', 'Staging database'],
        requirements: ['CI/CD pipeline', 'Environment variables'],
        scaling: 'Limited scaling for testing',
      },
      {
        name: 'Production',
        description: 'Live production environment',
        infrastructure: [
          'Load balancer',
          'Multiple app servers',
          'Production database',
        ],
        requirements: ['High availability', 'Monitoring', 'Backup systems'],
        scaling: 'Auto-scaling enabled',
      },
    ];

    return environments;
  }

  private async generateDeploymentSteps(
    analysisResult: FolderContext
  ): Promise<DeploymentDocumentation['deploymentSteps']> {
    const hasDockerfile = analysisResult.files.some((f) =>
      f.path.includes('Dockerfile')
    );

    const steps: DeploymentDocumentation['deploymentSteps'] = [
      {
        phase: 'Pre-deployment',
        description: 'Preparation and validation steps',
        steps: [
          'Run tests and quality checks',
          'Build application artifacts',
          'Validate configuration',
        ],
        rollback: ['Revert to previous version'],
        validation: ['Check build artifacts', 'Verify configuration'],
      },
      {
        phase: 'Deployment',
        description: 'Application deployment process',
        steps: hasDockerfile
          ? ['Build Docker image', 'Deploy container', 'Update load balancer']
          : ['Deploy code', 'Install dependencies', 'Restart application'],
        rollback: ['Stop new version', 'Restore previous version'],
        validation: ['Health check endpoints', 'Smoke tests'],
      },
      {
        phase: 'Post-deployment',
        description: 'Verification and monitoring setup',
        steps: [
          'Verify application health',
          'Check monitoring dashboards',
          'Update documentation',
        ],
        rollback: ['Full system rollback if needed'],
        validation: ['End-to-end tests', 'Performance validation'],
      },
    ];

    return steps;
  }

  private async generateMonitoringSpecs(
    _analysisResult: FolderContext
  ): Promise<DeploymentDocumentation['monitoring']> {
    return [
      {
        metric: 'Response Time',
        description: 'Average API response time',
        threshold: '< 500ms',
        action: 'Alert if threshold exceeded',
      },
      {
        metric: 'Error Rate',
        description: 'Percentage of failed requests',
        threshold: '< 1%',
        action: 'Alert and investigate errors',
      },
      {
        metric: 'CPU Usage',
        description: 'Server CPU utilization',
        threshold: '< 80%',
        action: 'Scale horizontally if sustained',
      },
      {
        metric: 'Memory Usage',
        description: 'Application memory consumption',
        threshold: '< 90%',
        action: 'Investigate memory leaks',
      },
    ];
  }

  private async generateDeploymentTroubleshooting(
    _analysisResult: FolderContext
  ): Promise<DeploymentDocumentation['troubleshooting']> {
    return [
      {
        issue: 'Application Fails to Start',
        symptoms: ['Service unavailable', 'Process exits immediately'],
        diagnosis: [
          'Check application logs',
          'Verify configuration',
          'Check dependencies',
        ],
        resolution: [
          'Fix configuration errors',
          'Install missing dependencies',
          'Update environment variables',
        ],
      },
      {
        issue: 'Database Connection Errors',
        symptoms: ['Connection timeouts', 'Authentication failures'],
        diagnosis: [
          'Check database connectivity',
          'Verify credentials',
          'Check network configuration',
        ],
        resolution: [
          'Update connection strings',
          'Fix network rules',
          'Restart database service',
        ],
      },
      {
        issue: 'Performance Degradation',
        symptoms: ['Slow response times', 'High resource usage'],
        diagnosis: [
          'Check system metrics',
          'Analyze database queries',
          'Review application logs',
        ],
        resolution: [
          'Scale resources',
          'Optimize queries',
          'Implement caching',
        ],
      },
    ];
  }

  async generateTestingStrategy(
    analysisResult: FolderContext
  ): Promise<TestingStrategy> {
    const levels = await this.identifyTestingLevels(analysisResult);
    const frameworks = await this.identifyTestingFrameworks(analysisResult);
    const testData = await this.analyzeTestData(analysisResult);
    const automation = await this.analyzeTestAutomation(analysisResult);

    return {
      levels,
      frameworks,
      testData,
      automation,
    };
  }

  private async identifyTestingLevels(
    analysisResult: FolderContext
  ): Promise<TestingStrategy['levels']> {
    const testFiles = analysisResult.files.filter(
      (f) => f.path.includes('test') || f.path.includes('spec')
    );

    const levels: TestingStrategy['levels'] = [
      {
        name: 'Unit Tests',
        description: 'Individual component testing',
        scope: 'Individual functions and classes',
        tools: this.extractTestingTools(testFiles),
        coverage: 'Function-level coverage',
        examples: this.findTestExamples(testFiles, 'unit'),
      },
      {
        name: 'Integration Tests',
        description: 'Component interaction testing',
        scope: 'Module and service integration',
        tools: this.extractTestingTools(testFiles),
        coverage: 'Module-level coverage',
        examples: this.findTestExamples(testFiles, 'integration'),
      },
      {
        name: 'End-to-End Tests',
        description: 'Full application workflow testing',
        scope: 'Complete user journeys',
        tools: this.extractE2ETools(testFiles),
        coverage: 'Application-level coverage',
        examples: this.findTestExamples(testFiles, 'e2e'),
      },
    ];

    return levels;
  }

  private extractTestingTools(testFiles: any[]): string[] {
    const tools = new Set<string>();

    for (const file of testFiles) {
      if (file.content) {
        if (file.content.includes('jest')) {
          tools.add('Jest');
        }
        if (file.content.includes('mocha')) {
          tools.add('Mocha');
        }
        if (file.content.includes('chai')) {
          tools.add('Chai');
        }
        if (file.content.includes('jasmine')) {
          tools.add('Jasmine');
        }
        if (file.content.includes('vitest')) {
          tools.add('Vitest');
        }
      }
    }

    return tools.size > 0 ? Array.from(tools) : ['Jest']; // Default to Jest
  }

  private extractE2ETools(testFiles: any[]): string[] {
    const tools = new Set<string>();

    for (const file of testFiles) {
      if (file.content) {
        if (file.content.includes('cypress')) {
          tools.add('Cypress');
        }
        if (file.content.includes('playwright')) {
          tools.add('Playwright');
        }
        if (file.content.includes('selenium')) {
          tools.add('Selenium');
        }
        if (file.content.includes('puppeteer')) {
          tools.add('Puppeteer');
        }
      }
    }

    return tools.size > 0 ? Array.from(tools) : ['Cypress']; // Default to Cypress
  }

  private findTestExamples(testFiles: any[], type: string): string[] {
    const examples: string[] = [];

    for (const file of testFiles) {
      if (file.path.toLowerCase().includes(type) && file.content) {
        const testExample = this.extractFirstTest(file.content);
        if (testExample) {
          examples.push(testExample);
        }
      }
    }

    return examples.slice(0, 2); // Limit to 2 examples
  }

  private extractFirstTest(content: string): string {
    const testMatch = content.match(/(?:it|test)\s*\(['"`]([^'"`]+)['"`]/);
    return testMatch ? testMatch[1] : '';
  }

  private async identifyTestingFrameworks(
    analysisResult: FolderContext
  ): Promise<TestingStrategy['frameworks']> {
    const packageJson = analysisResult.files.find((f) =>
      f.path.endsWith('package.json')
    );
    const frameworks: TestingStrategy['frameworks'] = [];

    if (packageJson?.content) {
      try {
        const pkg = JSON.parse(packageJson.content);
        const devDeps = pkg.devDependencies || {};

        if (devDeps.jest) {
          frameworks.push({
            name: 'Jest',
            purpose: 'Unit and integration testing',
            configuration: 'jest.config.js or package.json',
            examples: ['Unit tests', 'Mocking', 'Coverage reports'],
          });
        }

        if (devDeps.cypress) {
          frameworks.push({
            name: 'Cypress',
            purpose: 'End-to-end testing',
            configuration: 'cypress.config.js',
            examples: ['E2E workflows', 'UI testing', 'API testing'],
          });
        }
      } catch {
        // Ignore JSON parsing errors
      }
    }

    return frameworks;
  }

  private async analyzeTestData(
    _analysisResult: FolderContext
  ): Promise<TestingStrategy['testData']> {
    const testDataTypes: TestingStrategy['testData'] = [
      {
        type: 'Mock Data',
        description: 'Simulated data for unit tests',
        generation: 'Factory functions or static fixtures',
        cleanup: 'Automatic cleanup after each test',
      },
      {
        type: 'Test Database',
        description: 'Isolated database for integration tests',
        generation: 'Database seeding scripts',
        cleanup: 'Transaction rollback or database reset',
      },
      {
        type: 'API Fixtures',
        description: 'Predefined API responses',
        generation: 'JSON fixtures or mock servers',
        cleanup: 'Reset mock state between tests',
      },
    ];

    return testDataTypes;
  }

  private async analyzeTestAutomation(
    _analysisResult: FolderContext
  ): Promise<TestingStrategy['automation']> {
    const automation: TestingStrategy['automation'] = [
      {
        trigger: 'Pull Request',
        description: 'Run tests on code changes',
        pipeline: ['Lint code', 'Run unit tests', 'Generate coverage report'],
        reporting: 'GitHub/GitLab status checks',
      },
      {
        trigger: 'Merge to Main',
        description: 'Full test suite execution',
        pipeline: [
          'Run all tests',
          'Integration tests',
          'E2E tests',
          'Deploy to staging',
        ],
        reporting: 'Test results and deployment status',
      },
      {
        trigger: 'Nightly Build',
        description: 'Comprehensive testing and quality checks',
        pipeline: ['Performance tests', 'Security scans', 'Dependency audits'],
        reporting: 'Daily quality report',
      },
    ];

    return automation;
  }

  async generateIntegrationMapping(
    analysisResult: FolderContext
  ): Promise<IntegrationMapping> {
    const externalServices =
      await this.identifyExternalServices(analysisResult);
    const internalServices =
      await this.identifyInternalServices(analysisResult);
    const dataflow = await this.mapDataFlow(analysisResult);
    const protocols = await this.identifyProtocols(analysisResult);

    return {
      externalServices,
      internalServices,
      dataflow,
      protocols,
    };
  }

  private async identifyExternalServices(
    analysisResult: FolderContext
  ): Promise<IntegrationMapping['externalServices']> {
    const services: IntegrationMapping['externalServices'] = [];

    // Analyze package.json for external service dependencies
    const packageJson = analysisResult.files.find((f) =>
      f.path.endsWith('package.json')
    );

    if (packageJson?.content) {
      try {
        const pkg = JSON.parse(packageJson.content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        // Identify common external services
        if (deps.axios || deps.fetch) {
          services.push({
            name: 'HTTP APIs',
            type: 'rest',
            description: 'External REST API services',
            endpoint: 'Various external endpoints',
            authentication: 'API keys or OAuth',
            dataFormat: 'JSON',
            errorHandling: ['Retry logic', 'Circuit breaker'],
            retryPolicy: 'Exponential backoff',
            monitoring: ['Response time', 'Error rate'],
          });
        }

        if (deps.stripe) {
          services.push({
            name: 'Stripe Payment API',
            type: 'rest',
            description: 'Payment processing service',
            endpoint: 'https://api.stripe.com',
            authentication: 'API key',
            dataFormat: 'JSON',
            errorHandling: ['Error code mapping', 'Webhook verification'],
            retryPolicy: 'Idempotent retries',
            monitoring: ['Payment success rate', 'Webhook delivery'],
          });
        }
      } catch {
        // Ignore JSON parsing errors
      }
    }

    return services;
  }

  private async identifyInternalServices(
    analysisResult: FolderContext
  ): Promise<IntegrationMapping['internalServices']> {
    const services: IntegrationMapping['internalServices'] = [];

    // Look for service definitions
    const serviceFiles = analysisResult.files.filter(
      (f) => f.path.includes('service') || f.path.includes('api')
    );

    for (const file of serviceFiles) {
      const serviceName = this.extractServiceName(file.path);

      services.push({
        name: serviceName,
        description: `Internal ${serviceName} service`,
        interface: 'Function calls or HTTP API',
        protocol: 'HTTP/HTTPS',
        dependencies: this.extractServiceDependencies(file),
        consumers: ['Other internal services'],
      });
    }

    return services;
  }

  private extractServiceName(path: string): string {
    const fileName = path.split('/').pop() || '';
    return fileName
      .replace(/\.(js|ts|service|api)$/gi, '')
      .replace(/[-_]/g, ' ');
  }

  private extractServiceDependencies(file: any): string[] {
    const imports = file.imports || [];
    return imports.filter((imp: string) => !imp.startsWith('.'));
  }

  private async mapDataFlow(
    _analysisResult: FolderContext
  ): Promise<IntegrationMapping['dataflow']> {
    const dataflows: IntegrationMapping['dataflow'] = [
      {
        source: 'Client Application',
        destination: 'API Server',
        data: 'User requests and form data',
        frequency: 'Real-time',
        transformation: 'Request validation and sanitization',
      },
      {
        source: 'API Server',
        destination: 'Database',
        data: 'Processed business data',
        frequency: 'Per request',
        transformation: 'ORM mapping and query optimization',
      },
      {
        source: 'Database',
        destination: 'API Server',
        data: 'Query results',
        frequency: 'Per request',
        transformation: 'Data serialization and formatting',
      },
    ];

    return dataflows;
  }

  private async identifyProtocols(
    _analysisResult: FolderContext
  ): Promise<IntegrationMapping['protocols']> {
    const protocols: IntegrationMapping['protocols'] = [
      {
        name: 'HTTP/HTTPS',
        usage: 'Primary API communication',
        configuration: 'Express.js server configuration',
        security: ['TLS encryption', 'CORS headers', 'Rate limiting'],
      },
      {
        name: 'WebSocket',
        usage: 'Real-time communication (if applicable)',
        configuration: 'Socket.io or native WebSocket',
        security: ['Origin validation', 'Authentication tokens'],
      },
    ];

    return protocols;
  }

  // Helper methods
  private extractComments(content: string): string[] {
    const comments: string[] = [];

    // Single line comments
    const singleLineComments = content.match(/\/\/.*$/gm) || [];
    comments.push(...singleLineComments);

    // Multi-line comments
    const multiLineComments = content.match(/\/\*[\s\S]*?\*\//g) || [];
    comments.push(...multiLineComments);

    return comments;
  }

  private extractFunctions(content: string): string[] {
    const functions: string[] = [];

    // Function declarations
    const functionDeclarations = content.match(/function\s+(\w+)/g) || [];
    functions.push(
      ...functionDeclarations.map((f) => f.replace('function ', ''))
    );

    // Arrow functions and method definitions
    const arrowFunctions =
      content.match(/(\w+)\s*[=:]\s*(?:async\s+)?\(/g) || [];
    functions.push(...arrowFunctions.map((f) => f.split(/[=:]/)[0].trim()));

    return functions;
  }

  private async generateSystemOverview(
    analysisResult: FolderContext,
    options: TechnicalSpecOptions
  ): Promise<string> {
    return `## System Overview

**Project:** ${analysisResult.name || 'Application'}

**Architecture Style:** ${this.inferArchitectureStyle(analysisResult)}

**Primary Language:** ${this.inferPrimaryLanguage(analysisResult)}

**Framework:** ${this.inferFramework(analysisResult)}

**Description:** This system consists of ${analysisResult.files.length} files organized into multiple components and services. The architecture follows modern software engineering practices with clear separation of concerns.

**Key Components:**
- Application layer with business logic
- Data access layer for persistence
- API layer for external communication
- UI components for user interaction

**Technical Level:** ${options.technicalLevel}`;
  }

  private inferArchitectureStyle(analysisResult: FolderContext): string {
    const paths = analysisResult.files.map((f) => f.path.toLowerCase());

    if (paths.some((p) => p.includes('microservice'))) {
      return 'Microservices';
    }
    if (
      paths.some((p) => p.includes('api')) &&
      paths.some((p) => p.includes('client'))
    ) {
      return 'Client-Server';
    }
    if (paths.some((p) => p.includes('component'))) {
      return 'Component-based';
    }
    return 'Layered Architecture';
  }

  private inferPrimaryLanguage(analysisResult: FolderContext): string {
    const extensions = analysisResult.files.map((f) =>
      f.path.split('.').pop()?.toLowerCase()
    );
    const langCount: { [key: string]: number } = {};

    for (const ext of extensions) {
      if (ext) {
        langCount[ext] = (langCount[ext] || 0) + 1;
      }
    }

    const primaryExt = Object.keys(langCount).reduce(
      (a, b) => (langCount[a] > langCount[b] ? a : b),
      'js'
    );

    const langMap: { [key: string]: string } = {
      ts: 'TypeScript',
      js: 'JavaScript',
      py: 'Python',
      java: 'Java',
      cs: 'C#',
      rb: 'Ruby',
    };

    return langMap[primaryExt] || 'JavaScript';
  }

  private inferFramework(analysisResult: FolderContext): string {
    const packageJson = analysisResult.files.find((f) =>
      f.path.endsWith('package.json')
    );

    if (packageJson?.content) {
      try {
        const pkg = JSON.parse(packageJson.content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps.react) {
          return 'React';
        }
        if (deps.vue) {
          return 'Vue.js';
        }
        if (deps.angular) {
          return 'Angular';
        }
        if (deps.express) {
          return 'Express.js';
        }
        if (deps.next) {
          return 'Next.js';
        }
        if (deps.nuxt) {
          return 'Nuxt.js';
        }
      } catch {
        // Ignore JSON parsing errors
      }
    }

    return 'Node.js';
  }

  private detectArchitectureType(
    analysisResult: FolderContext
  ): 'microservices' | 'monolith' | 'serverless' {
    const paths = analysisResult.files.map((f) => f.path.toLowerCase());

    if (
      paths.some(
        (p) =>
          p.includes('microservice') ||
          p.includes('lambda') ||
          p.includes('function')
      )
    ) {
      return 'microservices';
    }
    if (paths.some((p) => p.includes('serverless') || p.includes('lambda'))) {
      return 'serverless';
    }
    return 'monolith';
  }

  private extractTechnologies(
    analysisResult: FolderContext
  ): Array<{ category: string; technology: string }> {
    const technologies: Array<{ category: string; technology: string }> = [];
    const packageJson = analysisResult.files.find((f) =>
      f.path.endsWith('package.json')
    );

    if (packageJson?.content) {
      try {
        const pkg = JSON.parse(packageJson.content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        // Frontend technologies
        if (deps.react)
          technologies.push({ category: 'Frontend', technology: 'React' });
        if (deps.vue)
          technologies.push({ category: 'Frontend', technology: 'Vue.js' });
        if (deps.angular)
          technologies.push({ category: 'Frontend', technology: 'Angular' });

        // Backend technologies
        if (deps.express)
          technologies.push({ category: 'Backend', technology: 'Express.js' });
        if (deps.koa)
          technologies.push({ category: 'Backend', technology: 'Koa.js' });
        if (deps.fastify)
          technologies.push({ category: 'Backend', technology: 'Fastify' });

        // Database technologies
        if (deps.mongoose)
          technologies.push({ category: 'Database', technology: 'MongoDB' });
        if (deps.pg || deps.postgres)
          technologies.push({ category: 'Database', technology: 'PostgreSQL' });
        if (deps.mysql)
          technologies.push({ category: 'Database', technology: 'MySQL' });
        if (deps.redis)
          technologies.push({ category: 'Cache', technology: 'Redis' });

        // Testing technologies
        if (deps.jest)
          technologies.push({ category: 'Testing', technology: 'Jest' });
        if (deps.mocha)
          technologies.push({ category: 'Testing', technology: 'Mocha' });
        if (deps.cypress)
          technologies.push({ category: 'Testing', technology: 'Cypress' });
      } catch {
        // Ignore JSON parsing errors
      }
    }

    // Default technologies if none found
    if (technologies.length === 0) {
      technologies.push(
        { category: 'Runtime', technology: 'Node.js' },
        {
          category: 'Language',
          technology: this.inferPrimaryLanguage(analysisResult),
        }
      );
    }

    return technologies;
  }

  private async generateAPIDocumentation(
    analysisResult: FolderContext
  ): Promise<
    Array<{
      method: string;
      endpoint: string;
      description: string;
      requestExample?: string;
      responseExample?: string;
    }>
  > {
    const apiSpec = await this.generateAPISpecification(analysisResult);
    return apiSpec.endpoints.map((endpoint) => ({
      method: endpoint.method,
      endpoint: endpoint.path,
      description: endpoint.description,
      requestExample: JSON.stringify({ example: 'request' }, null, 2),
      responseExample: JSON.stringify({ example: 'response' }, null, 2),
    }));
  }

  private async analyzeDatabaseTables(
    analysisResult: FolderContext
  ): Promise<
    Array<{
      tableName: string;
      description: string;
      columns: Array<{ name: string; type: string; description: string }>;
    }>
  > {
    const dbSchema = await this.generateDatabaseSchema(analysisResult);
    return dbSchema.databases.flatMap((db) =>
      db.tables.map((table) => ({
        tableName: table.name,
        description: table.description,
        columns: table.columns.map((col) => ({
          name: col.name,
          type: col.type,
          description: col.description,
        })),
      }))
    );
  }

  private async analyzeDeploymentStrategy(
    analysisResult: FolderContext
  ): Promise<string> {
    const hasDockerfile = analysisResult.files.some((f) =>
      f.path.includes('Dockerfile')
    );
    const hasK8s = analysisResult.files.some(
      (f) => f.path.includes('k8s') || f.path.includes('kubernetes')
    );
    const hasHeroku = analysisResult.files.some((f) =>
      f.path.includes('Procfile')
    );

    if (hasK8s) return 'Kubernetes container orchestration';
    if (hasDockerfile) return 'Docker containerized deployment';
    if (hasHeroku) return 'Heroku cloud platform deployment';
    return 'Traditional server deployment';
  }

  private async analyzeTestingApproach(
    analysisResult: FolderContext
  ): Promise<string> {
    const testStrategy = await this.generateTestingStrategy(analysisResult);
    const approaches = testStrategy.levels
      .map((level) => level.name)
      .join(', ');
    return approaches || 'Unit and integration testing';
  }

  private async analyzeSecurityRequirements(
    analysisResult: FolderContext
  ): Promise<Array<string>> {
    const requirements: string[] = [];

    const hasAuth = analysisResult.files.some(
      (f) =>
        f.content?.includes('auth') ||
        f.content?.includes('jwt') ||
        f.content?.includes('passport')
    );

    if (hasAuth) {
      requirements.push('User authentication and authorization');
    }

    const hasEncryption = analysisResult.files.some(
      (f) =>
        f.content?.includes('bcrypt') ||
        f.content?.includes('crypto') ||
        f.content?.includes('encrypt')
    );

    if (hasEncryption) {
      requirements.push('Data encryption and hashing');
    }

    const hasValidation = analysisResult.files.some(
      (f) =>
        f.content?.includes('joi') ||
        f.content?.includes('yup') ||
        f.content?.includes('validator')
    );

    if (hasValidation) {
      requirements.push('Input validation and sanitization');
    }

    // Default security requirements
    if (requirements.length === 0) {
      requirements.push(
        'Basic input validation',
        'Secure HTTP headers',
        'Environment variable protection'
      );
    }

    return requirements;
  }

  // Formatting methods
  private formatArchitectureAnalysis(
    architecture: ArchitectureAnalysis
  ): string {
    const componentsSection = architecture.components
      .map(
        (comp) =>
          `### ${comp.name} (${comp.type})
**Description:** ${comp.description}
**Complexity:** ${comp.complexity}
**Responsibilities:**
${comp.responsibilities.map((r) => `- ${r}`).join('\n')}
**Dependencies:** ${comp.dependencies.join(', ') || 'None'}
**Files:** ${comp.files.join(', ')}`
      )
      .join('\n\n');

    const patternsSection = architecture.patterns
      .map(
        (pattern) =>
          `### ${pattern.name}
**Description:** ${pattern.description}
**Benefits:** ${pattern.benefits.join(', ')}
**Tradeoffs:** ${pattern.tradeoffs.join(', ')}`
      )
      .join('\n\n');

    return `## Architecture Analysis

${architecture.systemOverview}

### System Components
${componentsSection}

### Architectural Patterns
${patternsSection}

### Scaling Considerations
${architecture.scalingConsiderations.map((sc) => `- ${sc}`).join('\n')}`;
  }

  private formatAPISpecification(apiSpec: APISpecification): string {
    const endpointsSection = apiSpec.endpoints
      .map(
        (endpoint) =>
          `### ${endpoint.method} ${endpoint.path}
**Description:** ${endpoint.description}
**Parameters:**
${endpoint.parameters.map((p) => `- \`${p.name}\` (${p.type}, ${p.location}${p.required ? ', required' : ''}): ${p.description}`).join('\n') || 'None'}
**Responses:**
${endpoint.responses.map((r) => `- ${r.statusCode}: ${r.description}`).join('\n')}
**Authentication:** ${endpoint.authentication.join(', ')}`
      )
      .join('\n\n');

    const schemasSection = apiSpec.schemas
      .map(
        (schema) =>
          `### ${schema.name}
**Type:** ${schema.type}
**Description:** ${schema.description}
**Properties:**
${schema.properties.map((p) => `- \`${p.name}\` (${p.type}${p.required ? ', required' : ''}): ${p.description}`).join('\n')}`
      )
      .join('\n\n');

    return `## API Specification

### Endpoints
${endpointsSection}

### Data Schemas
${schemasSection}

### Authentication Methods
${apiSpec.authentication.map((auth) => `- **${auth.type}**: ${auth.description}`).join('\n')}`;
  }

  private formatDatabaseSchema(dbSchema: DatabaseSchema): string {
    const databasesSection = dbSchema.databases
      .map((db) => {
        const tablesSection = db.tables
          .map(
            (table) =>
              `#### ${table.name}
**Description:** ${table.description}
**Columns:**
${table.columns.map((col) => `- \`${col.name}\` (${col.type}${col.nullable ? ', nullable' : ''}${col.primaryKey ? ', primary key' : ''}): ${col.description}`).join('\n')}`
          )
          .join('\n\n');

        return `### ${db.name} (${db.type})
**Description:** ${db.description}
${tablesSection}`;
      })
      .join('\n\n');

    return `## Database Schema

${databasesSection}

### Migrations
${dbSchema.migrations.map((m) => `- **${m.version}**: ${m.description}`).join('\n')}

### Seed Data
${dbSchema.seedData.map((s) => `- **${s.table}**: ${s.description}`).join('\n')}`;
  }

  private formatConfigurationDocs(config: ConfigurationDocumentation): string {
    const environmentsSection = config.environments
      .map(
        (env) =>
          `### ${env.name}
**Description:** ${env.description}
**Variables:**
${env.variables.map((v) => `- \`${v.name}\` (${v.type}${v.required ? ', required' : ''}): ${v.description} (Example: ${v.example})`).join('\n')}`
      )
      .join('\n\n');

    return `## Configuration Documentation

### Environments
${environmentsSection}

### Configuration Files
${config.configFiles.map((cf) => `- **${cf.path}** (${cf.format}): ${cf.description}`).join('\n')}

### Secrets Management
${config.secrets.map((s) => `- **${s.name}**: ${s.description} (Storage: ${s.storage})`).join('\n')}`;
  }

  private formatDeploymentDocs(deployment: DeploymentDocumentation): string {
    const environmentsSection = deployment.environments
      .map(
        (env) =>
          `### ${env.name}
**Description:** ${env.description}
**Infrastructure:** ${env.infrastructure.join(', ')}
**Requirements:** ${env.requirements.join(', ')}
**Scaling:** ${env.scaling}`
      )
      .join('\n\n');

    const stepsSection = deployment.deploymentSteps
      .map(
        (step) =>
          `### ${step.phase}
**Description:** ${step.description}
**Steps:**
${step.steps.map((s) => `1. ${s}`).join('\n')}
**Rollback:**
${step.rollback.map((r) => `- ${r}`).join('\n')}`
      )
      .join('\n\n');

    return `## Deployment Documentation

### Environments
${environmentsSection}

### Deployment Process
${stepsSection}

### Monitoring
${deployment.monitoring.map((m) => `- **${m.metric}**: ${m.description} (Threshold: ${m.threshold})`).join('\n')}

### Troubleshooting
${deployment.troubleshooting.map((t) => `- **${t.issue}**: ${t.symptoms.join(', ')} → ${t.resolution.join(', ')}`).join('\n')}`;
  }

  private formatTestingStrategy(testing: TestingStrategy): string {
    const levelsSection = testing.levels
      .map(
        (level) =>
          `### ${level.name}
**Description:** ${level.description}
**Scope:** ${level.scope}
**Tools:** ${level.tools.join(', ')}
**Coverage:** ${level.coverage}`
      )
      .join('\n\n');

    return `## Testing Strategy

### Testing Levels
${levelsSection}

### Testing Frameworks
${testing.frameworks.map((f) => `- **${f.name}**: ${f.purpose}`).join('\n')}

### Test Data Management
${testing.testData.map((td) => `- **${td.type}**: ${td.description}`).join('\n')}

### Test Automation
${testing.automation.map((ta) => `- **${ta.trigger}**: ${ta.description}`).join('\n')}`;
  }

  private formatIntegrationMapping(integration: IntegrationMapping): string {
    const externalSection = integration.externalServices
      .map(
        (service) =>
          `### ${service.name}
**Type:** ${service.type}
**Description:** ${service.description}
**Endpoint:** ${service.endpoint}
**Authentication:** ${service.authentication}
**Data Format:** ${service.dataFormat}`
      )
      .join('\n\n');

    const internalSection = integration.internalServices
      .map(
        (service) =>
          `### ${service.name}
**Description:** ${service.description}
**Interface:** ${service.interface}
**Protocol:** ${service.protocol}
**Dependencies:** ${service.dependencies.join(', ')}`
      )
      .join('\n\n');

    return `## Integration Mapping

### External Services
${externalSection}

### Internal Services
${internalSection}

### Data Flow
${integration.dataflow.map((df) => `- **${df.source}** → **${df.destination}**: ${df.data} (${df.frequency})`).join('\n')}

### Communication Protocols
${integration.protocols.map((p) => `- **${p.name}**: ${p.usage}`).join('\n')}`;
  }
}
