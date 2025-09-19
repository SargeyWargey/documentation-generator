import { Resource } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ResourceProvider } from './ResourceManager.js';

export interface GenerationRecord {
  id: string;
  templateId: string;
  templateName: string;
  projectName: string;
  projectPath: string;
  outputPath: string;
  timestamp: Date;
  success: boolean;
  error?: string;
  variables: Record<string, any>;
  metrics?: GenerationMetrics;
}

export interface GenerationMetrics {
  processingTime: number; // milliseconds
  filesAnalyzed: number;
  linesGenerated: number;
  templateVariablesUsed: number;
  outputFileSize: number; // bytes
}

export class RecentGenerationsProvider implements ResourceProvider {
  name = 'recent-generations';
  private generations: GenerationRecord[] = [];
  private readonly maxRecords = 100;
  private readonly persistPath: string;

  constructor() {
    this.persistPath = path.join(os.homedir(), '.documentation-generator', 'generations.json');
    this.loadGenerations();
  }

  async getResources(): Promise<Resource[]> {
    const resources: Resource[] = [];

    // Add summary resource
    resources.push({
      uri: 'generation://summary',
      name: 'Generation Summary',
      description: `Summary of ${this.generations.length} recent documentation generations`,
      mimeType: 'application/json',
    });

    // Add individual generation records
    for (const record of this.generations.slice(0, 20)) { // Limit to 20 most recent
      resources.push({
        uri: `generation://${record.id}`,
        name: `${record.templateName} - ${record.projectName}`,
        description: `Generated on ${record.timestamp.toLocaleDateString()} for ${record.projectName}${record.success ? ' (Success)' : ' (Failed)'}`,
        mimeType: 'application/json',
      });
    }

    // Add metrics resources
    resources.push({
      uri: 'generation://metrics/daily',
      name: 'Daily Generation Metrics',
      description: 'Aggregated metrics for generations in the last 30 days',
      mimeType: 'application/json',
    });

    resources.push({
      uri: 'generation://metrics/templates',
      name: 'Template Usage Metrics',
      description: 'Usage statistics for different templates',
      mimeType: 'application/json',
    });

    return resources;
  }

  async readResource(uri: string): Promise<string> {
    if (uri === 'generation://summary') {
      return JSON.stringify(this.getGenerationSummary(), null, 2);
    }

    if (uri === 'generation://metrics/daily') {
      return JSON.stringify(this.getDailyMetrics(), null, 2);
    }

    if (uri === 'generation://metrics/templates') {
      return JSON.stringify(this.getTemplateUsageMetrics(), null, 2);
    }

    if (uri.startsWith('generation://')) {
      const id = uri.replace('generation://', '');
      const record = this.generations.find(r => r.id === id);

      if (!record) {
        throw new Error(`Generation record not found: ${id}`);
      }

      return JSON.stringify(record, null, 2);
    }

    throw new Error(`Unsupported resource URI: ${uri}`);
  }

  async addRecord(record: GenerationRecord): Promise<void> {
    // Ensure the record has required fields
    if (!record.id) {
      record.id = this.generateId();
    }
    if (!record.timestamp) {
      record.timestamp = new Date();
    }

    this.generations.unshift(record);

    // Keep only the most recent records
    if (this.generations.length > this.maxRecords) {
      this.generations = this.generations.slice(0, this.maxRecords);
    }

    await this.saveGenerations();
  }

  getRecentGenerations(limit: number = 10): GenerationRecord[] {
    return this.generations.slice(0, limit);
  }

  async clearHistory(): Promise<void> {
    this.generations = [];
    await this.saveGenerations();
  }

  async removeRecord(id: string): Promise<boolean> {
    const initialLength = this.generations.length;
    this.generations = this.generations.filter(record => record.id !== id);

    if (this.generations.length < initialLength) {
      await this.saveGenerations();
      return true;
    }
    return false;
  }

  getSuccessRate(): number {
    if (this.generations.length === 0) return 0;
    const successCount = this.generations.filter(record => record.success).length;
    return (successCount / this.generations.length) * 100;
  }

  getMostUsedTemplates(limit: number = 5): Array<{ templateId: string; templateName: string; count: number }> {
    const templateCounts = new Map<string, { templateName: string; count: number }>();

    for (const record of this.generations) {
      const existing = templateCounts.get(record.templateId);
      if (existing) {
        existing.count++;
      } else {
        templateCounts.set(record.templateId, {
          templateName: record.templateName,
          count: 1,
        });
      }
    }

    return Array.from(templateCounts.entries())
      .map(([templateId, data]) => ({
        templateId,
        templateName: data.templateName,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private async loadGenerations(): Promise<void> {
    try {
      const content = await fs.readFile(this.persistPath, 'utf-8');
      const data = JSON.parse(content);

      this.generations = data.map((record: any) => ({
        ...record,
        timestamp: new Date(record.timestamp),
      }));
    } catch (error) {
      // File doesn't exist or is invalid, start with empty array
      this.generations = [];
    }
  }

  private async saveGenerations(): Promise<void> {
    try {
      const dir = path.dirname(this.persistPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.persistPath, JSON.stringify(this.generations, null, 2), 'utf-8');
    } catch (error) {
      console.warn('Failed to save generation history:', error);
    }
  }

  private generateId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getGenerationSummary() {
    const total = this.generations.length;
    const successful = this.generations.filter(r => r.success).length;
    const failed = total - successful;

    const last30Days = this.generations.filter(
      record => Date.now() - record.timestamp.getTime() < 30 * 24 * 60 * 60 * 1000
    );

    const templateUsage = this.getMostUsedTemplates();

    const avgProcessingTime = this.generations
      .filter(r => r.metrics?.processingTime)
      .reduce((sum, r) => sum + (r.metrics!.processingTime || 0), 0) /
      Math.max(1, this.generations.filter(r => r.metrics?.processingTime).length);

    return {
      total,
      successful,
      failed,
      successRate: `${this.getSuccessRate().toFixed(1)}%`,
      last30Days: last30Days.length,
      avgProcessingTime: Math.round(avgProcessingTime),
      mostUsedTemplates: templateUsage,
      oldestRecord: total > 0 ? this.generations[total - 1].timestamp : null,
      newestRecord: total > 0 ? this.generations[0].timestamp : null,
    };
  }

  private getDailyMetrics() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentGenerations = this.generations.filter(
      record => record.timestamp >= thirtyDaysAgo
    );

    const dailyData = new Map<string, {
      date: string;
      total: number;
      successful: number;
      failed: number;
      avgProcessingTime: number;
      totalFilesAnalyzed: number;
    }>();

    // Initialize all days in the last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      dailyData.set(dateKey, {
        date: dateKey,
        total: 0,
        successful: 0,
        failed: 0,
        avgProcessingTime: 0,
        totalFilesAnalyzed: 0,
      });
    }

    // Populate with actual data
    for (const record of recentGenerations) {
      const dateKey = record.timestamp.toISOString().split('T')[0];
      const dayData = dailyData.get(dateKey);

      if (dayData) {
        dayData.total++;
        if (record.success) {
          dayData.successful++;
        } else {
          dayData.failed++;
        }

        if (record.metrics) {
          dayData.avgProcessingTime += record.metrics.processingTime || 0;
          dayData.totalFilesAnalyzed += record.metrics.filesAnalyzed || 0;
        }
      }
    }

    // Calculate averages
    for (const dayData of dailyData.values()) {
      if (dayData.total > 0) {
        dayData.avgProcessingTime = Math.round(dayData.avgProcessingTime / dayData.total);
      }
    }

    return {
      period: '30 days',
      data: Array.from(dailyData.values()).reverse(), // Oldest first
      summary: {
        totalGenerations: recentGenerations.length,
        avgGenerationsPerDay: Math.round(recentGenerations.length / 30),
        peakDay: Array.from(dailyData.values())
          .reduce((max, day) => day.total > max.total ? day : max,
                  { total: 0, date: '' }),
      },
    };
  }

  private getTemplateUsageMetrics() {
    const templateStats = new Map<string, {
      templateId: string;
      templateName: string;
      totalUses: number;
      successfulUses: number;
      failedUses: number;
      avgProcessingTime: number;
      avgFilesAnalyzed: number;
      lastUsed: Date;
    }>();

    for (const record of this.generations) {
      const existing = templateStats.get(record.templateId);

      if (existing) {
        existing.totalUses++;
        if (record.success) {
          existing.successfulUses++;
        } else {
          existing.failedUses++;
        }

        if (record.metrics) {
          existing.avgProcessingTime += record.metrics.processingTime || 0;
          existing.avgFilesAnalyzed += record.metrics.filesAnalyzed || 0;
        }

        if (record.timestamp > existing.lastUsed) {
          existing.lastUsed = record.timestamp;
        }
      } else {
        templateStats.set(record.templateId, {
          templateId: record.templateId,
          templateName: record.templateName,
          totalUses: 1,
          successfulUses: record.success ? 1 : 0,
          failedUses: record.success ? 0 : 1,
          avgProcessingTime: record.metrics?.processingTime || 0,
          avgFilesAnalyzed: record.metrics?.filesAnalyzed || 0,
          lastUsed: record.timestamp,
        });
      }
    }

    // Calculate averages
    for (const stats of templateStats.values()) {
      if (stats.totalUses > 0) {
        stats.avgProcessingTime = Math.round(stats.avgProcessingTime / stats.totalUses);
        stats.avgFilesAnalyzed = Math.round(stats.avgFilesAnalyzed / stats.totalUses);
      }
    }

    return {
      templates: Array.from(templateStats.values())
        .sort((a, b) => b.totalUses - a.totalUses),
      summary: {
        totalTemplatesUsed: templateStats.size,
        mostPopularTemplate: Array.from(templateStats.values())
          .reduce((max, template) => template.totalUses > max.totalUses ? template : max,
                  { totalUses: 0, templateName: 'None' }),
        overallSuccessRate: `${this.getSuccessRate().toFixed(1)}%`,
      },
    };
  }
}