import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPMessage {
  jsonrpc: string;
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: {
    resources?: boolean;
    tools?: boolean;
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export class MCPClient extends EventEmitter {
  private serverProcess: ChildProcess | null = null;
  private messageId = 0;
  private pendingRequests = new Map<
    string | number,
    { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
  >();
  private isInitialized = false;
  private buffer = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000; // Start with 1 second
  private isReconnecting = false;

  constructor(
    private serverPath: string,
    private serverArgs: string[] = []
  ) {
    super();
  }

  async start(): Promise<void> {
    if (this.serverProcess) {
      throw new Error('MCP server is already running');
    }

    return new Promise((resolve, reject) => {
      try {
        this.serverProcess = spawn(
          'node',
          [this.serverPath, ...this.serverArgs],
          {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
          }
        );

        this.serverProcess.stdout?.on('data', (data) => {
          this.handleServerMessage(data.toString());
        });

        this.serverProcess.stderr?.on('data', (data) => {
          console.error('MCP Server stderr:', data.toString());
        });

        this.serverProcess.on('error', (error) => {
          this.emit('error', error);
          reject(error);
        });

        this.serverProcess.on('exit', (code, signal) => {
          this.emit('exit', code, signal);
          this.cleanup();

          // Attempt reconnection if exit was unexpected
          if (
            code !== 0 &&
            !this.isReconnecting &&
            this.reconnectAttempts < this.maxReconnectAttempts
          ) {
            this.attemptReconnection();
          }
        });

        // Wait a bit for the server to start
        setTimeout(() => {
          this.initialize()
            .then(() => resolve())
            .catch(reject);
        }, 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.serverProcess) {
      return;
    }

    return new Promise((resolve) => {
      if (this.serverProcess) {
        this.serverProcess.once('exit', () => {
          resolve();
        });
        this.serverProcess.kill();
      } else {
        resolve();
      }
    });
  }

  private async initialize(): Promise<void> {
    const initParams: MCPInitializeParams = {
      protocolVersion: '2024-11-05',
      capabilities: {
        resources: true,
      },
      clientInfo: {
        name: 'Documentation Generator',
        version: '1.0.0',
      },
    };

    const response = await this.sendRequest('initialize', initParams);
    this.isInitialized = true;
    this.emit('initialized', response);
  }

  async listResources(): Promise<MCPResource[]> {
    if (!this.isInitialized) {
      throw new Error('MCP client not initialized');
    }

    const response = await this.sendRequest('resources/list');
    return response.resources || [];
  }

  async readResource(uri: string): Promise<{ contents: any }> {
    if (!this.isInitialized) {
      throw new Error('MCP client not initialized');
    }

    return await this.sendRequest('resources/read', { uri });
  }

  private sendRequest(
    method: string,
    params?: any,
    retries: number = 2
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.serverProcess || !this.serverProcess.stdin) {
        if (retries > 0 && !this.isReconnecting) {
          // Try to reconnect and retry
          this.attemptReconnection()
            .then(() => {
              return this.sendRequest(method, params, retries - 1);
            })
            .then(resolve)
            .catch(reject);
          return;
        }
        reject(new Error('MCP server not running'));
        return;
      }

      const id = ++this.messageId;
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      // Set timeout for requests
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          if (retries > 0) {
            // Retry the request
            this.sendRequest(method, params, retries - 1)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error(`Request timeout for method: ${method}`));
          }
        }
      }, 30000); // 30 second timeout

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        const messageStr = JSON.stringify(message) + '\n';
        this.serverProcess.stdin.write(messageStr);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        if (retries > 0) {
          this.sendRequest(method, params, retries - 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(error);
        }
      }
    });
  }

  private handleServerMessage(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message: MCPMessage = JSON.parse(line);
          this.processMessage(message);
        } catch (error) {
          console.error('Failed to parse MCP message:', line, error);
        }
      }
    }
  }

  private processMessage(message: MCPMessage): void {
    if (message.id !== undefined) {
      // Response to a request
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    } else if (message.method) {
      // Notification from server
      this.emit('notification', message.method, message.params);
    }
  }

  private cleanup(): void {
    this.serverProcess = null;
    this.isInitialized = false;

    // Clear all pending requests with timeouts
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('MCP client disconnected'));
    }
    this.pendingRequests.clear();
    this.buffer = '';
  }

  private async attemptReconnection(): Promise<void> {
    if (this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    this.emit('reconnecting', this.reconnectAttempts);

    try {
      // Wait before attempting reconnection (exponential backoff)
      const delay =
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      await this.start();
      this.reconnectAttempts = 0; // Reset on successful reconnection
      this.emit('reconnected');
    } catch (error) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.emit('reconnectionFailed', error);
      } else {
        // Try again
        setTimeout(() => this.attemptReconnection(), 1000);
      }
    } finally {
      this.isReconnecting = false;
    }
  }

  // Public method to trigger manual reconnection
  async reconnect(): Promise<void> {
    if (this.serverProcess) {
      await this.stop();
    }
    this.reconnectAttempts = 0;
    await this.start();
  }

  isRunning(): boolean {
    return this.serverProcess !== null && !this.serverProcess.killed;
  }

  getConnectionStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    isReconnecting: boolean;
  } {
    return {
      connected: this.isRunning() && this.isInitialized,
      reconnectAttempts: this.reconnectAttempts,
      isReconnecting: this.isReconnecting,
    };
  }
}
