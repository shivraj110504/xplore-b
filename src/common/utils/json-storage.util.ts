import { promises as fs } from 'fs';
import * as path from 'path';

export class JsonStorageUtil {
  private static readonly DATA_DIR = path.join(process.cwd(), 'data');

  static async ensureDirectoryExists() {
    try {
      await fs.access(this.DATA_DIR);
    } catch {
      await fs.mkdir(this.DATA_DIR, { recursive: true });
    }
  }

  static async readData<T>(fileName: string): Promise<T | null> {
    const filePath = path.join(this.DATA_DIR, fileName);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      if (!data || data.trim() === '') return null;
      return JSON.parse(data) as T;
    } catch (error: any) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) {
        return null;
      }
      throw error;
    }
  }

  static async writeData<T>(fileName: string, data: T): Promise<void> {
    await this.ensureDirectoryExists();
    const filePath = path.join(this.DATA_DIR, fileName);
    
    let existingData: any = await this.readData(fileName);
    const now = new Date().toISOString();

    const dataToSave = {
      ...(Array.isArray(data) ? { items: data } : data),
      createdAt: existingData?.createdAt || now,
      updatedAt: now,
    };

    await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');
  }
}
