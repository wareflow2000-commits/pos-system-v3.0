import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Determine the best path for the database
const getDbPath = () => {
  // In AI Studio or Linux, always use the project root for simplicity
  if (process.platform !== 'win32') {
    return path.join(process.cwd(), 'dev.db');
  }

  if (process.env.NODE_ENV === 'production') {
    const appDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'SmartPOS');
    if (!fs.existsSync(appDataDir)) {
      fs.mkdirSync(appDataDir, { recursive: true });
    }
    return path.join(appDataDir, 'dev.db');
  }
  return path.join(process.cwd(), 'dev.db');
};

export async function runMigrations() {
  const dbPath = getDbPath();
  console.log('Running migrations on:', dbPath);
  
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  
  // In production (.exe), the migrations folder might be packaged differently
  // We need to ensure we can find it relative to the executable or the current working directory
  let migrationsFolder = path.resolve(process.cwd(), 'drizzle', 'migrations');
  
  // If running from a packaged executable, the path might be different
  if (process.env.NODE_ENV === 'production') {
    // Try to find migrations relative to the executable directory
    const exeDir = path.dirname(process.execPath);
    const exeMigrations = path.join(exeDir, 'drizzle', 'migrations');
    if (fs.existsSync(exeMigrations)) {
      migrationsFolder = exeMigrations;
    }
  }
  
  if (!fs.existsSync(migrationsFolder)) {
    console.error('Migrations folder not found at:', migrationsFolder);
    return;
  }

  console.log('Starting migrate()...');
  migrate(db, { migrationsFolder });
  console.log('migrate() finished.');
  sqlite.close();
  console.log('Migrations applied successfully.');
}
