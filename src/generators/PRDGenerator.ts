import { FolderContext } from '../utils/FolderAnalyzer';
import { TemplateManager } from '../templates/TemplateManager';
import { ClaudeIntegrator } from '../commands/ClaudeIntegrator';

export interface PRDGenerationOptions {
  includeUserStories: boolean;
  includeAcceptanceCriteria: boolean;
  includeDependencyAnalysis: boolean;
  includeSuccessMetrics: boolean;
  includeTimeline: boolean;
  businessContext: string;
  targetAudience: string[];
  outputFormat: 'markdown' | 'confluence' | 'notion';
  templateName?: string;
}

export interface FeatureRequirement {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'functional' | 'non-functional' | 'technical';
  businessValue: string;
  complexity: 'low' | 'medium' | 'high';
  dependencies: string[];
  relatedFiles: string[];
  estimatedEffort: string;
}

export interface UserStory {
  id: string;
  title: string;
  description: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  priority: 'high' | 'medium' | 'low';
  epicId?: string;
  storyPoints?: number;
  relatedFeatures: string[];
  businessValue: string;
}

export interface AcceptanceCriteria {
  requirementId: string;
  criteria: Array<{
    id: string;
    description: string;
    type: 'functional' | 'performance' | 'security' | 'usability';
    testable: boolean;
    relatedTestFiles: string[];
  }>;
}

export interface DependencyMapping {
  internalDependencies: Array<{
    name: string;
    type: 'component' | 'service' | 'library' | 'database';
    version?: string;
    relationship: 'uses' | 'provides' | 'extends';
    impact: 'high' | 'medium' | 'low';
    files: string[];
  }>;
  externalDependencies: Array<{
    name: string;
    version: string;
    purpose: string;
    criticalPath: boolean;
    alternatives: string[];
    license?: string;
  }>;
  featureDependencies: Array<{
    feature: string;
    dependsOn: string[];
    blockedBy: string[];
    enables: string[];
  }>;
}

export interface SuccessMetrics {
  businessMetrics: Array<{
    name: string;
    description: string;
    target: string;
    measurement: string;
    frequency: string;
    owner: string;
  }>;
  technicalMetrics: Array<{
    name: string;
    description: string;
    target: string;
    measurement: string;
    tools: string[];
  }>;
  userMetrics: Array<{
    name: string;
    description: string;
    target: string;
    measurement: string;
    userSegment: string;
  }>;
}

export interface TimelineEstimation {
  phases: Array<{
    name: string;
    description: string;
    duration: string;
    startDate?: string;
    endDate?: string;
    dependencies: string[];
    deliverables: string[];
    risks: string[];
  }>;
  milestones: Array<{
    name: string;
    date: string;
    description: string;
    criteria: string[];
    stakeholders: string[];
  }>;
  totalEstimate: {
    optimistic: string;
    realistic: string;
    pessimistic: string;
  };
}

interface AnalyzedFeature {
  name: string;
  files: string[];
  dependencies: string[];
  exports: string[];
  size: number;
  complexity: number;
}

export class PRDGenerator {
  private templateManager: TemplateManager;
  private claudeIntegrator: ClaudeIntegrator;

  constructor(
    templateManager: TemplateManager,
    claudeIntegrator: ClaudeIntegrator
  ) {
    this.templateManager = templateManager;
    this.claudeIntegrator = claudeIntegrator;
  }

  async generatePRD(
    analysisResult: FolderContext,
    options: PRDGenerationOptions
  ): Promise<string> {
    const sections: string[] = [];

    // Generate executive summary
    const executiveSummary = await this.generateExecutiveSummary(
      analysisResult,
      options
    );
    sections.push(executiveSummary);

    // Extract and analyze features
    const requirements = await this.extractFeatureRequirements(analysisResult);
    sections.push(this.formatFeatureRequirements(requirements));

    if (options.includeUserStories) {
      const userStories = await this.generateUserStories(
        analysisResult,
        requirements
      );
      sections.push(this.formatUserStories(userStories));
    }

    if (options.includeAcceptanceCriteria) {
      const acceptanceCriteria = await this.generateAcceptanceCriteria(
        analysisResult,
        requirements
      );
      sections.push(this.formatAcceptanceCriteria(acceptanceCriteria));
    }

    if (options.includeDependencyAnalysis) {
      const dependencies = await this.analyzeDependencies(analysisResult);
      sections.push(this.formatDependencyAnalysis(dependencies));
    }

    if (options.includeSuccessMetrics) {
      const metrics = await this.generateSuccessMetrics(
        analysisResult,
        requirements
      );
      sections.push(this.formatSuccessMetrics(metrics));
    }

    if (options.includeTimeline) {
      const timeline = await this.estimateTimeline(
        requirements,
        analysisResult
      );
      sections.push(this.formatTimeline(timeline));
    }

    const templateName = options.templateName || 'prd-template';
    const template = await this.templateManager.loadTemplate(templateName);

    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    // Map analysis data to template variables
    const templateVariables = {
      productName: analysisResult.name || 'Project',
      productVision:
        options.businessContext ||
        'Improve user experience through enhanced functionality',
      targetAudience: options.targetAudience.map((audience) => ({
        name: audience,
        description: `${audience} users`,
      })),
      businessGoals: [
        {
          goal: 'Improve user satisfaction',
          rationale: 'Based on code analysis and feature requirements',
        },
        {
          goal: 'Enhance system reliability',
          rationale: 'Through improved architecture and testing',
        },
      ],
      projectDescription:
        analysisResult.summary ||
        'Project analysis and requirements definition',
      userStories: await this.generateUserStories(
        analysisResult,
        await this.extractFeatureRequirements(analysisResult)
      ),
      stakeholders: [
        {
          name: 'Development Team',
          role: 'Implementation',
          responsibilities: 'Code development and testing',
        },
        {
          name: 'Product Manager',
          role: 'Strategy',
          responsibilities: 'Requirements and roadmap',
        },
      ],
      dependencies:
        analysisResult.dependencies?.map((dep) => ({
          name: dep.packageName,
          description: `External dependency used in project`,
          type: 'library',
        })) || [],
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

  async extractFeatureRequirements(
    analysisResult: FolderContext
  ): Promise<FeatureRequirement[]> {
    const requirements: FeatureRequirement[] = [];

    // Analyze code structure to identify features
    const features = await this.identifyFeaturesFromCode(analysisResult);

    for (const feature of features) {
      const requirement: FeatureRequirement = {
        id: this.generateRequirementId(feature.name),
        title: feature.name,
        description: await this.generateFeatureDescription(feature),
        priority: this.assessFeaturePriority(feature),
        category: this.categorizeFeature(feature),
        businessValue: await this.generateBusinessValue(feature),
        complexity: this.assessFeatureComplexity(feature),
        dependencies: feature.dependencies,
        relatedFiles: feature.files,
        estimatedEffort: this.estimateEffort(feature),
      };

      requirements.push(requirement);
    }

    return requirements;
  }

  private async identifyFeaturesFromCode(
    analysisResult: FolderContext
  ): Promise<AnalyzedFeature[]> {
    const features: AnalyzedFeature[] = [];

    // Group files by feature based on directory structure
    const featureGroups = this.groupFilesByFeature(analysisResult.files);

    for (const [featureName, files] of featureGroups) {
      const feature: AnalyzedFeature = {
        name: this.normalizeFeatureName(featureName),
        files: files.map((f) => f.path),
        dependencies: this.extractFeatureDependencies(files),
        exports: this.extractFeatureExports(files),
        size: files.reduce((sum, f) => sum + (f.size || 0), 0),
        complexity: this.calculateCodeComplexity(files),
      };

      features.push(feature);
    }

    return features;
  }

  private groupFilesByFeature(files: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const file of files) {
      const feature = this.extractFeatureFromPath(file.path);
      if (!groups.has(feature)) {
        groups.set(feature, []);
      }
      groups.get(feature)!.push(file);
    }

    return groups;
  }

  private extractFeatureFromPath(filePath: string): string {
    const pathParts = filePath.split('/');

    // Look for feature indicators
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (
        part.includes('feature') ||
        part.includes('component') ||
        part.includes('module')
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

  private normalizeFeatureName(name: string): string {
    return name
      .replace(/[-_]/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase());
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

  private extractFeatureExports(files: any[]): string[] {
    const exports = new Set<string>();

    for (const file of files) {
      const fileExports = file.exports || [];
      for (const exported of fileExports) {
        exports.add(exported);
      }
    }

    return Array.from(exports);
  }

  private calculateCodeComplexity(files: any[]): number {
    let complexity = 0;

    for (const file of files) {
      if (file.content) {
        // Simple complexity metrics
        const cyclomaticComplexity = (
          file.content.match(/if|for|while|switch|catch/g) || []
        ).length;
        const functionCount = (file.content.match(/function|=>/g) || []).length;
        complexity += cyclomaticComplexity + functionCount;
      }
    }

    return complexity;
  }

  private generateRequirementId(featureName: string): string {
    return `REQ-${featureName.replace(/\s+/g, '-').toUpperCase()}-${Date.now().toString().slice(-4)}`;
  }

  private async generateFeatureDescription(
    feature: AnalyzedFeature
  ): Promise<string> {
    const description = `Feature that provides ${feature.name.toLowerCase()} functionality with ${feature.files.length} implementation files.`;

    if (feature.exports.length > 0) {
      return `${description} Exposes ${feature.exports.join(', ')} interfaces.`;
    }

    return description;
  }

  private assessFeaturePriority(
    feature: AnalyzedFeature
  ): 'high' | 'medium' | 'low' {
    // Priority based on feature size, dependencies, and usage
    if (feature.size > 5000 || feature.dependencies.length > 10) {
      return 'high';
    }
    if (feature.size > 1000 || feature.dependencies.length > 5) {
      return 'medium';
    }
    return 'low';
  }

  private categorizeFeature(
    feature: AnalyzedFeature
  ): 'functional' | 'non-functional' | 'technical' {
    const technicalIndicators = ['util', 'helper', 'service', 'config', 'lib'];
    const featureName = feature.name.toLowerCase();

    if (
      technicalIndicators.some((indicator) => featureName.includes(indicator))
    ) {
      return 'technical';
    }

    // For now, default to functional
    return 'functional';
  }

  private async generateBusinessValue(
    feature: AnalyzedFeature
  ): Promise<string> {
    return `Enables ${feature.name.toLowerCase()} capabilities that support core business operations and user experience.`;
  }

  private assessFeatureComplexity(
    feature: AnalyzedFeature
  ): 'low' | 'medium' | 'high' {
    if (feature.complexity > 50 || feature.files.length > 10) {
      return 'high';
    }
    if (feature.complexity > 20 || feature.files.length > 5) {
      return 'medium';
    }
    return 'low';
  }

  private estimateEffort(feature: AnalyzedFeature): string {
    const complexityMultiplier = {
      low: 1,
      medium: 2,
      high: 4,
    };

    const baseEffort = feature.files.length * 2; // 2 hours per file
    const complexity = this.assessFeatureComplexity(feature);
    const totalHours = baseEffort * complexityMultiplier[complexity];

    if (totalHours > 40) {
      return `${Math.ceil(totalHours / 40)} weeks`;
    }
    if (totalHours > 8) {
      return `${Math.ceil(totalHours / 8)} days`;
    }
    return `${totalHours} hours`;
  }

  async generateUserStories(
    analysisResult: FolderContext,
    requirements: FeatureRequirement[]
  ): Promise<UserStory[]> {
    const userStories: UserStory[] = [];

    for (const requirement of requirements) {
      // Generate user stories based on feature functionality
      const stories = await this.generateStoriesForRequirement(
        requirement,
        analysisResult
      );
      userStories.push(...stories);
    }

    return userStories;
  }

  private async generateStoriesForRequirement(
    requirement: FeatureRequirement,
    _analysisResult: FolderContext
  ): Promise<UserStory[]> {
    const stories: UserStory[] = [];

    // Generate primary user story
    const primaryStory: UserStory = {
      id: `US-${requirement.id.replace('REQ-', '')}`,
      title: `Use ${requirement.title}`,
      description: requirement.description,
      asA: 'user',
      iWant: `to use ${requirement.title.toLowerCase()}`,
      soThat: 'I can accomplish my goals efficiently',
      acceptanceCriteria:
        await this.generateAcceptanceCriteriaForStory(requirement),
      priority: requirement.priority,
      storyPoints: this.estimateStoryPoints(requirement),
      relatedFeatures: [requirement.title],
      businessValue: requirement.businessValue,
    };

    stories.push(primaryStory);

    return stories;
  }

  private async generateAcceptanceCriteriaForStory(
    requirement: FeatureRequirement
  ): Promise<string[]> {
    const criteria: string[] = [];

    criteria.push(`Given I have access to ${requirement.title.toLowerCase()}`);
    criteria.push(
      `When I interact with the ${requirement.title.toLowerCase()} feature`
    );
    criteria.push(`Then I should see the expected functionality`);

    if (requirement.category === 'functional') {
      criteria.push(`And the feature should work as specified`);
    }

    return criteria;
  }

  private estimateStoryPoints(requirement: FeatureRequirement): number {
    const complexityPoints = {
      low: 2,
      medium: 5,
      high: 8,
    };

    return complexityPoints[requirement.complexity];
  }

  async generateAcceptanceCriteria(
    analysisResult: FolderContext,
    requirements: FeatureRequirement[]
  ): Promise<AcceptanceCriteria[]> {
    const acceptanceCriteria: AcceptanceCriteria[] = [];

    for (const requirement of requirements) {
      const criteria = await this.generateCriteriaForRequirement(
        requirement,
        analysisResult
      );
      acceptanceCriteria.push(criteria);
    }

    return acceptanceCriteria;
  }

  private async generateCriteriaForRequirement(
    requirement: FeatureRequirement,
    analysisResult: FolderContext
  ): Promise<AcceptanceCriteria> {
    const testFiles = analysisResult.files.filter(
      (f) =>
        f.path.includes('test') ||
        f.path.includes('spec') ||
        requirement.relatedFiles.some((rf) =>
          f.path.includes(rf.split('/').pop()?.split('.')[0] || '')
        )
    );

    const criteria: AcceptanceCriteria = {
      requirementId: requirement.id,
      criteria: [
        {
          id: `AC-${requirement.id}-001`,
          description: `${requirement.title} should function correctly under normal conditions`,
          type: 'functional',
          testable: true,
          relatedTestFiles: testFiles.map((f) => f.path),
        },
        {
          id: `AC-${requirement.id}-002`,
          description: `${requirement.title} should handle edge cases gracefully`,
          type: 'functional',
          testable: true,
          relatedTestFiles: testFiles.map((f) => f.path),
        },
      ],
    };

    if (requirement.complexity === 'high') {
      criteria.criteria.push({
        id: `AC-${requirement.id}-003`,
        description: `${requirement.title} should meet performance requirements`,
        type: 'performance',
        testable: true,
        relatedTestFiles: testFiles
          .filter((f) => f.path.includes('performance'))
          .map((f) => f.path),
      });
    }

    return criteria;
  }

  async analyzeDependencies(
    analysisResult: FolderContext
  ): Promise<DependencyMapping> {
    const packageJson = analysisResult.files.find((f) =>
      f.path.endsWith('package.json')
    );
    let externalDeps: any = {};

    if (packageJson?.content) {
      try {
        const pkg = JSON.parse(packageJson.content);
        externalDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      } catch (error) {
        // Ignore JSON parsing errors
      }
    }

    const internalDeps = await this.analyzeInternalDependencies(
      analysisResult.files
    );
    const featureDeps = await this.analyzeFeatureDependencies(analysisResult);

    return {
      internalDependencies: internalDeps,
      externalDependencies: Object.entries(externalDeps).map(
        ([name, version]) => ({
          name,
          version: version as string,
          purpose: this.inferDependencyPurpose(name),
          criticalPath: this.isCriticalDependency(name),
          alternatives: this.suggestAlternatives(name),
          license: undefined,
        })
      ),
      featureDependencies: featureDeps,
    };
  }

  private async analyzeInternalDependencies(
    files: any[]
  ): Promise<DependencyMapping['internalDependencies']> {
    const dependencies: DependencyMapping['internalDependencies'] = [];

    for (const file of files) {
      const imports = file.imports || [];
      const internalImports = imports.filter((imp: string) =>
        imp.startsWith('.')
      );

      for (const imp of internalImports) {
        dependencies.push({
          name: imp,
          type: 'component',
          relationship: 'uses',
          impact: 'medium',
          files: [file.path],
        });
      }
    }

    return dependencies;
  }

  private async analyzeFeatureDependencies(
    analysisResult: FolderContext
  ): Promise<DependencyMapping['featureDependencies']> {
    const features = await this.identifyFeaturesFromCode(analysisResult);
    const featureDeps: DependencyMapping['featureDependencies'] = [];

    for (const feature of features) {
      featureDeps.push({
        feature: feature.name,
        dependsOn: feature.dependencies,
        blockedBy: [],
        enables: [],
      });
    }

    return featureDeps;
  }

  private inferDependencyPurpose(name: string): string {
    const purposeMap: { [key: string]: string } = {
      react: 'UI framework',
      vue: 'UI framework',
      angular: 'UI framework',
      express: 'Web server',
      lodash: 'Utility library',
      axios: 'HTTP client',
      jest: 'Testing framework',
      typescript: 'Type system',
    };

    return purposeMap[name] || 'Library dependency';
  }

  private isCriticalDependency(name: string): boolean {
    const criticalDeps = ['react', 'vue', 'angular', 'express', 'next', 'nuxt'];
    return criticalDeps.includes(name);
  }

  private suggestAlternatives(name: string): string[] {
    const alternatives: { [key: string]: string[] } = {
      lodash: ['ramda', 'native-javascript'],
      axios: ['fetch', 'node-fetch'],
      moment: ['date-fns', 'dayjs'],
      jquery: ['vanilla-javascript', 'alpine.js'],
    };

    return alternatives[name] || [];
  }

  async generateSuccessMetrics(
    _analysisResult: FolderContext,
    _requirements: FeatureRequirement[]
  ): Promise<SuccessMetrics> {
    return {
      businessMetrics: [
        {
          name: 'Feature Adoption Rate',
          description: 'Percentage of users actively using the new features',
          target: '80% within 3 months',
          measurement: 'User analytics and feature usage tracking',
          frequency: 'Weekly',
          owner: 'Product Manager',
        },
        {
          name: 'User Satisfaction Score',
          description: 'User satisfaction with the new features',
          target: '4.5/5.0 average rating',
          measurement: 'User surveys and feedback',
          frequency: 'Monthly',
          owner: 'UX Team',
        },
      ],
      technicalMetrics: [
        {
          name: 'System Performance',
          description: 'Response time and throughput of new features',
          target: '<200ms response time, 99.9% uptime',
          measurement: 'Application performance monitoring',
          tools: ['New Relic', 'DataDog', 'CloudWatch'],
        },
        {
          name: 'Code Quality',
          description: 'Code coverage, bug rate, and maintainability',
          target: '>90% test coverage, <0.1% bug rate',
          measurement: 'Static code analysis and testing metrics',
          tools: ['SonarQube', 'Jest', 'ESLint'],
        },
      ],
      userMetrics: [
        {
          name: 'Time to Value',
          description: 'Time for new users to complete first successful action',
          target: '<5 minutes average',
          measurement: 'User journey analytics',
          userSegment: 'New users',
        },
        {
          name: 'Feature Completion Rate',
          description: 'Percentage of users who complete feature workflows',
          target: '>85% completion rate',
          measurement: 'Funnel analysis',
          userSegment: 'Active users',
        },
      ],
    };
  }

  async estimateTimeline(
    requirements: FeatureRequirement[],
    _analysisResult: FolderContext
  ): Promise<TimelineEstimation> {
    const phases = this.generateDevelopmentPhases(requirements);
    const milestones = this.generateMilestones(phases);

    // Calculate total estimates
    const totalEffortHours = requirements.reduce((sum, req) => {
      const effort = this.parseEffortToHours(req.estimatedEffort);
      return sum + effort;
    }, 0);

    return {
      phases,
      milestones,
      totalEstimate: {
        optimistic: this.formatDuration(totalEffortHours * 0.8),
        realistic: this.formatDuration(totalEffortHours),
        pessimistic: this.formatDuration(totalEffortHours * 1.5),
      },
    };
  }

  private generateDevelopmentPhases(
    requirements: FeatureRequirement[]
  ): TimelineEstimation['phases'] {
    const phases: TimelineEstimation['phases'] = [
      {
        name: 'Planning & Design',
        description:
          'Requirements analysis, technical design, and architecture planning',
        duration: '2 weeks',
        dependencies: [],
        deliverables: [
          'Technical specification',
          'UI/UX designs',
          'Architecture document',
        ],
        risks: ['Requirements changes', 'Design complexity'],
      },
      {
        name: 'Core Development',
        description: 'Implementation of core features and functionality',
        duration: this.estimateDevelopmentTime(
          requirements.filter((r) => r.priority === 'high')
        ),
        dependencies: ['Planning & Design'],
        deliverables: [
          'Core feature implementation',
          'Unit tests',
          'API documentation',
        ],
        risks: ['Technical complexity', 'Integration challenges'],
      },
      {
        name: 'Integration & Testing',
        description: 'System integration, testing, and quality assurance',
        duration: '3 weeks',
        dependencies: ['Core Development'],
        deliverables: [
          'Integration tests',
          'End-to-end tests',
          'Performance tests',
        ],
        risks: ['Integration issues', 'Performance bottlenecks'],
      },
      {
        name: 'Deployment & Launch',
        description: 'Production deployment and launch preparation',
        duration: '1 week',
        dependencies: ['Integration & Testing'],
        deliverables: [
          'Production deployment',
          'Launch documentation',
          'Monitoring setup',
        ],
        risks: ['Deployment issues', 'Production bugs'],
      },
    ];

    return phases;
  }

  private estimateDevelopmentTime(requirements: FeatureRequirement[]): string {
    const totalWeeks = requirements.reduce((sum, req) => {
      const hours = this.parseEffortToHours(req.estimatedEffort);
      return sum + hours / 40; // 40 hours per week
    }, 0);

    return `${Math.ceil(totalWeeks)} weeks`;
  }

  private parseEffortToHours(effort: string): number {
    if (effort.includes('weeks')) {
      return parseInt(effort) * 40;
    }
    if (effort.includes('days')) {
      return parseInt(effort) * 8;
    }
    if (effort.includes('hours')) {
      return parseInt(effort);
    }
    return 40; // Default to 1 week
  }

  private formatDuration(hours: number): string {
    if (hours > 160) {
      // More than 4 weeks
      return `${Math.ceil(hours / 160)} months`;
    }
    if (hours > 40) {
      // More than 1 week
      return `${Math.ceil(hours / 40)} weeks`;
    }
    return `${hours} hours`;
  }

  private generateMilestones(
    phases: TimelineEstimation['phases']
  ): TimelineEstimation['milestones'] {
    const milestones: TimelineEstimation['milestones'] = [];
    let cumulativeDuration = 0;

    for (const phase of phases) {
      cumulativeDuration += this.parseDurationToWeeks(phase.duration);

      milestones.push({
        name: `${phase.name} Complete`,
        date: this.calculateMilestoneDate(cumulativeDuration),
        description: `Completion of ${phase.name.toLowerCase()} phase`,
        criteria: phase.deliverables,
        stakeholders: ['Development Team', 'Product Manager', 'QA Team'],
      });
    }

    return milestones;
  }

  private parseDurationToWeeks(duration: string): number {
    if (duration.includes('weeks')) {
      return parseInt(duration);
    }
    if (duration.includes('months')) {
      return parseInt(duration) * 4;
    }
    return 1; // Default to 1 week
  }

  private calculateMilestoneDate(weeksFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + weeksFromNow * 7);
    return date.toISOString().split('T')[0];
  }

  private async generateExecutiveSummary(
    analysisResult: FolderContext,
    options: PRDGenerationOptions
  ): Promise<string> {
    return `## Executive Summary

This product requirements document outlines the development plan for ${analysisResult.name || 'the project'}.

**Business Context:** ${options.businessContext}

**Target Audience:** ${options.targetAudience.join(', ')}

**Project Overview:** Based on code analysis, this project contains ${analysisResult.files.length} files and implements multiple features requiring structured development and clear requirements definition.

**Key Objectives:**
- Define clear functional requirements for all identified features
- Establish user stories and acceptance criteria
- Map dependencies and technical requirements
- Provide timeline and success metrics for project completion`;
  }

  // Formatting methods
  private formatFeatureRequirements(
    requirements: FeatureRequirement[]
  ): string {
    if (requirements.length === 0) {
      return '## Feature Requirements\n\nNo feature requirements identified.';
    }

    const sections = requirements.map(
      (req) => `### ${req.title} (${req.id})

**Description:** ${req.description}

**Priority:** ${req.priority} | **Category:** ${req.category} | **Complexity:** ${req.complexity}

**Business Value:** ${req.businessValue}

**Estimated Effort:** ${req.estimatedEffort}

**Dependencies:** ${req.dependencies.length > 0 ? req.dependencies.join(', ') : 'None'}

**Related Files:** ${req.relatedFiles.join(', ')}`
    );

    return `## Feature Requirements\n\n${sections.join('\n\n')}`;
  }

  private formatUserStories(userStories: UserStory[]): string {
    if (userStories.length === 0) {
      return '## User Stories\n\nNo user stories generated.';
    }

    const sections = userStories.map(
      (story) => `### ${story.title} (${story.id})

**User Story:** As a ${story.asA}, I want ${story.iWant} so that ${story.soThat}.

**Description:** ${story.description}

**Priority:** ${story.priority} | **Story Points:** ${story.storyPoints}

**Business Value:** ${story.businessValue}

**Acceptance Criteria:**
${story.acceptanceCriteria.map((criteria) => `- ${criteria}`).join('\n')}

**Related Features:** ${story.relatedFeatures.join(', ')}`
    );

    return `## User Stories\n\n${sections.join('\n\n')}`;
  }

  private formatAcceptanceCriteria(
    acceptanceCriteria: AcceptanceCriteria[]
  ): string {
    if (acceptanceCriteria.length === 0) {
      return '## Acceptance Criteria\n\nNo acceptance criteria generated.';
    }

    const sections = acceptanceCriteria.map(
      (ac) => `### ${ac.requirementId}

${ac.criteria
  .map(
    (criterion) => `#### ${criterion.id}
**Description:** ${criterion.description}
**Type:** ${criterion.type}
**Testable:** ${criterion.testable ? 'Yes' : 'No'}
**Related Test Files:** ${criterion.relatedTestFiles.join(', ') || 'None'}`
  )
  .join('\n\n')}`
    );

    return `## Acceptance Criteria\n\n${sections.join('\n\n')}`;
  }

  private formatDependencyAnalysis(dependencies: DependencyMapping): string {
    const internal = dependencies.internalDependencies
      .map(
        (dep) =>
          `- **${dep.name}** (${dep.type}): ${dep.relationship} - Impact: ${dep.impact}`
      )
      .join('\n');

    const external = dependencies.externalDependencies
      .map(
        (dep) =>
          `- **${dep.name}** v${dep.version}: ${dep.purpose} ${dep.criticalPath ? '(Critical)' : ''}`
      )
      .join('\n');

    const features = dependencies.featureDependencies
      .map(
        (dep) =>
          `- **${dep.feature}**: Depends on [${dep.dependsOn.join(', ')}]`
      )
      .join('\n');

    return `## Dependency Analysis

### Internal Dependencies
${internal || 'None identified'}

### External Dependencies
${external || 'None identified'}

### Feature Dependencies
${features || 'None identified'}`;
  }

  private formatSuccessMetrics(metrics: SuccessMetrics): string {
    const business = metrics.businessMetrics
      .map(
        (metric) =>
          `- **${metric.name}**: ${metric.description} (Target: ${metric.target})`
      )
      .join('\n');

    const technical = metrics.technicalMetrics
      .map(
        (metric) =>
          `- **${metric.name}**: ${metric.description} (Target: ${metric.target})`
      )
      .join('\n');

    const user = metrics.userMetrics
      .map(
        (metric) =>
          `- **${metric.name}**: ${metric.description} (Target: ${metric.target})`
      )
      .join('\n');

    return `## Success Metrics

### Business Metrics
${business}

### Technical Metrics
${technical}

### User Metrics
${user}`;
  }

  private formatTimeline(timeline: TimelineEstimation): string {
    const phases = timeline.phases
      .map(
        (phase) =>
          `### ${phase.name} (${phase.duration})
${phase.description}

**Dependencies:** ${phase.dependencies.join(', ') || 'None'}
**Deliverables:** ${phase.deliverables.join(', ')}
**Risks:** ${phase.risks.join(', ')}`
      )
      .join('\n\n');

    const milestones = timeline.milestones
      .map(
        (milestone) =>
          `- **${milestone.name}** (${milestone.date}): ${milestone.description}`
      )
      .join('\n');

    return `## Timeline Estimation

### Development Phases
${phases}

### Key Milestones
${milestones}

### Total Estimates
- **Optimistic:** ${timeline.totalEstimate.optimistic}
- **Realistic:** ${timeline.totalEstimate.realistic}
- **Pessimistic:** ${timeline.totalEstimate.pessimistic}`;
  }
}
