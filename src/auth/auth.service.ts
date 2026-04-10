import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compareSync } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { altAdministradores } from '../database/schema/administradores';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginResponseDto } from './dto/login-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Autentica un administrador por email y password.
   * Retorna un JWT si las credenciales son válidas.
   */
  async login(email: string, password: string): Promise<LoginResponseDto> {
    // Buscar administrador activo por email
    const [admin] = await this.db
      .select({
        id: altAdministradores.id,
        nombre: altAdministradores.nombre,
        apellidos: altAdministradores.apellidos,
        email: altAdministradores.email,
        hashPassword: altAdministradores.hashPassword,
        rol: altAdministradores.rol,
        activo: altAdministradores.activo,
      })
      .from(altAdministradores)
      .where(eq(altAdministradores.email, email.toLowerCase().trim()))
      .limit(1);

    if (!admin) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (!admin.activo) {
      throw new UnauthorizedException('La cuenta está desactivada.');
    }

    // Verificar password
    const isPasswordValid = compareSync(password, admin.hashPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    // Generar JWT
    const payload: JwtPayload = {
      sub: admin.id,
      email: admin.email,
      rol: admin.rol,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      administrador: {
        id: admin.id,
        nombre: admin.nombre,
        apellidos: admin.apellidos,
        email: admin.email,
        rol: admin.rol,
      },
    };
  }

  /**
   * Valida que un admin existe y está activo, usado por JwtStrategy.
   */
  async validateAdmin(adminId: number) {
    const [admin] = await this.db
      .select({
        id: altAdministradores.id,
        nombre: altAdministradores.nombre,
        apellidos: altAdministradores.apellidos,
        email: altAdministradores.email,
        rol: altAdministradores.rol,
        activo: altAdministradores.activo,
      })
      .from(altAdministradores)
      .where(eq(altAdministradores.id, adminId))
      .limit(1);

    if (!admin || !admin.activo) {
      throw new UnauthorizedException('Cuenta no válida o desactivada.');
    }

    return admin;
  }
}
