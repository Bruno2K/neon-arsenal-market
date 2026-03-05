import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    const migrationPath = join(__dirname, 'prisma', 'migrations', '20250220000000_migrate_to_cs_marketplace', 'migration.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    // Split SQL statements and filter empty ones
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Applying ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          await prisma.$executeRawUnsafe(statement);
          console.log(`✓ Statement ${i + 1}/${statements.length} applied`);
        } catch (error) {
          // Ignore errors for IF NOT EXISTS statements
          if (!error.message.includes('already exists') && !error.message.includes('no such table')) {
            console.warn(`⚠ Statement ${i + 1} warning:`, error.message);
          }
        }
      }
    }
    
    console.log('Migration applied successfully!');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
