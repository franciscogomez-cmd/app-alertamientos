import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Cargar .env.local (desarrollo) con fallback a .env
config({ path: '.env.local' });
config({ path: '.env' });

export default defineConfig({
  out: './drizzle',
  schema: './src/database/schema/index.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Incluir ambos schemas: alertas y auditoria
  schemaFilter: ['alertas', 'auditoria'],
  verbose: true,
  strict: true,
});
