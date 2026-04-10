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
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { ZonasService } from './zonas.service';
import { CreateZonaDto, UpdateZonaDto, QueryZonasDto } from './dto';

@Controller('zonas')
@UseGuards(JwtAuthGuard)
export class ZonasController {
  constructor(private readonly zonasService: ZonasService) {}

  @Post()
  create(@Body() dto: CreateZonaDto, @CurrentAdmin() admin: any) {
    return this.zonasService.create(dto, admin.id);
  }

  @Get()
  findAll(@Query() query: QueryZonasDto) {
    return this.zonasService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.zonasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateZonaDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.zonasService.update(id, dto, admin.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: any) {
    return this.zonasService.remove(id, admin.id);
  }

  @Patch(':id/toggle-activo')
  toggleActivo(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: any) {
    return this.zonasService.toggleActivo(id, admin.id);
  }
}
