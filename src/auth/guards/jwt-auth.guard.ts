import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard que valida el JWT en el header Authorization: Bearer <token>.
 * Usar con @UseGuards(JwtAuthGuard) en controllers o rutas.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
