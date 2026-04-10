import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { DRIZZLE, PG_CLIENT } from './database.constants';
import * as schema from './schema';

/**
 * Módulo global de base de datos.
 *
 * Provee la instancia de Drizzle ORM inyectable en toda la aplicación
 * via `@Inject(DRIZZLE)`.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
        return postgres(databaseUrl, {
          max: 10,
          idle_timeout: 20,
          connect_timeout: 10,
        });
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_CLIENT],
      useFactory: (pgClient: postgres.Sql): PostgresJsDatabase<typeof schema> => {
        return drizzle(pgClient, { schema });
      },
    },
  ],
  exports: [DRIZZLE, PG_CLIENT],
})
export class DatabaseModule {}
