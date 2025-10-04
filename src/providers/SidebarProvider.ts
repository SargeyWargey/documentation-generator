import * as vscode from 'vscode';

export interface TreeItem {
  label: string;
  id: string;
  contextValue?: string;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;
  children?: TreeItem[];
  collapsibleState?: vscode.TreeItemCollapsibleState;
}

export class SidebarProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined | null | void
  > = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private treeData: TreeItem[] = [];

  constructor() {
    this.initializeTreeData();
  }

  private initializeTreeData() {
    this.treeData = [
      {
        label: 'Quick Actions',
        id: 'quickActions',
        iconPath: new vscode.ThemeIcon('zap'),
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        children: [
          {
            label: 'Generate Documentation',
            id: 'generateDocs',
            contextValue: 'action',
            iconPath: new vscode.ThemeIcon('file-text'),
            command: {
              command: 'documentation-generator.generateDocs',
              title: 'Generate Documentation',
            },
          },
          {
            label: 'Select Folder',
            id: 'selectFolder',
            contextValue: 'action',
            iconPath: new vscode.ThemeIcon('folder-opened'),
            command: {
              command: 'documentation-generator.selectFolder',
              title: 'Select Folder',
            },
          },
          {
            label: 'Choose Template',
            id: 'chooseTemplate',
            contextValue: 'action',
            iconPath: new vscode.ThemeIcon('list-selection'),
            command: {
              command: 'documentation-generator.selectTemplate',
              title: 'Choose Template',
            },
          },
        ],
      },
      {
        label: 'Templates',
        id: 'templates',
        iconPath: new vscode.ThemeIcon('symbol-class'),
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        children: [
          {
            label: 'Help Documentation',
            id: 'template-help',
            contextValue: 'template',
            iconPath: new vscode.ThemeIcon('question'),
            command: {
              command: 'documentation-generator.useTemplate',
              title: 'Use Template',
              arguments: ['help'],
            },
          },
          {
            label: 'PRD Template',
            id: 'template-prd',
            contextValue: 'template',
            iconPath: new vscode.ThemeIcon('project'),
            command: {
              command: 'documentation-generator.useTemplate',
              title: 'Use Template',
              arguments: ['prd'],
            },
          },
          {
            label: 'Technical Specification',
            id: 'template-tech',
            contextValue: 'template',
            iconPath: new vscode.ThemeIcon('gear'),
            command: {
              command: 'documentation-generator.useTemplate',
              title: 'Use Template',
              arguments: ['technical'],
            },
          },
          {
            label: 'Meeting Summary',
            id: 'template-meeting',
            contextValue: 'template',
            iconPath: new vscode.ThemeIcon('comment-discussion'),
            command: {
              command: 'documentation-generator.useTemplate',
              title: 'Use Template',
              arguments: ['meeting'],
            },
          },
        ],
      },
      {
        label: 'Recent Generations',
        id: 'recent',
        iconPath: new vscode.ThemeIcon('history'),
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        children: [
          {
            label: 'No recent generations',
            id: 'no-recent',
            iconPath: new vscode.ThemeIcon('circle-slash'),
          },
        ],
      },
      {
        label: 'Settings',
        id: 'settings',
        iconPath: new vscode.ThemeIcon('settings-gear'),
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        children: [
          {
            label: 'Configuration',
            id: 'config',
            contextValue: 'setting',
            iconPath: new vscode.ThemeIcon('wrench'),
            command: {
              command: 'documentation-generator.openSettings',
              title: 'Open Settings',
            },
          },
          {
            label: 'Template Management',
            id: 'templateMgmt',
            contextValue: 'setting',
            iconPath: new vscode.ThemeIcon('book'),
            command: {
              command: 'documentation-generator.manageTemplates',
              title: 'Manage Templates',
            },
          },
          {
            label: 'Help & Documentation',
            id: 'help',
            contextValue: 'setting',
            iconPath: new vscode.ThemeIcon('info'),
            command: {
              command: 'documentation-generator.showHelp',
              title: 'Show Help',
            },
          },
        ],
      },
    ];
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.label,
      element.collapsibleState
    );
    treeItem.id = element.id;
    treeItem.contextValue = element.contextValue;
    treeItem.iconPath = element.iconPath;
    treeItem.command = element.command;
    return treeItem;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      return Promise.resolve(this.treeData);
    }
    return Promise.resolve(element.children || []);
  }

  refresh(): void {
    this.initializeTreeData();
    this._onDidChangeTreeData.fire();
  }

  addRecentGeneration(name: string, path: string, _template: string): void {
    const recentSection = this.treeData.find((item) => item.id === 'recent');
    if (recentSection) {
      if (
        recentSection.children &&
        recentSection.children[0]?.id === 'no-recent'
      ) {
        recentSection.children = [];
      }
      if (!recentSection.children) {
        recentSection.children = [];
      }

      const newItem: TreeItem = {
        label: name,
        id: `recent-${Date.now()}`,
        contextValue: 'recentGeneration',
        iconPath: new vscode.ThemeIcon('file'),
        command: {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [vscode.Uri.file(path)],
        },
      };

      recentSection.children.unshift(newItem);

      // Keep only last 10 items
      if (recentSection.children.length > 10) {
        recentSection.children = recentSection.children.slice(0, 10);
      }

      this._onDidChangeTreeData.fire();
    }
  }

  updateTemplates(templates: string[]): void {
    const templateSection = this.treeData.find(
      (item) => item.id === 'templates'
    );
    if (templateSection) {
      templateSection.children = templates.map((template) => ({
        label: template,
        id: `template-${template}`,
        contextValue: 'template',
        iconPath: new vscode.ThemeIcon('symbol-class'),
        command: {
          command: 'documentation-generator.useTemplate',
          title: 'Use Template',
          arguments: [template],
        },
      }));
      this._onDidChangeTreeData.fire();
    }
  }
}
