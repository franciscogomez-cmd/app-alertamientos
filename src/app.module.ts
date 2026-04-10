import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validate } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AlertasModule } from './alertas/alertas.module';
import { CategoriasModule } from './categorias/categorias.module';
import { ZonasModule } from './zonas/zonas.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Configuración global con validación de env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate,
    }),

    // Base de datos (Drizzle ORM + PostgreSQL)
    DatabaseModule,

    // Autenticación (JWT + Passport)
    AuthModule,

    // Módulos de dominio
    AlertasModule,
    CategoriasModule,
    ZonasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
