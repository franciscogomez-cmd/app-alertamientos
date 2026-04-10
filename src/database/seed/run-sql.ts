/**
 * Script para ejecutar SQL complementario contra la base de datos.
 *
 * Uso:
 *   npx tsx src/database/seed/run-sql.ts
 *
 * Ejecuta el archivo complementary.sql que contiene CHECK constraints,
 * índices parciales, triggers, funciones, datos semilla y vistas.
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";

// Cargar variables de entorno
config({ path: ".env.local" });
config({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL no está definida. Revisa tu .env.local");
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL!, { max: 1 });

  try {
    const sqlFile = resolve(__dirname, "complementary.sql");
    const content = readFileSync(sqlFile, "utf-8");

    console.log("⏳ Ejecutando SQL complementario...\n");
    await sql.unsafe(content);
    console.log("✅ SQL complementario ejecutado exitosamente.");
    console.log("   — CHECK constraints aplicados");
    console.log("   — Índices parciales y GIN creados");
    console.log("   — Funciones y triggers creados");
    console.log("   — Datos semilla insertados");
    console.log("   — Vistas creadas");
  } catch (error) {
    console.error("❌ Error ejecutando SQL complementario:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
