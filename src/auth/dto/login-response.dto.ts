export class LoginResponseDto {
  accessToken!: string;
  administrador!: {
    id: number;
    nombre: string;
    apellidos: string;
    email: string;
    rol: string;
  };
}
