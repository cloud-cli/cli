export class Logger {
  static log(...args: any[]): void {
    console.log(
      JSON.stringify({ name: 'cy', time: Date.now(), message: args.map((t) => JSON.stringify(t)).join(' ') }),
    );
  }
}
