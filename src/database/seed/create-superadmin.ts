/**
 * Script para crear el super administrador inicial.
 *
 * Uso:
 *   npx tsx src/database/seed/create-superadmin.ts
 *
 * Solo se ejecuta una vez. Si el email ya existe, no hace nada.
 */
import { hashSync } from 'bcryptjs';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { altAdministradores } from '../schema/administradores';

// Cargar variables de entorno
config({ path: '.env.local' });
config({ path: '.env' });

// ── Datos del super admin ───────────────────────────────────────────────────
const SUPERADMIN = {
  nombre: 'Super',
  apellidos: 'Administrador',
  email: 'admin-alertamientos@sigob.com.mx',
  password: 'Admin2026!',
  rol: 'superadmin',
};

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no está definida. Revisa tu .env.local');
  process.exit(1);
}

async function main() {
  const pgClient = postgres(DATABASE_URL!, { max: 1 });
  const db = drizzle(pgClient);

  try {
    // Verificar si ya existe
    const existing = await db
      .select({ id: altAdministradores.id })
      .from(altAdministradores)
      .where(eq(altAdministradores.email, SUPERADMIN.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`ℹ️  El super admin "${SUPERADMIN.email}" ya existe (id: ${existing[0].id}). No se hizo nada.`);
      return;
    }

    // Hashear password con bcrypt (12 rounds)
    const hashPassword = hashSync(SUPERADMIN.password, 12);

    // Insertar super admin
    const [admin] = await db
      .insert(altAdministradores)
      .values({
        nombre: SUPERADMIN.nombre,
        apellidos: SUPERADMIN.apellidos,
        email: SUPERADMIN.email,
        hashPassword,
        rol: SUPERADMIN.rol,
        activo: true,
      })
      .returning({ id: altAdministradores.id, email: altAdministradores.email });

    console.log('✅ Super admin creado exitosamente:');
    console.log(`   ID:    ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Rol:   ${SUPERADMIN.rol}`);
    console.log(`   Pass:  ${SUPERADMIN.password}`);
    console.log('\n⚠️  Cambia el password después del primer login.');
  } catch (error) {
    console.error('❌ Error creando super admin:', error);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

main();
