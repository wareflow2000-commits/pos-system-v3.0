import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Determine the best path for the database
export const getDbPath = () => {
  // In AI Studio or Linux, always use the project root for simplicity
  if (process.platform !== 'win32') {
    return path.join(process.cwd(), 'dev.db');
  }

  if (process.env.NODE_ENV === 'production') {
    // In production (.exe) on Windows, use the user's AppData directory to ensure write permissions
    const appDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'SmartPOS');
    if (!fs.existsSync(appDataDir)) {
      fs.mkdirSync(appDataDir, { recursive: true });
    }
    return path.join(appDataDir, 'dev.db');
  }
  // In development, use the project root
  return path.join(process.cwd(), 'dev.db');
};

const sqlite = new Database(getDbPath());
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
export const db = drizzle(sqlite, { schema });
