export class Logger {
  constructor(private name: string) {}

  info(message: string, ...args: any[]): void {
    console.error(`[${new Date().toISOString()}] [${this.name}] INFO: ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.error(`[${new Date().toISOString()}] [${this.name}] WARN: ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${new Date().toISOString()}] [${this.name}] ERROR: ${message}`, ...args);
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.DEBUG) {
      console.error(`[${new Date().toISOString()}] [${this.name}] DEBUG: ${message}`, ...args);
    }
  }
}