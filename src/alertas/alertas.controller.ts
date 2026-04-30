import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AlertasService } from './alertas.service';
import {
  CreateAlertaDto,
  UpdateAlertaDto,
  CreateActualizacionDto,
  QueryAlertasDto,
} from './dto';

const multerMemory = { storage: memoryStorage() };

@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD BÁSICO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('imagen', multerMemory))
  async create(
    @UploadedFile() imagen: Express.Multer.File | undefined,
    @Body('data') rawData: string,
    @CurrentAdmin() admin: any,
  ) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      throw new BadRequestException('El campo "data" debe ser un JSON válido.');
    }

    const dto = plainToInstance(CreateAlertaDto, parsed);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: false });
    if (errors.length > 0) {
      const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
      throw new BadRequestException(messages);
    }

    return this.alertasService.create(dto, admin.id, imagen);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: QueryAlertasDto) {
    return this.alertasService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.alertasService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAlertaDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.alertasService.update(id, dto, admin.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: any) {
    return this.alertasService.remove(id, admin.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGEN
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/imagen')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('imagen', multerMemory))
  subirImagen(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() imagen: Express.Multer.File,
    @CurrentAdmin() admin: any,
  ) {
    if (!imagen) {
      throw new BadRequestException('Se requiere un archivo en el campo "imagen".');
    }
    return this.alertasService.subirImagen(id, imagen, admin.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMBIAR ESTATUS
  // ═══════════════════════════════════════════════════════════════════════════

  @Patch(':id/estatus')
  @UseGuards(JwtAuthGuard)
  cambiarEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('estatus') estatus: string,
    @CurrentAdmin() admin: any,
  ) {
    return this.alertasService.cambiarEstatus(id, estatus, admin.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZACIONES (historial)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/actualizaciones')
  @UseGuards(JwtAuthGuard)
  crearActualizacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateActualizacionDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.alertasService.crearActualizacion(id, dto, admin.id);
  }

  @Get(':id/actualizaciones')
  obtenerActualizaciones(@Param('id', ParseIntPipe) id: number) {
    return this.alertasService.obtenerActualizaciones(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONAS (N:M)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/zonas')
  @UseGuards(JwtAuthGuard)
  agregarZona(
    @Param('id', ParseIntPipe) id: number,
    @Body('zonaId', ParseIntPipe) zonaId: number,
    @CurrentAdmin() admin: any,
  ) {
    return this.alertasService.agregarZona(id, zonaId, admin.id);
  }

  @Delete(':id/zonas/:zonaId')
  @UseGuards(JwtAuthGuard)
  removerZona(
    @Param('id', ParseIntPipe) id: number,
    @Param('zonaId', ParseIntPipe) zonaId: number,
    @CurrentAdmin() admin: any,
  ) {
    return this.alertasService.removerZona(id, zonaId, admin.id);
  }
}
