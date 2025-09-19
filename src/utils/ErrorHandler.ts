import * as vscode from 'vscode';
import { LoggingService, LogLevel } from './LoggingService';

export interface ErrorContext {
  operation: string;
  component: string;
  data?: any;
  timestamp: Date;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private logger: LoggingService;
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  };

  private constructor() {
    this.logger = LoggingService.getInstance();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and log errors with appropriate user notifications
   */
  async handleError(error: Error, context: ErrorContext): Promise<void> {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date(),
    };

    // Log the error
    this.logger.log(
      LogLevel.ERROR,
      `Error in ${context.component}.${context.operation}`,
      errorInfo
    );

    // Show user notification based on error type
    await this.showUserNotification(error, context);

    // Report to telemetry if configured
    this.reportToTelemetry(error, context);
  }

  /**
   * Execute a function with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const retryConfig = { ...this.retryConfig, ...config };
    let lastError: Error = new Error('Operation failed');

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.log(
            LogLevel.INFO,
            `Retrying ${context.operation} (attempt ${attempt + 1}/${retryConfig.maxRetries + 1})`
          );
        }

        const result = await operation();

        if (attempt > 0) {
          this.logger.log(
            LogLevel.INFO,
            `${context.operation} succeeded after ${attempt} retries`
          );
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === retryConfig.maxRetries) {
          // Final attempt failed
          this.logger.log(
            LogLevel.ERROR,
            `${context.operation} failed after ${attempt + 1} attempts`,
            {
              error: lastError.message,
              context,
            }
          );
          break;
        }

        // Calculate delay for next retry
        const delay = Math.min(
          retryConfig.baseDelay *
            Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelay
        );

        this.logger.log(
          LogLevel.WARN,
          `${context.operation} failed, retrying in ${delay}ms`,
          {
            error: lastError.message,
            attempt: attempt + 1,
            nextDelay: delay,
          }
        );

        await this.delay(delay);
      }
    }

    // All retries exhausted, handle the error
    await this.handleError(lastError, context);
    throw lastError;
  }

  /**
   * Execute a function with timeout
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    context: ErrorContext
  ): Promise<T> {
    return Promise.race([
      operation(),
      this.createTimeoutPromise<T>(timeoutMs, context),
    ]);
  }

  /**
   * Wrap async operations with comprehensive error handling
   */
  async safeExecute<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options?: {
      retry?: Partial<RetryConfig>;
      timeout?: number;
      fallback?: () => T | Promise<T>;
      suppressNotification?: boolean;
    }
  ): Promise<T | undefined> {
    try {
      let wrappedOperation = operation;

      // Add timeout if specified
      if (options?.timeout) {
        wrappedOperation = () =>
          this.withTimeout(operation, options.timeout!, context);
      }

      // Add retry if specified
      if (options?.retry) {
        return await this.withRetry(wrappedOperation, context, options.retry);
      } else {
        return await wrappedOperation();
      }
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      if (!options?.suppressNotification) {
        await this.handleError(errorObj, context);
      } else {
        // Still log even if notification is suppressed
        this.logger.log(
          LogLevel.ERROR,
          `Error in ${context.component}.${context.operation}`,
          {
            error: errorObj.message,
            context,
          }
        );
      }

      // Try fallback if provided
      if (options?.fallback) {
        try {
          this.logger.log(
            LogLevel.INFO,
            `Using fallback for ${context.operation}`
          );
          return await options.fallback();
        } catch (fallbackError) {
          this.logger.log(
            LogLevel.ERROR,
            `Fallback failed for ${context.operation}`,
            {
              error:
                fallbackError instanceof Error
                  ? fallbackError.message
                  : String(fallbackError),
            }
          );
        }
      }

      return undefined;
    }
  }

  /**
   * Create a user-friendly error message
   */
  createUserFriendlyMessage(error: Error, context: ErrorContext): string {
    // Map common errors to user-friendly messages
    const errorMappings: Record<string, string> = {
      ENOENT: 'File or directory not found',
      EACCES: 'Permission denied',
      ENOTDIR: 'Not a directory',
      EISDIR: 'Is a directory',
      EMFILE: 'Too many open files',
      ENOSPC: 'No space left on device',
      ECONNREFUSED: 'Connection refused',
      ETIMEDOUT: 'Operation timed out',
      ENOTFOUND: 'Network address not found',
    };

    // Check for known error codes
    const errorCode = (error as any).code;
    if (errorCode && errorMappings[errorCode]) {
      return `${errorMappings[errorCode]} while ${context.operation}`;
    }

    // Check for common error patterns
    if (error.message.includes('timeout')) {
      return `Operation timed out while ${context.operation}`;
    }

    if (error.message.includes('permission')) {
      return `Permission error while ${context.operation}`;
    }

    if (error.message.includes('not found')) {
      return `Resource not found while ${context.operation}`;
    }

    // Fall back to original message with context
    return `Error ${context.operation}: ${error.message}`;
  }

  /**
   * Show appropriate user notification
   */
  private async showUserNotification(
    error: Error,
    context: ErrorContext
  ): Promise<void> {
    const userMessage = this.createUserFriendlyMessage(error, context);
    const actions: string[] = [];

    // Add context-specific actions
    if (
      context.operation.includes('file') ||
      context.operation.includes('folder')
    ) {
      actions.push('Open Folder', 'Retry');
    }

    if (context.operation.includes('template')) {
      actions.push('Check Templates', 'Retry');
    }

    if (context.operation.includes('generation')) {
      actions.push('View Logs', 'Retry');
    }

    // Show error with actions
    const selectedAction = await vscode.window.showErrorMessage(
      userMessage,
      ...actions
    );

    // Handle selected action
    if (selectedAction) {
      await this.handleUserAction(selectedAction, error, context);
    }
  }

  /**
   * Handle user actions from error notifications
   */
  private async handleUserAction(
    action: string,
    _error: Error,
    context: ErrorContext
  ): Promise<void> {
    switch (action) {
      case 'Open Folder':
        if (context.data?.folderPath) {
          await vscode.commands.executeCommand(
            'vscode.openFolder',
            vscode.Uri.file(context.data.folderPath)
          );
        }
        break;

      case 'Check Templates':
        await vscode.commands.executeCommand(
          'documentation-generator.openTemplateManager'
        );
        break;

      case 'View Logs':
        this.logger.showOutputChannel();
        break;

      case 'Retry':
        if (context.data?.retryCallback) {
          try {
            await context.data.retryCallback();
          } catch (retryError) {
            this.logger.log(LogLevel.ERROR, 'Retry failed', {
              error: retryError,
            });
          }
        }
        break;

      default:
        this.logger.log(LogLevel.INFO, `Unhandled user action: ${action}`);
        break;
    }
  }

  /**
   * Report error to telemetry
   */
  private reportToTelemetry(error: Error, context: ErrorContext): void {
    // In a real implementation, this would send telemetry data
    // For now, just log for debugging
    this.logger.log(LogLevel.DEBUG, 'Error reported to telemetry', {
      error: {
        message: error.message,
        name: error.name,
        code: (error as any).code,
      },
      context: {
        operation: context.operation,
        component: context.component,
        timestamp: context.timestamp,
      },
    });
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise<T>(
    timeoutMs: number,
    context: ErrorContext
  ): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Operation timed out after ${timeoutMs}ms in ${context.component}.${context.operation}`
          )
        );
      }, timeoutMs);
    });
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
    this.logger.log(
      LogLevel.INFO,
      'Retry configuration updated',
      this.retryConfig
    );
  }

  /**
   * Get current retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }
}
