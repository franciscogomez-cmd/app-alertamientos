/**
 * Crea un nuevo administrador en la base de datos.
 *
 * Uso:
 *   npx tsx scripts/create-admin.ts \
 *     --nombre="Juan" \
 *     --apellidos="Pérez" \
 *     --email="juan@ejemplo.com" \
 *     --password="Pass2026!" \
 *     --rol="admin"
 *
 * Roles disponibles: superadmin | admin | editor  (default: editor)
 */
import { hashSync } from 'bcryptjs';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { altAdministradores } from '../src/database/schema/administradores';

config({ path: '.env.local' });
config({ path: '.env' });

const ROLES_VALIDOS = ['superadmin', 'admin', 'editor'] as const;
type Rol = typeof ROLES_VALIDOS[number];

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2)
      .filter((a) => a.startsWith('--'))
      .map((a) => {
        const [key, ...rest] = a.slice(2).split('=');
        return [key, rest.join('=')];
      }),
  );

  const missing = ['nombre', 'apellidos', 'email', 'password'].filter((k) => !args[k]);
  if (missing.length) {
    console.error(`❌ Faltan argumentos requeridos: ${missing.map((m) => `--${m}`).join(', ')}`);
    process.exit(1);
  }

  const rol = (args['rol'] ?? 'editor') as Rol;
  if (!ROLES_VALIDOS.includes(rol)) {
    console.error(`❌ Rol inválido "${rol}". Usa: ${ROLES_VALIDOS.join(' | ')}`);
    process.exit(1);
  }

  return {
    nombre: args['nombre'],
    apellidos: args['apellidos'],
    email: args['email'],
    password: args['password'],
    rol,
  };
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no está definida. Revisa tu .env.local');
  process.exit(1);
}

async function main() {
  const params = parseArgs();
  const pgClient = postgres(DATABASE_URL!, { max: 1 });
  const db = drizzle(pgClient);

  try {
    const existing = await db
      .select({ id: altAdministradores.id })
      .from(altAdministradores)
      .where(eq(altAdministradores.email, params.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`ℹ️  El email "${params.email}" ya está registrado (id: ${existing[0].id}). No se hizo nada.`);
      return;
    }

    const hashPassword = hashSync(params.password, 12);

    const [admin] = await db
      .insert(altAdministradores)
      .values({
        nombre: params.nombre,
        apellidos: params.apellidos,
        email: params.email,
        hashPassword,
        rol: params.rol,
        activo: true,
      })
      .returning({ id: altAdministradores.id, email: altAdministradores.email, rol: altAdministradores.rol });

    console.log('✅ Administrador creado:');
    console.log(`   ID:     ${admin.id}`);
    console.log(`   Nombre: ${params.nombre} ${params.apellidos}`);
    console.log(`   Email:  ${admin.email}`);
    console.log(`   Rol:    ${admin.rol}`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

main();
