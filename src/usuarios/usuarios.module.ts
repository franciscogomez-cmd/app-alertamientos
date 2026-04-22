import { Module } from '@nestjs/common';
import { AlertasModule } from '../alertas/alertas.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';

@Module({
  imports: [NotificacionesModule, AlertasModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule { }
