import * as vscode from 'vscode';
import { EventEmitter } from 'events';

export interface FolderSelectionEvent {
  folderPath: string;
  workspaceName: string;
  timestamp: Date;
  selectionSource: 'contextMenu' | 'sidebar' | 'command' | 'api';
}

export interface TemplateSelectionEvent {
  templateId: string;
  templateName: string;
  category: string;
  timestamp: Date;
  selectionSource: 'ui' | 'api' | 'default';
}

export interface ResourceUpdateEvent {
  resourceType: string;
  resourceUri?: string;
  action: 'created' | 'updated' | 'deleted' | 'refreshed';
  timestamp: Date;
  source: string;
}

export class EventBroadcaster extends EventEmitter {
  private static instance: EventBroadcaster;

  private constructor() {
    super();
  }

  static getInstance(): EventBroadcaster {
    if (!EventBroadcaster.instance) {
      EventBroadcaster.instance = new EventBroadcaster();
    }
    return EventBroadcaster.instance;
  }

  // Folder selection events
  broadcastFolderSelection(event: FolderSelectionEvent): void {
    this.emit('folderSelected', event);
    vscode.commands.executeCommand('setContext', 'documentationGenerator.folderSelected', true);
    vscode.commands.executeCommand('setContext', 'documentationGenerator.selectedFolderPath', event.folderPath);
  }

  onFolderSelection(listener: (event: FolderSelectionEvent) => void): void {
    this.on('folderSelected', listener);
  }

  // Template selection events
  broadcastTemplateSelection(event: TemplateSelectionEvent): void {
    this.emit('templateSelected', event);
    vscode.commands.executeCommand('setContext', 'documentationGenerator.templateSelected', true);
    vscode.commands.executeCommand('setContext', 'documentationGenerator.selectedTemplateId', event.templateId);
  }

  onTemplateSelection(listener: (event: TemplateSelectionEvent) => void): void {
    this.on('templateSelected', listener);
  }

  // Resource update events
  broadcastResourceUpdate(event: ResourceUpdateEvent): void {
    this.emit('resourceUpdated', event);
    this.emit(`resourceUpdated:${event.resourceType}`, event);
  }

  onResourceUpdate(listener: (event: ResourceUpdateEvent) => void): void {
    this.on('resourceUpdated', listener);
  }

  onResourceTypeUpdate(resourceType: string, listener: (event: ResourceUpdateEvent) => void): void {
    this.on(`resourceUpdated:${resourceType}`, listener);
  }

  // Context change events
  broadcastContextChange(contextKey: string, value: any): void {
    this.emit('contextChanged', { contextKey, value, timestamp: new Date() });
    vscode.commands.executeCommand('setContext', contextKey, value);
  }

  onContextChange(listener: (event: { contextKey: string; value: any; timestamp: Date }) => void): void {
    this.on('contextChanged', listener);
  }

  // MCP server events
  broadcastMCPServerEvent(event: 'started' | 'stopped' | 'error' | 'connected' | 'disconnected', data?: any): void {
    this.emit('mcpServerEvent', { event, data, timestamp: new Date() });
    vscode.commands.executeCommand('setContext', 'documentationGenerator.mcpServerStatus', event);
  }

  onMCPServerEvent(listener: (event: { event: string; data?: any; timestamp: Date }) => void): void {
    this.on('mcpServerEvent', listener);
  }

  // Cleanup
  dispose(): void {
    this.removeAllListeners();
  }
}