const debugEnabled = !!process.env.DEBUG;

export class Logger {
  static log(...args: any[]): void {
    console.log(...args);
  }

  static debug(...args) {
    if (!debugEnabled) return;
    this.log(...args);
  }
}
