import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TemplateManager, Template } from './TemplateManager';
import { TemplateShareManager } from './TemplateShareManager';
import { TemplateValidator } from './TemplateValidator';

export interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  downloads: number;
  rating: number;
  reviewCount: number;
  lastUpdated: string;
  license: string;
  repository?: string;
  documentation?: string;
  screenshots?: string[];
  compatibility: string[];
  featured: boolean;
  verified: boolean;
}

export interface MarketplaceCategory {
  id: string;
  name: string;
  description: string;
  templateCount: number;
  icon: string;
}

export interface SearchFilter {
  category?: string;
  tags?: string[];
  author?: string;
  rating?: number;
  compatibility?: string[];
  verified?: boolean;
  featured?: boolean;
}

export interface TemplateReview {
  id: string;
  templateId: string;
  author: string;
  rating: number;
  title: string;
  content: string;
  createdAt: string;
  helpful: number;
}

export class TemplateMarketplace {
  private templateManager: TemplateManager;
  private shareManager: TemplateShareManager;
  private validator: TemplateValidator;
  private readonly cacheDirectory: string;
  private readonly marketplaceEndpoint: string = 'https://api.template-marketplace.com'; // Placeholder

  constructor(
    templateManager: TemplateManager,
    shareManager: TemplateShareManager,
    extensionContext: vscode.ExtensionContext
  ) {
    this.templateManager = templateManager;
    this.shareManager = shareManager;
    this.validator = new TemplateValidator();
    this.cacheDirectory = path.join(
      extensionContext.globalStorageUri?.fsPath || '',
      'marketplace-cache'
    );
  }

  /**
   * Initialize the marketplace
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDirectory, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Show marketplace browser
   */
  async showMarketplace(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'templateMarketplace',
      'Template Marketplace',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );

    // Set up message handling
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'search':
          await this.handleSearch(panel, message.data);
          break;
        case 'getTemplate':
          await this.handleGetTemplate(panel, message.data);
          break;
        case 'installTemplate':
          await this.handleInstallTemplate(panel, message.data);
          break;
        case 'getCategories':
          await this.handleGetCategories(panel);
          break;
        case 'submitTemplate':
          await this.handleSubmitTemplate();
          break;
        case 'rateTemplate':
          await this.handleRateTemplate(message.data);
          break;
      }
    });

    panel.webview.html = this.generateMarketplaceHTML();

    // Load initial data
    await this.handleGetCategories(panel);
    await this.handleSearch(panel, { query: '', featured: true });
  }

  /**
   * Search templates in marketplace
   */
  async searchTemplates(query: string, filters?: SearchFilter): Promise<MarketplaceTemplate[]> {
    // In a real implementation, this would make API calls to the marketplace
    // For now, return mock data
    return this.getMockTemplates().filter(template => {
      // Apply search and filters
      const matchesQuery = !query ||
        template.name.toLowerCase().includes(query.toLowerCase()) ||
        template.description.toLowerCase().includes(query.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));

      const matchesCategory = !filters?.category || template.category === filters.category;
      const matchesTags = !filters?.tags || filters.tags.some(tag => template.tags.includes(tag));
      const matchesRating = !filters?.rating || template.rating >= filters.rating;
      const matchesVerified = filters?.verified === undefined || template.verified === filters.verified;
      const matchesFeatured = filters?.featured === undefined || template.featured === filters.featured;

      return matchesQuery && matchesCategory && matchesTags && matchesRating && matchesVerified && matchesFeatured;
    });
  }

  /**
   * Get template categories
   */
  async getCategories(): Promise<MarketplaceCategory[]> {
    // Mock categories for now
    return [
      {
        id: 'documentation',
        name: 'Documentation',
        description: 'Templates for creating documentation',
        templateCount: 25,
        icon: 'book'
      },
      {
        id: 'planning',
        name: 'Planning',
        description: 'Project planning and requirement templates',
        templateCount: 18,
        icon: 'project'
      },
      {
        id: 'meeting',
        name: 'Meeting Notes',
        description: 'Templates for meeting summaries and notes',
        templateCount: 12,
        icon: 'comment-discussion'
      },
      {
        id: 'technical',
        name: 'Technical Specs',
        description: 'Technical specification templates',
        templateCount: 15,
        icon: 'gear'
      },
      {
        id: 'business',
        name: 'Business',
        description: 'Business analysis and process templates',
        templateCount: 10,
        icon: 'briefcase'
      }
    ];
  }

  /**
   * Install a template from the marketplace
   */
  async installTemplate(templateId: string): Promise<void> {
    // In a real implementation, this would download the template
    const marketplaceTemplate = this.getMockTemplates().find(t => t.id === templateId);
    if (!marketplaceTemplate) {
      throw new Error('Template not found in marketplace');
    }

    // Mock template content
    const template: Template = {
      id: marketplaceTemplate.id,
      metadata: {
        name: marketplaceTemplate.name,
        description: marketplaceTemplate.description,
        version: marketplaceTemplate.version,
        author: marketplaceTemplate.author,
        category: marketplaceTemplate.category,
        tags: marketplaceTemplate.tags
      },
      content: this.generateMockTemplateContent(marketplaceTemplate),
      filePath: ''
    };

    // Install the template
    const tempFile = path.join(this.cacheDirectory, `${template.id}.md`);
    const frontmatter = this.serializeFrontmatter(template.metadata);
    const fullContent = `---\n${frontmatter}\n---\n${template.content}`;

    await fs.writeFile(tempFile, fullContent);
    await this.templateManager.installTemplate(tempFile);
    await fs.unlink(tempFile); // Clean up

    vscode.window.showInformationMessage(`Template '${marketplaceTemplate.name}' installed successfully`);
  }

  /**
   * Submit a template to the marketplace
   */
  async submitTemplate(templateId: string): Promise<void> {
    const template = this.templateManager.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Validate template for marketplace standards
    const validation = this.validator.validateTemplate(template);
    if (!validation.isValid) {
      vscode.window.showErrorMessage(`Template validation failed: ${validation.errors.join(', ')}`);
      return;
    }

    // Show submission form
    const panel = vscode.window.createWebviewPanel(
      'submitTemplate',
      'Submit to Marketplace',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.generateSubmissionFormHTML(template);

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'submit') {
        await this.handleTemplateSubmission(template, message.data);
        panel.dispose();
      }
    });
  }

  /**
   * Handle search request
   */
  private async handleSearch(panel: vscode.WebviewPanel, data: any): Promise<void> {
    try {
      const templates = await this.searchTemplates(data.query || '', data.filters);
      panel.webview.postMessage({
        command: 'searchResults',
        data: templates
      });
    } catch (error) {
      panel.webview.postMessage({
        command: 'error',
        data: { message: `Search failed: ${error}` }
      });
    }
  }

  /**
   * Handle get template details
   */
  private async handleGetTemplate(panel: vscode.WebviewPanel, data: { templateId: string }): Promise<void> {
    try {
      const template = this.getMockTemplates().find(t => t.id === data.templateId);
      if (template) {
        panel.webview.postMessage({
          command: 'templateDetails',
          data: template
        });
      }
    } catch (error) {
      panel.webview.postMessage({
        command: 'error',
        data: { message: `Failed to get template: ${error}` }
      });
    }
  }

  /**
   * Handle template installation
   */
  private async handleInstallTemplate(panel: vscode.WebviewPanel, data: { templateId: string }): Promise<void> {
    try {
      await this.installTemplate(data.templateId);
      panel.webview.postMessage({
        command: 'installSuccess',
        data: { templateId: data.templateId }
      });
    } catch (error) {
      panel.webview.postMessage({
        command: 'error',
        data: { message: `Installation failed: ${error}` }
      });
    }
  }

  /**
   * Handle get categories
   */
  private async handleGetCategories(panel: vscode.WebviewPanel): Promise<void> {
    try {
      const categories = await this.getCategories();
      panel.webview.postMessage({
        command: 'categories',
        data: categories
      });
    } catch (error) {
      panel.webview.postMessage({
        command: 'error',
        data: { message: `Failed to get categories: ${error}` }
      });
    }
  }

  /**
   * Handle submit template
   */
  private async handleSubmitTemplate(): Promise<void> {
    const templates = this.templateManager.getTemplates();
    if (templates.length === 0) {
      vscode.window.showInformationMessage('No templates available to submit');
      return;
    }

    const templateItems = templates.map(t => ({
      label: t.metadata.name,
      description: t.metadata.description,
      template: t
    }));

    const selected = await vscode.window.showQuickPick(templateItems, {
      placeHolder: 'Select a template to submit to marketplace'
    });

    if (selected) {
      await this.submitTemplate(selected.template.id);
    }
  }

  /**
   * Handle rate template
   */
  private async handleRateTemplate(_data: { templateId: string; rating: number; review?: string }): Promise<void> {
    // In a real implementation, this would submit the rating to the marketplace API
    vscode.window.showInformationMessage('Thank you for your rating!');
  }

  /**
   * Handle template submission
   */
  private async handleTemplateSubmission(_template: Template, _submissionData: any): Promise<void> {
    // In a real implementation, this would upload the template to the marketplace
    vscode.window.showInformationMessage(
      `Template '${_template.metadata.name}' submitted for review. You'll be notified when it's approved.`
    );
  }

  /**
   * Generate mock template data
   */
  private getMockTemplates(): MarketplaceTemplate[] {
    return [
      {
        id: 'api-documentation',
        name: 'API Documentation Template',
        description: 'Comprehensive template for documenting REST APIs with examples and schemas',
        author: 'DevTools Team',
        version: '2.1.0',
        category: 'documentation',
        tags: ['api', 'rest', 'documentation', 'openapi'],
        downloads: 1247,
        rating: 4.8,
        reviewCount: 23,
        lastUpdated: '2024-01-15',
        license: 'MIT',
        featured: true,
        verified: true,
        compatibility: ['vscode']
      },
      {
        id: 'project-prd',
        name: 'Product Requirements Document',
        description: 'Professional PRD template with user stories, acceptance criteria, and success metrics',
        author: 'PM Collective',
        version: '1.3.2',
        category: 'planning',
        tags: ['prd', 'requirements', 'product', 'planning'],
        downloads: 892,
        rating: 4.6,
        reviewCount: 18,
        lastUpdated: '2024-01-10',
        license: 'Apache-2.0',
        featured: true,
        verified: true,
        compatibility: ['vscode']
      },
      {
        id: 'sprint-retrospective',
        name: 'Sprint Retrospective Template',
        description: 'Structured template for agile sprint retrospectives with action items',
        author: 'Agile Masters',
        version: '1.0.5',
        category: 'meeting',
        tags: ['agile', 'retrospective', 'sprint', 'scrum'],
        downloads: 634,
        rating: 4.4,
        reviewCount: 12,
        lastUpdated: '2024-01-08',
        license: 'CC-BY-4.0',
        featured: false,
        verified: true,
        compatibility: ['vscode']
      },
      {
        id: 'technical-architecture',
        name: 'Technical Architecture Document',
        description: 'Detailed template for system architecture documentation with diagrams and decisions',
        author: 'Architecture Guild',
        version: '3.0.1',
        category: 'technical',
        tags: ['architecture', 'system-design', 'technical', 'documentation'],
        downloads: 456,
        rating: 4.9,
        reviewCount: 8,
        lastUpdated: '2024-01-12',
        license: 'MIT',
        featured: false,
        verified: true,
        compatibility: ['vscode']
      }
    ];
  }

  /**
   * Generate mock template content
   */
  private generateMockTemplateContent(marketplaceTemplate: MarketplaceTemplate): string {
    return `# {{title}}

## Overview

{{description}}

## Key Features

- Feature 1
- Feature 2
- Feature 3

## Getting Started

Instructions for getting started with {{title}}.

## Documentation

Detailed documentation goes here.

---
*Template: ${marketplaceTemplate.name} v${marketplaceTemplate.version}*
*Generated on {{date}}*`;
  }

  /**
   * Serialize metadata to frontmatter
   */
  private serializeFrontmatter(metadata: any): string {
    const lines: string[] = [];
    Object.entries(metadata).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    });
    return lines.join('\n');
  }

  /**
   * Generate marketplace HTML
   */
  private generateMarketplaceHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Template Marketplace</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 0;
        }

        .header {
            background-color: var(--vscode-panel-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 20px;
        }

        .search-container {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
        }

        .search-input {
            flex: 1;
            padding: 10px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
        }

        .filter-select {
            padding: 10px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
        }

        .button {
            padding: 10px 15px;
            border: none;
            border-radius: 4px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
        }

        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .content {
            display: flex;
            height: calc(100vh - 120px);
        }

        .sidebar {
            width: 250px;
            background-color: var(--vscode-panel-background);
            border-right: 1px solid var(--vscode-panel-border);
            padding: 20px;
            overflow-y: auto;
        }

        .main-content {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
        }

        .category-item {
            padding: 10px;
            margin-bottom: 8px;
            border-radius: 4px;
            cursor: pointer;
            border: 1px solid transparent;
        }

        .category-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .category-item.active {
            border-color: var(--vscode-textLink-foreground);
            background-color: var(--vscode-list-activeSelectionBackground);
        }

        .template-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
        }

        .template-card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
            background-color: var(--vscode-panel-background);
        }

        .template-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
        }

        .template-title {
            font-size: 1.2em;
            font-weight: bold;
            margin: 0;
        }

        .template-badges {
            display: flex;
            gap: 5px;
        }

        .badge {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        .badge.featured {
            background-color: var(--vscode-textLink-foreground);
            color: var(--vscode-editor-background);
        }

        .badge.verified {
            background-color: var(--vscode-diffEditor-insertedTextBackground);
            color: var(--vscode-diffEditor-insertedTextForeground);
        }

        .template-meta {
            display: flex;
            justify-content: space-between;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 10px;
        }

        .rating {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .stars {
            color: var(--vscode-textLink-foreground);
        }

        .template-description {
            margin-bottom: 15px;
            line-height: 1.4;
        }

        .template-tags {
            display: flex;
            gap: 5px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }

        .tag {
            padding: 3px 8px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            font-size: 0.8em;
        }

        .template-actions {
            display: flex;
            gap: 10px;
        }

        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .submit-section {
            background-color: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Template Marketplace</h1>
        <div class="search-container">
            <input type="text" class="search-input" id="searchInput" placeholder="Search templates...">
            <select class="filter-select" id="categoryFilter">
                <option value="">All Categories</option>
            </select>
            <button class="button" onclick="search()">Search</button>
        </div>

        <div class="submit-section">
            <h3>Share Your Templates</h3>
            <p>Help the community by sharing your templates with other developers.</p>
            <button class="button secondary" onclick="submitTemplate()">Submit Template</button>
        </div>
    </div>

    <div class="content">
        <div class="sidebar">
            <h3>Categories</h3>
            <div id="categoriesList">
                <div class="loading">Loading categories...</div>
            </div>

            <h3 style="margin-top: 30px;">Filters</h3>
            <div>
                <label>
                    <input type="checkbox" id="featuredFilter"> Featured Templates
                </label>
            </div>
            <div style="margin-top: 10px;">
                <label>
                    <input type="checkbox" id="verifiedFilter"> Verified Authors
                </label>
            </div>
        </div>

        <div class="main-content">
            <div id="templatesGrid" class="template-grid">
                <div class="loading">Loading templates...</div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentTemplates = [];
        let categories = [];

        // Initialize
        vscode.postMessage({ command: 'getCategories' });
        vscode.postMessage({ command: 'search', data: { featured: true } });

        function search() {
            const query = document.getElementById('searchInput').value;
            const category = document.getElementById('categoryFilter').value;
            const featured = document.getElementById('featuredFilter').checked || undefined;
            const verified = document.getElementById('verifiedFilter').checked || undefined;

            vscode.postMessage({
                command: 'search',
                data: {
                    query,
                    filters: { category: category || undefined, featured, verified }
                }
            });
        }

        function installTemplate(templateId) {
            vscode.postMessage({
                command: 'installTemplate',
                data: { templateId }
            });
        }

        function viewTemplate(templateId) {
            vscode.postMessage({
                command: 'getTemplate',
                data: { templateId }
            });
        }

        function submitTemplate() {
            vscode.postMessage({ command: 'submitTemplate' });
        }

        function selectCategory(categoryId) {
            document.getElementById('categoryFilter').value = categoryId;
            document.querySelectorAll('.category-item').forEach(item => {
                item.classList.remove('active');
            });
            if (categoryId) {
                document.querySelector(\`[onclick="selectCategory('\${categoryId}')"]\`).classList.add('active');
            }
            search();
        }

        function renderCategories(cats) {
            categories = cats;
            const container = document.getElementById('categoriesList');

            container.innerHTML = \`
                <div class="category-item" onclick="selectCategory('')">
                    <strong>All Templates</strong>
                </div>
                \${cats.map(cat => \`
                    <div class="category-item" onclick="selectCategory('\${cat.id}')">
                        <strong>\${cat.name}</strong>
                        <div style="font-size: 0.8em; color: var(--vscode-descriptionForeground);">
                            \${cat.templateCount} templates
                        </div>
                    </div>
                \`).join('')}
            \`;

            // Update category filter dropdown
            const categoryFilter = document.getElementById('categoryFilter');
            categoryFilter.innerHTML = '<option value="">All Categories</option>' +
                cats.map(cat => \`<option value="\${cat.id}">\${cat.name}</option>\`).join('');
        }

        function renderTemplates(templates) {
            currentTemplates = templates;
            const container = document.getElementById('templatesGrid');

            if (templates.length === 0) {
                container.innerHTML = '<div class="empty-state">No templates found. Try adjusting your search or filters.</div>';
                return;
            }

            container.innerHTML = templates.map(template => \`
                <div class="template-card">
                    <div class="template-header">
                        <h3 class="template-title">\${template.name}</h3>
                        <div class="template-badges">
                            \${template.featured ? '<span class="badge featured">Featured</span>' : ''}
                            \${template.verified ? '<span class="badge verified">Verified</span>' : ''}
                        </div>
                    </div>

                    <div class="template-meta">
                        <span>by \${template.author}</span>
                        <div class="rating">
                            <span class="stars">★</span>
                            <span>\${template.rating} (\${template.reviewCount})</span>
                        </div>
                    </div>

                    <div class="template-description">
                        \${template.description}
                    </div>

                    <div class="template-tags">
                        \${template.tags.map(tag => \`<span class="tag">\${tag}</span>\`).join('')}
                    </div>

                    <div class="template-meta">
                        <span>v\${template.version}</span>
                        <span>\${template.downloads} downloads</span>
                    </div>

                    <div class="template-actions">
                        <button class="button" onclick="installTemplate('\${template.id}')">
                            Install
                        </button>
                        <button class="button secondary" onclick="viewTemplate('\${template.id}')">
                            Details
                        </button>
                    </div>
                </div>
            \`).join('');
        }

        // Handle search on Enter key
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                search();
            }
        });

        // Handle filter changes
        document.getElementById('featuredFilter').addEventListener('change', search);
        document.getElementById('verifiedFilter').addEventListener('change', search);

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'categories':
                    renderCategories(message.data);
                    break;
                case 'searchResults':
                    renderTemplates(message.data);
                    break;
                case 'installSuccess':
                    alert('Template installed successfully!');
                    break;
                case 'error':
                    alert('Error: ' + message.data.message);
                    break;
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Generate submission form HTML
   */
  private generateSubmissionFormHTML(template: Template): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Submit Template</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }

        input, textarea, select {
            width: 100%;
            padding: 10px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
        }

        textarea {
            min-height: 100px;
            resize: vertical;
        }

        .button {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            margin-right: 10px;
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .checkbox-group input {
            width: auto;
        }
    </style>
</head>
<body>
    <h1>Submit Template to Marketplace</h1>

    <form id="submissionForm">
        <div class="form-group">
            <label>Template Name</label>
            <input type="text" id="templateName" value="${template.metadata.name}" readonly>
        </div>

        <div class="form-group">
            <label>Public Description</label>
            <textarea id="description" placeholder="Describe your template for marketplace users">${template.metadata.description}</textarea>
        </div>

        <div class="form-group">
            <label>Category</label>
            <select id="category">
                <option value="documentation">Documentation</option>
                <option value="planning">Planning</option>
                <option value="meeting">Meeting Notes</option>
                <option value="technical">Technical Specs</option>
                <option value="business">Business</option>
            </select>
        </div>

        <div class="form-group">
            <label>Tags (comma-separated)</label>
            <input type="text" id="tags" placeholder="api, documentation, rest">
        </div>

        <div class="form-group">
            <label>License</label>
            <select id="license">
                <option value="MIT">MIT</option>
                <option value="Apache-2.0">Apache 2.0</option>
                <option value="CC-BY-4.0">Creative Commons BY 4.0</option>
                <option value="Custom">Custom</option>
            </select>
        </div>

        <div class="form-group">
            <label>Repository URL (optional)</label>
            <input type="url" id="repository" placeholder="https://github.com/user/repo">
        </div>

        <div class="form-group">
            <div class="checkbox-group">
                <input type="checkbox" id="agreeTerms" required>
                <label for="agreeTerms">I agree to the marketplace terms and conditions</label>
            </div>
        </div>

        <button type="submit" class="button">Submit for Review</button>
    </form>

    <script>
        const vscode = acquireVsCodeApi();

        document.getElementById('submissionForm').addEventListener('submit', (e) => {
            e.preventDefault();

            const formData = {
                description: document.getElementById('description').value,
                category: document.getElementById('category').value,
                tags: document.getElementById('tags').value.split(',').map(t => t.trim()),
                license: document.getElementById('license').value,
                repository: document.getElementById('repository').value,
                agreeTerms: document.getElementById('agreeTerms').checked
            };

            vscode.postMessage({
                command: 'submit',
                data: formData
            });
        });
    </script>
</body>
</html>`;
  }
}