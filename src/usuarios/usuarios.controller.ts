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
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() query: QueryUsuariosDto) {
    return this.usuariosService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-device/:deviceId')
  findByDeviceId(@Param('deviceId') deviceId: string) {
    return this.usuariosService.findByDeviceId(deviceId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.remove(id);
  }

  // ─── Ubicación ─────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Patch(':id/ubicacion')
  updateUbicacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUbicacionDto,
  ) {
    return this.usuariosService.updateUbicacion(id, dto);
  }

  // ─── Preferencias ──────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Patch(':id/preferencias')
  updatePreferencias(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePreferenciasDto,
  ) {
    return this.usuariosService.updatePreferencias(id, dto);
  }

  // ─── Suscripciones a zonas ─────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get(':id/zonas')
  obtenerZonas(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.obtenerZonasSuscritas(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/zonas')
  suscribirZona(
    @Param('id', ParseIntPipe) id: number,
    @Body('zonaId', ParseIntPipe) zonaId: number,
  ) {
    return this.usuariosService.suscribirZona(id, zonaId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/zonas/:zonaId/toggle')
  toggleZona(
    @Param('id', ParseIntPipe) id: number,
    @Param('zonaId', ParseIntPipe) zonaId: number,
  ) {
    return this.usuariosService.toggleZonaActiva(id, zonaId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/zonas/:zonaId')
  desuscribirZona(
    @Param('id', ParseIntPipe) id: number,
    @Param('zonaId', ParseIntPipe) zonaId: number,
  ) {
    return this.usuariosService.desuscribirZona(id, zonaId);
  }
}
