import * as vscode from 'vscode';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
  component?: string;
}

export class LoggingService {
  private static instance: LoggingService;
  private outputChannel: vscode.OutputChannel;
  private logEntries: LogEntry[] = [];
  private maxLogEntries = 1000;
  private currentLogLevel = LogLevel.INFO;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel(
      'Documentation Generator'
    );
  }

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  /**
   * Log a message with specified level
   */
  log(level: LogLevel, message: string, data?: any, component?: string): void {
    if (level < this.currentLogLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      component,
    };

    // Add to in-memory log
    this.addLogEntry(entry);

    // Write to output channel
    this.writeToOutput(entry);

    // Console logging for development
    this.writeToConsole(entry);
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any, component?: string): void {
    this.log(LogLevel.DEBUG, message, data, component);
  }

  /**
   * Log info message
   */
  info(message: string, data?: any, component?: string): void {
    this.log(LogLevel.INFO, message, data, component);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any, component?: string): void {
    this.log(LogLevel.WARN, message, data, component);
  }

  /**
   * Log error message
   */
  error(message: string, data?: any, component?: string): void {
    this.log(LogLevel.ERROR, message, data, component);
  }

  /**
   * Log the start of an operation
   */
  logOperationStart(operation: string, component: string, data?: any): void {
    this.info(`Starting ${operation}`, data, component);
  }

  /**
   * Log the completion of an operation
   */
  logOperationEnd(
    operation: string,
    component: string,
    duration?: number,
    data?: any
  ): void {
    const message = duration
      ? `Completed ${operation} in ${duration}ms`
      : `Completed ${operation}`;
    this.info(message, data, component);
  }

  /**
   * Log the failure of an operation
   */
  logOperationError(
    operation: string,
    component: string,
    error: Error,
    data?: any
  ): void {
    this.error(
      `Failed ${operation}: ${error.message}`,
      {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        ...data,
      },
      component
    );
  }

  /**
   * Create a performance timer
   */
  createTimer(operation: string, component: string): PerformanceTimer {
    return new PerformanceTimer(operation, component, this);
  }

  /**
   * Show the output channel
   */
  showOutputChannel(): void {
    this.outputChannel.show();
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logEntries = [];
    this.outputChannel.clear();
    this.info('Logs cleared', undefined, 'LoggingService');
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count: number = 50, level?: LogLevel): LogEntry[] {
    let filtered = this.logEntries;

    if (level !== undefined) {
      filtered = this.logEntries.filter((entry) => entry.level >= level);
    }

    return filtered.slice(-count);
  }

  /**
   * Get logs by component
   */
  getLogsByComponent(component: string, count: number = 50): LogEntry[] {
    return this.logEntries
      .filter((entry) => entry.component === component)
      .slice(-count);
  }

  /**
   * Export logs as text
   */
  exportLogs(level?: LogLevel): string {
    let entries = this.logEntries;

    if (level !== undefined) {
      entries = entries.filter((entry) => entry.level >= level);
    }

    return entries.map((entry) => this.formatLogEntry(entry)).join('\n');
  }

  /**
   * Set the current log level
   */
  setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
    this.info(
      `Log level set to ${LogLevel[level]}`,
      undefined,
      'LoggingService'
    );
  }

  /**
   * Get the current log level
   */
  getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }

  /**
   * Add log entry to in-memory storage
   */
  private addLogEntry(entry: LogEntry): void {
    this.logEntries.push(entry);

    // Maintain max entries limit
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.maxLogEntries);
    }
  }

  /**
   * Write log entry to output channel
   */
  private writeToOutput(entry: LogEntry): void {
    const formattedMessage = this.formatLogEntry(entry);
    this.outputChannel.appendLine(formattedMessage);
  }

  /**
   * Write log entry to console (development)
   */
  private writeToConsole(entry: LogEntry): void {
    const formattedMessage = this.formatLogEntry(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, entry.data);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, entry.data);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, entry.data);
        break;
    }
  }

  /**
   * Format log entry for display
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level].padEnd(5);
    const component = entry.component ? `[${entry.component}]` : '';

    let message = `${timestamp} ${level} ${component} ${entry.message}`;

    if (entry.data) {
      message += '\n' + this.formatData(entry.data);
    }

    return message;
  }

  /**
   * Format data for logging
   */
  private formatData(data: any): string {
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return String(data);
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}

/**
 * Performance timer for measuring operation duration
 */
export class PerformanceTimer {
  private startTime: number;
  private endTime?: number;

  constructor(
    private operation: string,
    private component: string,
    private logger: LoggingService
  ) {
    this.startTime = Date.now();
    this.logger.logOperationStart(this.operation, this.component);
  }

  /**
   * End the timer and log the duration
   */
  end(data?: any): number {
    this.endTime = Date.now();
    const duration = this.endTime - this.startTime;

    this.logger.logOperationEnd(this.operation, this.component, duration, data);

    return duration;
  }

  /**
   * End the timer with an error
   */
  error(error: Error, data?: any): number {
    this.endTime = Date.now();
    const duration = this.endTime - this.startTime;

    this.logger.logOperationError(this.operation, this.component, error, {
      duration,
      ...data,
    });

    return duration;
  }

  /**
   * Get the current duration without ending the timer
   */
  getCurrentDuration(): number {
    return Date.now() - this.startTime;
  }
}
