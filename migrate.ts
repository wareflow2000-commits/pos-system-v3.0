import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import fs from 'fs';

export async function runMigrations() {
  const dbPath = path.resolve(process.cwd(), 'dev.db');
  console.log('Running migrations on:', dbPath);
  
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle', 'migrations');
  
  if (!fs.existsSync(migrationsFolder)) {
    console.error('Migrations folder not found at:', migrationsFolder);
    return;
  }

  migrate(db, { migrationsFolder });
  console.log('Migrations applied successfully.');
}
