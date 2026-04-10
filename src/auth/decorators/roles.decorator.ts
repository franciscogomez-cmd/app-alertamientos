import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorador que define los roles permitidos para un endpoint.
 *
 * Uso:
 *   @Roles('superadmin', 'admin')
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   someProtectedRoute() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
