import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { UsuariosService } from './usuarios.service';
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  QueryUsuariosDto,
  UpdateUbicacionDto,
  UpdatePreferenciasDto,
} from './dto';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) { }

  // ─── CRUD Básico ───────────────────────────────────────────────────────────

  @Post()
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryUsuariosDto) {
    return this.usuariosService.findAll(query);
  }

  @Get('by-device/:deviceId')
  findByDeviceId(@Param('deviceId') deviceId: string) {
    return this.usuariosService.findByDeviceId(deviceId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.remove(id);
  }

  // ─── Ubicación ─────────────────────────────────────────────────────────────

  @Patch(':id/ubicacion')
  updateUbicacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUbicacionDto,
  ) {
    return this.usuariosService.updateUbicacion(id, dto);
  }

  // ─── Preferencias ──────────────────────────────────────────────────────────

  @Patch(':id/preferencias')
  updatePreferencias(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePreferenciasDto,
  ) {
    return this.usuariosService.updatePreferencias(id, dto);
  }

  // ─── Suscripciones a zonas ─────────────────────────────────────────────────

  @Get(':id/zonas')
  obtenerZonas(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.obtenerZonasSuscritas(id);
  }

  @Post(':id/zonas')
  suscribirZona(
    @Param('id', ParseIntPipe) id: number,
    @Body('zonaId', ParseIntPipe) zonaId: number,
  ) {
    return this.usuariosService.suscribirZona(id, zonaId);
  }

  @Patch(':id/zonas/:zonaId/toggle')
  toggleZona(
    @Param('id', ParseIntPipe) id: number,
    @Param('zonaId', ParseIntPipe) zonaId: number,
  ) {
    return this.usuariosService.toggleZonaActiva(id, zonaId);
  }

  @Delete(':id/zonas/:zonaId')
  desuscribirZona(
    @Param('id', ParseIntPipe) id: number,
    @Param('zonaId', ParseIntPipe) zonaId: number,
  ) {
    return this.usuariosService.desuscribirZona(id, zonaId);
  }
}
