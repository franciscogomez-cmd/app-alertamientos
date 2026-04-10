/**
 * Payload del JWT emitido al hacer login.
 */
export interface JwtPayload {
  /** ID del administrador (alt_administradores.id) */
  sub: number;
  /** Email del administrador */
  email: string;
  /** Rol: superadmin | admin | editor */
  rol: string;
}
