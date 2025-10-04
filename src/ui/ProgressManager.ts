import * as vscode from 'vscode';

export interface ProgressStep {
  increment?: number;
  message?: string;
}

export interface ProgressOptions {
  location?: vscode.ProgressLocation;
  title?: string;
  cancellable?: boolean;
}

export class ProgressManager {
  private activeProgress: vscode.Progress<{
    message?: string;
    increment?: number;
  }> | null = null;
  private progressToken: vscode.CancellationToken | null = null;

  /**
   * Show progress with automatic progress reporting
   */
  async showProgress<T>(
    title: string,
    task: (
      progress: vscode.Progress<ProgressStep>,
      token: vscode.CancellationToken
    ) => Thenable<T>,
    options?: ProgressOptions
  ): Promise<T> {
    const progressOptions: vscode.ProgressOptions = {
      location: options?.location || vscode.ProgressLocation.Notification,
      title: options?.title || title,
      cancellable: options?.cancellable || false,
    };

    return vscode.window.withProgress(
      progressOptions,
      async (progress, token) => {
        this.activeProgress = progress;
        this.progressToken = token;

        try {
          const result = await task(progress, token);
          this.activeProgress = null;
          this.progressToken = null;
          return result;
        } catch (error) {
          this.activeProgress = null;
          this.progressToken = null;
          throw error;
        }
      }
    );
  }

  /**
   * Show progress in status bar
   */
  async showStatusBarProgress<T>(
    task: (progress: vscode.Progress<ProgressStep>) => Thenable<T>
  ): Promise<T> {
    return this.showProgress('Processing...', task, {
      location: vscode.ProgressLocation.Window,
    });
  }

  /**
   * Show progress as modal dialog
   */
  async showModalProgress<T>(
    title: string,
    task: (
      progress: vscode.Progress<ProgressStep>,
      token: vscode.CancellationToken
    ) => Thenable<T>,
    cancellable: boolean = true
  ): Promise<T> {
    return this.showProgress(title, task, {
      location: vscode.ProgressLocation.Notification,
      cancellable,
    });
  }

  /**
   * Create a stepped progress tracker
   */
  createSteppedProgress(totalSteps: number): SteppedProgress {
    return new SteppedProgress(totalSteps);
  }

  /**
   * Report progress if there's an active progress instance
   */
  report(step: ProgressStep): void {
    if (this.activeProgress) {
      this.activeProgress.report(step);
    }
  }

  /**
   * Check if progress is currently active
   */
  isActive(): boolean {
    return this.activeProgress !== null;
  }

  /**
   * Check if current progress is cancellable and was cancelled
   */
  isCancelled(): boolean {
    return this.progressToken?.isCancellationRequested || false;
  }
}

/**
 * Helper class for managing stepped progress
 */
export class SteppedProgress {
  private currentStep: number = 0;
  private totalSteps: number;
  private stepIncrement: number;

  constructor(totalSteps: number) {
    this.totalSteps = totalSteps;
    this.stepIncrement = 100 / totalSteps;
  }

  /**
   * Move to next step with optional message
   */
  nextStep(message?: string): ProgressStep {
    this.currentStep++;
    const increment =
      this.currentStep <= this.totalSteps ? this.stepIncrement : 0;

    return {
      increment,
      message: message || `Step ${this.currentStep} of ${this.totalSteps}...`,
    };
  }

  /**
   * Set specific step with message
   */
  setStep(step: number, message?: string): ProgressStep {
    if (step < 1 || step > this.totalSteps) {
      throw new Error(`Step ${step} is out of range (1-${this.totalSteps})`);
    }

    const increment = (step - this.currentStep) * this.stepIncrement;
    this.currentStep = step;

    return {
      increment: increment > 0 ? increment : 0,
      message: message || `Step ${step} of ${this.totalSteps}...`,
    };
  }

  /**
   * Get current progress percentage
   */
  getPercentage(): number {
    return (this.currentStep / this.totalSteps) * 100;
  }

  /**
   * Check if all steps are completed
   */
  isComplete(): boolean {
    return this.currentStep >= this.totalSteps;
  }

  /**
   * Reset progress to beginning
   */
  reset(): void {
    this.currentStep = 0;
  }
}

/**
 * Utility functions for common progress patterns
 */
export class ProgressUtils {
  /**
   * Create a progress reporter for file operations
   */
  static createFileProgress(
    files: string[]
  ): (fileIndex: number, fileName: string) => ProgressStep {
    const totalFiles = files.length;
    return (fileIndex: number, fileName: string) => ({
      increment: (1 / totalFiles) * 100,
      message: `Processing ${fileName} (${fileIndex + 1}/${totalFiles})`,
    });
  }

  /**
   * Create a progress reporter for async operations with retry
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    progressReporter?: (attempt: number) => void
  ): Promise<T> {
    let lastError: Error = new Error('Operation failed');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (progressReporter) {
          progressReporter(attempt);
        }
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === maxRetries) {
          throw lastError;
        }
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }

    throw lastError;
  }

  /**
   * Simulate progress for demo purposes
   */
  static async simulateProgress(
    progress: vscode.Progress<ProgressStep>,
    steps: string[],
    delayMs: number = 1000
  ): Promise<void> {
    const stepProgress = new SteppedProgress(steps.length);

    for (const step of steps) {
      progress.report(stepProgress.nextStep(step));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
