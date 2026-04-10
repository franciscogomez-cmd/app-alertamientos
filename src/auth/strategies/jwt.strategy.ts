import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthService } from '../auth.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Estrategia Passport que valida el JWT y carga el admin en req.user.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Llamado automáticamente por Passport después de verificar el JWT.
   * Lo que retorne se asigna a `req.user`.
   */
  async validate(payload: JwtPayload) {
    const admin = await this.authService.validateAdmin(payload.sub);
    if (!admin) {
      throw new UnauthorizedException();
    }
    return admin;
  }
}
