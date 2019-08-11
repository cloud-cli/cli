import { existsSync, writeFile, readFileSync } from './io.js';

export class FileStorage<T = any> {
  data: Record<string, T>;
  file: string;

  constructor(name: string) {
    this.file = `storage/${name}.json`;
    this.data = {};

    try {
      if (existsSync(this.file)) {
        const data = readFileSync(this.file);
        this.data = (data && JSON.parse(data)) || {};
      }
    } catch {}
  }

  set(name: string, value: T) {
    this.data[name] = value;
    this.save();
  }

  get(name: string, defaultValue: T | null = null) {
    return this.data[name] || defaultValue;
  }

  getAll() {
    return Object.values(this.data);
  }

  has(name: string) {
    return name in this.data;
  }

  delete(name: string) {
    delete this.data[name];
    this.save();
  }

  private async save() {
    await writeFile(this.file, JSON.stringify(this.data));
  }

  static for(name: string) {
    return new FileStorage(name);
  }
}
