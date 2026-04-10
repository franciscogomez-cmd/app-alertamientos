/**
 * Barrel export del módulo de base de datos.
 */
export { DatabaseModule } from './database.module';
export { DRIZZLE, PG_CLIENT } from './database.constants';
export type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
