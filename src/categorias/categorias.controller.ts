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
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto, UpdateCategoriaDto, QueryCategoriasDto } from './dto';

@Controller('categorias')
@UseGuards(JwtAuthGuard)
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  create(@Body() dto: CreateCategoriaDto, @CurrentAdmin() admin: any) {
    return this.categoriasService.create(dto, admin.id);
  }

  @Get()
  findAll(@Query() query: QueryCategoriasDto) {
    return this.categoriasService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.categoriasService.update(id, dto, admin.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: any) {
    return this.categoriasService.remove(id, admin.id);
  }

  @Patch(':id/toggle-activo')
  toggleActivo(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: any) {
    return this.categoriasService.toggleActivo(id, admin.id);
  }
}
