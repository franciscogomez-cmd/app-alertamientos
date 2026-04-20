import { Module } from '@nestjs/common';

import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { OnesignalService } from './onesignal.service';

@Module({
  controllers: [NotificacionesController],
  providers: [OnesignalService, NotificacionesService],
  exports: [NotificacionesService, OnesignalService],
})
export class NotificacionesModule {}
