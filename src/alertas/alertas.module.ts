import { Module } from '@nestjs/common';

import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AlertasService } from './alertas.service';
import { AlertasController } from './alertas.controller';

@Module({
  imports: [NotificacionesModule],
  controllers: [AlertasController],
  providers: [AlertasService],
  exports: [AlertasService],
})
export class AlertasModule {}
