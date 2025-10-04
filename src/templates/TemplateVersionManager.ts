import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TemplateManager, Template, TemplateMetadata } from './TemplateManager';
import { TemplateValidator } from './TemplateValidator';

export interface TemplateVersion {
  version: string;
  template: Template;
  changelog: string;
  createdAt: string;
  createdBy: string;
  isBreaking: boolean;
  deprecatedFeatures?: string[];
  migrationNotes?: string;
}

export interface VersionHistory {
  templateId: string;
  versions: TemplateVersion[];
  currentVersion: string;
  latestStableVersion: string;
}

export interface UpdateInfo {
  hasUpdates: boolean;
  currentVersion: string;
  latestVersion: string;
  versionsBehind: number;
  isBreakingUpdate: boolean;
  changelog: string[];
}

export interface MigrationPlan {
  fromVersion: string;
  toVersion: string;
  steps: MigrationStep[];
  isBackwardCompatible: boolean;
  requiredActions: string[];
}

export interface MigrationStep {
  type:
    | 'variable_rename'
    | 'variable_add'
    | 'variable_remove'
    | 'content_change'
    | 'metadata_change';
  description: string;
  oldValue?: any;
  newValue?: any;
  automatic: boolean;
}

export class TemplateVersionManager {
  private templateManager: TemplateManager;
  private validator: TemplateValidator;
  private readonly versionsDirectory: string;

  constructor(
    templateManager: TemplateManager,
    extensionContext: vscode.ExtensionContext
  ) {
    this.templateManager = templateManager;
    this.validator = new TemplateValidator();
    this.versionsDirectory = path.join(
      extensionContext.globalStorageUri?.fsPath || '',
      'template-versions'
    );
  }

  /**
   * Initialize the version manager
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.versionsDirectory, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Create a new version of a template
   */
  async createVersion(
    templateId: string,
    newVersion: string,
    changelog: string,
    isBreaking: boolean = false,
    migrationNotes?: string
  ): Promise<void> {
    const template = this.templateManager.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // Validate version format
    if (!this.isValidVersionFormat(newVersion)) {
      throw new Error('Version must follow semantic versioning (e.g., 1.2.3)');
    }

    // Get existing version history
    const history = await this.getVersionHistory(templateId);

    // Check if version already exists
    if (history.versions.some((v) => v.version === newVersion)) {
      throw new Error(`Version '${newVersion}' already exists`);
    }

    // Validate that new version is greater than current
    if (
      history.currentVersion &&
      !this.isNewerVersion(newVersion, history.currentVersion)
    ) {
      throw new Error(
        `New version '${newVersion}' must be greater than current version '${history.currentVersion}'`
      );
    }

    // Detect deprecated features
    const deprecatedFeatures = await this.detectDeprecatedFeatures(
      template,
      history
    );

    // Create new version
    const templateVersion: TemplateVersion = {
      version: newVersion,
      template: { ...template },
      changelog,
      createdAt: new Date().toISOString(),
      createdBy: await this.getCurrentUser(),
      isBreaking,
      deprecatedFeatures,
      migrationNotes,
    };

    // Update history
    history.versions.push(templateVersion);
    history.currentVersion = newVersion;

    // Update latest stable version if not breaking
    if (!isBreaking) {
      history.latestStableVersion = newVersion;
    }

    // Save version history
    await this.saveVersionHistory(templateId, history);

    // Update template metadata with new version
    template.metadata.version = newVersion;
    await this.updateTemplateInManager(template);
  }

  /**
   * Get version history for a template
   */
  async getVersionHistory(templateId: string): Promise<VersionHistory> {
    const historyFile = path.join(this.versionsDirectory, `${templateId}.json`);

    try {
      const content = await fs.readFile(historyFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      // No history exists yet
      return {
        templateId,
        versions: [],
        currentVersion: '1.0.0',
        latestStableVersion: '1.0.0',
      };
    }
  }

  /**
   * Check for template updates
   */
  async checkForUpdates(templateId: string): Promise<UpdateInfo> {
    const history = await this.getVersionHistory(templateId);
    const currentTemplate = this.templateManager.getTemplate(templateId);

    if (!currentTemplate) {
      throw new Error(`Template '${templateId}' not found`);
    }

    const currentVersion = currentTemplate.metadata.version || '1.0.0';
    const latestVersion = history.currentVersion;

    const hasUpdates = this.isNewerVersion(latestVersion, currentVersion);
    const versionsBehind = this.calculateVersionsBehind(
      currentVersion,
      latestVersion,
      history.versions
    );

    // Check if any updates are breaking
    const isBreakingUpdate = history.versions
      .filter((v) => this.isNewerVersion(v.version, currentVersion))
      .some((v) => v.isBreaking);

    // Collect changelog for all versions between current and latest
    const changelog = history.versions
      .filter((v) => this.isNewerVersion(v.version, currentVersion))
      .sort((a, b) => this.compareVersions(a.version, b.version))
      .map((v) => `${v.version}: ${v.changelog}`);

    return {
      hasUpdates,
      currentVersion,
      latestVersion,
      versionsBehind,
      isBreakingUpdate,
      changelog,
    };
  }

  /**
   * Update a template to a specific version
   */
  async updateTemplate(
    templateId: string,
    targetVersion: string
  ): Promise<MigrationPlan | null> {
    const history = await this.getVersionHistory(templateId);
    const currentTemplate = this.templateManager.getTemplate(templateId);

    if (!currentTemplate) {
      throw new Error(`Template '${templateId}' not found`);
    }

    const targetVersionData = history.versions.find(
      (v) => v.version === targetVersion
    );
    if (!targetVersionData) {
      throw new Error(`Version '${targetVersion}' not found`);
    }

    const currentVersion = currentTemplate.metadata.version || '1.0.0';

    // Create migration plan
    const migrationPlan = await this.createMigrationPlan(
      currentTemplate,
      targetVersionData.template,
      currentVersion,
      targetVersion
    );

    // If migration required, show plan to user
    if (
      !migrationPlan.isBackwardCompatible &&
      migrationPlan.requiredActions.length > 0
    ) {
      const proceed = await this.showMigrationPlan(migrationPlan);
      if (!proceed) {
        return migrationPlan; // Return plan but don't execute
      }
    }

    // Execute migration
    await this.executeMigration(
      templateId,
      targetVersionData.template,
      migrationPlan
    );

    return null; // Migration completed successfully
  }

  /**
   * Rollback to a previous version
   */
  async rollbackTemplate(
    templateId: string,
    targetVersion: string
  ): Promise<void> {
    const history = await this.getVersionHistory(templateId);
    const targetVersionData = history.versions.find(
      (v) => v.version === targetVersion
    );

    if (!targetVersionData) {
      throw new Error(`Version '${targetVersion}' not found`);
    }

    // Create rollback confirmation
    const proceed = await vscode.window.showWarningMessage(
      `Are you sure you want to rollback '${templateId}' to version '${targetVersion}'? This action cannot be undone.`,
      'Rollback',
      'Cancel'
    );

    if (proceed === 'Rollback') {
      // Update template to target version
      await this.updateTemplateInManager(targetVersionData.template);

      // Update current version in history (but don't remove newer versions)
      history.currentVersion = targetVersion;
      await this.saveVersionHistory(templateId, history);

      vscode.window.showInformationMessage(
        `Template '${templateId}' rolled back to version '${targetVersion}'`
      );
    }
  }

  /**
   * Show version management UI
   */
  async showVersionManager(): Promise<void> {
    const templates = this.templateManager.getTemplates();

    if (templates.length === 0) {
      vscode.window.showInformationMessage('No templates available');
      return;
    }

    const templateItems = templates.map((t) => ({
      label: t.metadata.name,
      description: `Version: ${t.metadata.version || '1.0.0'}`,
      detail: t.metadata.description,
      template: t,
    }));

    const selected = await vscode.window.showQuickPick(templateItems, {
      placeHolder: 'Select a template to manage versions',
    });

    if (selected) {
      await this.showTemplateVersionActions(selected.template);
    }
  }

  /**
   * Show version actions for a specific template
   */
  private async showTemplateVersionActions(template: Template): Promise<void> {
    const updateInfo = await this.checkForUpdates(template.id);

    const actions = [
      {
        label: '$(tag) Create New Version',
        description: 'Create a new version of this template',
        action: 'create',
      },
      {
        label: '$(history) View Version History',
        description: 'See all versions of this template',
        action: 'history',
      },
    ];

    if (updateInfo.hasUpdates) {
      actions.unshift({
        label: `$(cloud-download) Update Available (${updateInfo.latestVersion})`,
        description: `${updateInfo.versionsBehind} version(s) behind`,
        action: 'update',
      });
    }

    const selected = await vscode.window.showQuickPick(actions, {
      placeHolder: `Manage versions for '${template.metadata.name}'`,
    });

    if (!selected) return;

    switch (selected.action) {
      case 'create':
        await this.handleCreateVersion(template);
        break;
      case 'update':
        await this.handleUpdate(template);
        break;
      case 'history':
        await this.handleViewHistory(template);
        break;
    }
  }

  /**
   * Handle create version action
   */
  private async handleCreateVersion(template: Template): Promise<void> {
    const currentVersion = template.metadata.version || '1.0.0';

    // Suggest next version
    const suggestedVersion = this.suggestNextVersion(currentVersion);

    const newVersion = await vscode.window.showInputBox({
      prompt: 'Enter new version number',
      value: suggestedVersion,
      validateInput: (value) => {
        if (!this.isValidVersionFormat(value)) {
          return 'Version must follow semantic versioning (e.g., 1.2.3)';
        }
        if (!this.isNewerVersion(value, currentVersion)) {
          return `Version must be greater than current version (${currentVersion})`;
        }
        return undefined;
      },
    });

    if (!newVersion) return;

    const changelog = await vscode.window.showInputBox({
      prompt: 'Enter changelog for this version',
      placeHolder: 'Describe what changed in this version',
    });

    if (!changelog) return;

    const isBreaking = await vscode.window.showQuickPick(
      [
        {
          label: 'No',
          detail: 'This is a backward-compatible update',
          value: false,
        },
        {
          label: 'Yes',
          detail: 'This update contains breaking changes',
          value: true,
        },
      ],
      { placeHolder: 'Does this version contain breaking changes?' }
    );

    if (isBreaking === undefined) return;

    let migrationNotes: string | undefined;
    if (isBreaking.value) {
      migrationNotes = await vscode.window.showInputBox({
        prompt: 'Enter migration notes for breaking changes',
        placeHolder: 'Explain how to migrate from the previous version',
      });
    }

    try {
      await this.createVersion(
        template.id,
        newVersion,
        changelog,
        isBreaking.value,
        migrationNotes
      );
      vscode.window.showInformationMessage(
        `Version '${newVersion}' created successfully`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create version: ${error}`);
    }
  }

  /**
   * Handle update action
   */
  private async handleUpdate(template: Template): Promise<void> {
    const updateInfo = await this.checkForUpdates(template.id);

    let message = `Update '${template.metadata.name}' from ${updateInfo.currentVersion} to ${updateInfo.latestVersion}?`;
    if (updateInfo.isBreakingUpdate) {
      message += '\n\n⚠️ This update contains breaking changes.';
    }

    const action = await vscode.window.showInformationMessage(
      message,
      ...(updateInfo.isBreakingUpdate
        ? ['Show Migration Plan', 'Update Anyway', 'Cancel']
        : ['Update', 'Show Changelog', 'Cancel'])
    );

    if (action === 'Update' || action === 'Update Anyway') {
      try {
        const migrationPlan = await this.updateTemplate(
          template.id,
          updateInfo.latestVersion
        );
        if (!migrationPlan) {
          vscode.window.showInformationMessage(
            `Template updated to version ${updateInfo.latestVersion}`
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Update failed: ${error}`);
      }
    } else if (
      action === 'Show Migration Plan' ||
      action === 'Show Changelog'
    ) {
      // Show detailed changelog
      const changelogText = updateInfo.changelog.join('\n\n');
      await vscode.window.showInformationMessage(changelogText, {
        modal: true,
      });
    }
  }

  /**
   * Handle view history action
   */
  private async handleViewHistory(template: Template): Promise<void> {
    const history = await this.getVersionHistory(template.id);

    const versionItems = history.versions
      .sort((a, b) => this.compareVersions(b.version, a.version)) // Newest first
      .map((v) => ({
        label: `${v.version} ${v.version === history.currentVersion ? '(current)' : ''}`,
        description: v.changelog,
        detail: `${v.createdAt.split('T')[0]} by ${v.createdBy}${v.isBreaking ? ' • Breaking' : ''}`,
        version: v,
      }));

    const selected = await vscode.window.showQuickPick(versionItems, {
      placeHolder: 'Select a version to view or rollback',
    });

    if (selected && selected.version.version !== history.currentVersion) {
      const action = await vscode.window.showQuickPick([
        { label: 'Rollback to this version', action: 'rollback' },
        { label: 'View version details', action: 'view' },
      ]);

      if (action?.action === 'rollback') {
        await this.rollbackTemplate(template.id, selected.version.version);
      } else if (action?.action === 'view') {
        await this.showVersionDetails(selected.version);
      }
    }
  }

  /**
   * Show detailed version information
   */
  private async showVersionDetails(version: TemplateVersion): Promise<void> {
    const details = [
      `Version: ${version.version}`,
      `Created: ${version.createdAt}`,
      `Author: ${version.createdBy}`,
      `Breaking: ${version.isBreaking ? 'Yes' : 'No'}`,
      '',
      'Changelog:',
      version.changelog,
    ];

    if (version.deprecatedFeatures && version.deprecatedFeatures.length > 0) {
      details.push(
        '',
        'Deprecated Features:',
        ...version.deprecatedFeatures.map((f) => `• ${f}`)
      );
    }

    if (version.migrationNotes) {
      details.push('', 'Migration Notes:', version.migrationNotes);
    }

    await vscode.window.showInformationMessage(details.join('\n'), {
      modal: true,
    });
  }

  /**
   * Create migration plan between two template versions
   */
  private async createMigrationPlan(
    fromTemplate: Template,
    toTemplate: Template,
    fromVersion: string,
    toVersion: string
  ): Promise<MigrationPlan> {
    const steps: MigrationStep[] = [];
    const requiredActions: string[] = [];

    // Compare variables
    const fromVars = fromTemplate.metadata.variables || [];
    const toVars = toTemplate.metadata.variables || [];

    // Detect variable changes
    const fromVarNames = new Set(fromVars.map((v) => v.name));
    const toVarNames = new Set(toVars.map((v) => v.name));

    // Removed variables
    fromVarNames.forEach((name) => {
      if (!toVarNames.has(name)) {
        steps.push({
          type: 'variable_remove',
          description: `Variable '${name}' has been removed`,
          oldValue: name,
          automatic: false,
        });
        requiredActions.push(
          `Remove usage of variable '${name}' from your content`
        );
      }
    });

    // Added variables
    toVarNames.forEach((name) => {
      if (!fromVarNames.has(name)) {
        const newVar = toVars.find((v) => v.name === name);
        steps.push({
          type: 'variable_add',
          description: `Variable '${name}' has been added`,
          newValue: newVar,
          automatic: true,
        });
      }
    });

    // Changed variables
    fromVars.forEach((fromVar) => {
      const toVar = toVars.find((v) => v.name === fromVar.name);
      if (toVar && JSON.stringify(fromVar) !== JSON.stringify(toVar)) {
        steps.push({
          type: 'variable_rename',
          description: `Variable '${fromVar.name}' has been modified`,
          oldValue: fromVar,
          newValue: toVar,
          automatic: false,
        });
        requiredActions.push(`Review changes to variable '${fromVar.name}'`);
      }
    });

    // Compare content for major changes
    if (fromTemplate.content !== toTemplate.content) {
      steps.push({
        type: 'content_change',
        description: 'Template content has been updated',
        automatic: true,
      });
    }

    const isBackwardCompatible = requiredActions.length === 0;

    return {
      fromVersion,
      toVersion,
      steps,
      isBackwardCompatible,
      requiredActions,
    };
  }

  /**
   * Show migration plan to user
   */
  private async showMigrationPlan(plan: MigrationPlan): Promise<boolean> {
    const details = [
      `Migration from ${plan.fromVersion} to ${plan.toVersion}`,
      '',
      'Changes:',
      ...plan.steps.map((s) => `• ${s.description}`),
    ];

    if (plan.requiredActions.length > 0) {
      details.push(
        '',
        'Required Actions:',
        ...plan.requiredActions.map((a) => `• ${a}`)
      );
    }

    const result = await vscode.window.showWarningMessage(
      details.join('\n'),
      { modal: true },
      'Proceed with Migration',
      'Cancel'
    );

    return result === 'Proceed with Migration';
  }

  /**
   * Execute migration plan
   */
  private async executeMigration(
    _templateId: string,
    newTemplate: Template,
    plan: MigrationPlan
  ): Promise<void> {
    // Update template in manager
    await this.updateTemplateInManager(newTemplate);

    // Show completion message
    if (plan.requiredActions.length > 0) {
      vscode.window.showWarningMessage(
        `Template updated, but manual actions are required. Check the migration plan for details.`
      );
    } else {
      vscode.window.showInformationMessage('Template updated successfully');
    }
  }

  /**
   * Utility methods
   */

  private isValidVersionFormat(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version);
  }

  private isNewerVersion(newVersion: string, currentVersion: string): boolean {
    return this.compareVersions(newVersion, currentVersion) > 0;
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;

      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }

    return 0;
  }

  private calculateVersionsBehind(
    current: string,
    latest: string,
    versions: TemplateVersion[]
  ): number {
    const versionsInBetween = versions.filter(
      (v) =>
        this.isNewerVersion(v.version, current) &&
        this.compareVersions(v.version, latest) <= 0
    );
    return versionsInBetween.length;
  }

  private suggestNextVersion(currentVersion: string): string {
    const parts = currentVersion.split('.').map(Number);
    parts[2] += 1; // Increment patch version
    return parts.join('.');
  }

  private async detectDeprecatedFeatures(
    _template: Template,
    _history: VersionHistory
  ): Promise<string[]> {
    // This would analyze the template for deprecated patterns
    // For now, return empty array
    return [];
  }

  private async getCurrentUser(): Promise<string> {
    try {
      const config = vscode.workspace.getConfiguration();
      const gitUserName = config.get<string>('git.user.name');
      if (gitUserName) return gitUserName;

      return process.env.USER || process.env.USERNAME || 'Unknown User';
    } catch {
      return 'Unknown User';
    }
  }

  private async saveVersionHistory(
    templateId: string,
    history: VersionHistory
  ): Promise<void> {
    const historyFile = path.join(this.versionsDirectory, `${templateId}.json`);
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
  }

  private async updateTemplateInManager(_template: Template): Promise<void> {
    // This would update the template in the TemplateManager
    // For now, we'll assume it's handled elsewhere
    // In a real implementation, you'd need to provide this functionality
  }
}
