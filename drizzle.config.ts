import { defineConfig } from 'drizzle-kit';
import path from 'path';

// Use process.cwd() to ensure paths are relative to the project root
// This is essential for packaged applications (like .exe)
const rootDir = process.cwd();

export default defineConfig({
  schema: path.join(rootDir, 'drizzle', 'schema.ts'),
  out: path.join(rootDir, 'drizzle', 'migrations'),
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(rootDir, 'dev.db'),
  },
});
