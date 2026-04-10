import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorador que extrae el administrador autenticado de `req.user`.
 *
 * Uso:
 *   @Get('profile')
 *   @UseGuards(JwtAuthGuard)
 *   getProfile(@CurrentAdmin() admin) { ... }
 */
export const CurrentAdmin = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
