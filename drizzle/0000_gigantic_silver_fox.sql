CREATE SCHEMA "alertas";
--> statement-breakpoint
CREATE SCHEMA "auditoria";
--> statement-breakpoint
CREATE TYPE "alertas"."estatus_alerta_tipo" AS ENUM('borrador', 'activa', 'desactivada', 'expirada', 'cancelada');--> statement-breakpoint
CREATE TYPE "alertas"."estatus_envio_tipo" AS ENUM('pendiente', 'enviada', 'fallida', 'rebotada');--> statement-breakpoint
CREATE TYPE "alertas"."nivel_cobertura_tipo" AS ENUM('pais', 'estado', 'municipio', 'colonia', 'codigo_postal', 'zona_personalizada');--> statement-breakpoint
CREATE TYPE "alertas"."nivel_log_tipo" AS ENUM('debug', 'info', 'warning', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "alertas"."nivel_severidad_tipo" AS ENUM('preventiva', 'emergencia', 'informativa');--> statement-breakpoint
CREATE TYPE "alertas"."plataforma_tipo" AS ENUM('android', 'ios', 'huawei');--> statement-breakpoint
CREATE TYPE "alertas"."tipo_zona_tipo" AS ENUM('pais', 'estado', 'municipio', 'colonia', 'codigo_postal', 'poligono_custom');--> statement-breakpoint
CREATE TABLE "alertas"."alt_actualizaciones_alerta" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alertas"."alt_actualizaciones_alerta_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"alerta_id" bigint NOT NULL,
	"mensaje" text NOT NULL,
	"estatus_anterior" "alertas"."estatus_alerta_tipo",
	"estatus_nuevo" "alertas"."estatus_alerta_tipo" NOT NULL,
	"enviar_push" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"creado_por" integer NOT NULL,
	"eliminado_en" timestamp with time zone,
	"eliminado_por" integer
);
--> statement-breakpoint
CREATE TABLE "alertas"."alt_administradores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alertas"."alt_administradores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(120) NOT NULL,
	"apellidos" varchar(120) NOT NULL,
	"email" varchar(254) NOT NULL,
	"hash_password" varchar(255) NOT NULL,
	"rol" varchar(60) DEFAULT 'editor' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"creado_por" integer,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_por" integer,
	"eliminado_en" timestamp with time zone,
	"eliminado_por" integer,
	CONSTRAINT "uq_alt_administradores_email" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "alertas"."alt_alertas" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alertas"."alt_alertas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"categoria_id" integer NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"descripcion" text NOT NULL,
	"nivel_severidad" "alertas"."nivel_severidad_tipo" NOT NULL,
	"estatus" "alertas"."estatus_alerta_tipo" DEFAULT 'borrador' NOT NULL,
	"fecha_inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"fecha_fin" timestamp with time zone,
	"nivel_cobertura" "alertas"."nivel_cobertura_tipo" NOT NULL,
	"zona_id" integer,
	"centro_latitud" numeric(10, 7),
	"centro_longitud" numeric(10, 7),
	"radio_km" numeric(8, 3),
	"poligono_zona" jsonb,
	"acciones" jsonb,
	"imagen_url" varchar(500),
	"mapa_visible" boolean DEFAULT true NOT NULL,
	"total_enviadas" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"creado_por" integer NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_por" integer,
	"eliminado_en" timestamp with time zone,
	"eliminado_por" integer
);
--> statement-breakpoint
CREATE TABLE "alertas"."alt_alertas_zonas" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alertas"."alt_alertas_zonas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"alerta_id" bigint NOT NULL,
	"zona_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"creado_por" integer,
	"eliminado_en" timestamp with time zone,
	"eliminado_por" integer,
	CONSTRAINT "uq_alt_alerta_zona" UNIQUE("alerta_id","zona_id")
);
--> statement-breakpoint
CREATE TABLE "alertas"."alt_notificaciones_enviadas" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alertas"."alt_notificaciones_enviadas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"alerta_id" bigint NOT NULL,
	"actualizacion_id" bigint,
	"usuario_id" bigint NOT NULL,
	"estatus_envio" "alertas"."estatus_envio_tipo" DEFAULT 'pendiente' NOT NULL,
	"intento_numero" smallint DEFAULT 1 NOT NULL,
	"mensaje_error" text,
	"provider_message_id" varchar(300),
	"latitud_envio" numeric(10, 7),
	"longitud_envio" numeric(10, 7),
	"enviada_en" timestamp with time zone,
	"leida_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alertas"."alt_usuarios" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alertas"."alt_usuarios_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"imei" varchar(20),
	"device_id" varchar(200) NOT NULL,
	"token_push" varchar(500),
	"plataforma" "alertas"."plataforma_tipo" NOT NULL,
	"version_app" varchar(20),
	"modelo_dispositivo" varchar(100),
	"sistema_operativo" varchar(60),
	"latitud" numeric(10, 7),
	"longitud" numeric(10, 7),
	"precision_metros" numeric(8, 2),
	"ubicacion_actualizada_en" timestamp with time zone,
	"codigo_postal" varchar(10),
	"notif_activas" boolean DEFAULT false NOT NULL,
	"gps_activo" boolean DEFAULT false NOT NULL,
	"notif_meteorologicas" boolean DEFAULT true NOT NULL,
	"notif_ultima_hora" boolean DEFAULT true NOT NULL,
	"notif_vialidad" boolean DEFAULT true NOT NULL,
	"notif_servicios" boolean DEFAULT true NOT NULL,
	"silencio_inicio" time,
	"silencio_fin" time,
	"severidad_minima" "alertas"."nivel_severidad_tipo" DEFAULT 'informativa' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone,
	CONSTRAINT "uq_alt_usuarios_device_id" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "alertas"."alt_usuarios_zonas" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alertas"."alt_usuarios_zonas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"usuario_id" bigint NOT NULL,
	"zona_id" integer NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone,
	CONSTRAINT "uq_alt_usuario_zona" UNIQUE("usuario_id","zona_id")
);
--> statement-breakpoint
CREATE TABLE "auditoria"."aud_auditoria_cambios" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auditoria"."aud_auditoria_cambios_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tabla" varchar(100) NOT NULL,
	"operacion" char(6) NOT NULL,
	"registro_id" bigint NOT NULL,
	"datos_anteriores" jsonb,
	"datos_nuevos" jsonb,
	"campos_modificados" text[],
	"administrador_id" integer,
	"usuario_id" bigint,
	"ip_origen" "inet",
	"request_id" varchar(100),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria"."aud_bitacora_errores" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auditoria"."aud_bitacora_errores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nivel" "alertas"."nivel_log_tipo" DEFAULT 'error' NOT NULL,
	"modulo" varchar(100) NOT NULL,
	"operacion" varchar(100),
	"mensaje" text NOT NULL,
	"detalle" jsonb,
	"codigo_error" varchar(60),
	"usuario_id" bigint,
	"administrador_id" integer,
	"entidad" varchar(100),
	"entidad_id" bigint,
	"ip_origen" "inet",
	"request_id" varchar(100),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alertas"."cat_categorias_alerta" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alertas"."cat_categorias_alerta_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(120) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"icono" varchar(120),
	"color_hex" char(7) DEFAULT '#E24B4A' NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"creado_por" integer,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_por" integer,
	"eliminado_en" timestamp with time zone,
	"eliminado_por" integer,
	CONSTRAINT "uq_cat_categorias_slug" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "alertas"."cat_zonas_geograficas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alertas"."cat_zonas_geograficas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(200) NOT NULL,
	"tipo" "alertas"."tipo_zona_tipo" NOT NULL,
	"clave_pais" char(2) DEFAULT 'MX' NOT NULL,
	"clave_estado" char(2),
	"clave_municipio" varchar(3),
	"codigo_postal" varchar(10),
	"centro_latitud" numeric(10, 7),
	"centro_longitud" numeric(10, 7),
	"radio_km" numeric(8, 3),
	"poligono" jsonb,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"creado_por" integer,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_por" integer,
	"eliminado_en" timestamp with time zone,
	"eliminado_por" integer
);
--> statement-breakpoint
ALTER TABLE "alertas"."alt_actualizaciones_alerta" ADD CONSTRAINT "alt_actualizaciones_alerta_alerta_id_alt_alertas_id_fk" FOREIGN KEY ("alerta_id") REFERENCES "alertas"."alt_alertas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_actualizaciones_alerta" ADD CONSTRAINT "alt_actualizaciones_alerta_creado_por_alt_administradores_id_fk" FOREIGN KEY ("creado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_actualizaciones_alerta" ADD CONSTRAINT "alt_actualizaciones_alerta_eliminado_por_alt_administradores_id_fk" FOREIGN KEY ("eliminado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_administradores" ADD CONSTRAINT "alt_administradores_creado_por_alt_administradores_id_fk" FOREIGN KEY ("creado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_administradores" ADD CONSTRAINT "alt_administradores_actualizado_por_alt_administradores_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_administradores" ADD CONSTRAINT "alt_administradores_eliminado_por_alt_administradores_id_fk" FOREIGN KEY ("eliminado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_alertas" ADD CONSTRAINT "alt_alertas_categoria_id_cat_categorias_alerta_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "alertas"."cat_categorias_alerta"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_alertas" ADD CONSTRAINT "alt_alertas_zona_id_cat_zonas_geograficas_id_fk" FOREIGN KEY ("zona_id") REFERENCES "alertas"."cat_zonas_geograficas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_alertas" ADD CONSTRAINT "alt_alertas_creado_por_alt_administradores_id_fk" FOREIGN KEY ("creado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_alertas" ADD CONSTRAINT "alt_alertas_actualizado_por_alt_administradores_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_alertas" ADD CONSTRAINT "alt_alertas_eliminado_por_alt_administradores_id_fk" FOREIGN KEY ("eliminado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_alertas_zonas" ADD CONSTRAINT "alt_alertas_zonas_alerta_id_alt_alertas_id_fk" FOREIGN KEY ("alerta_id") REFERENCES "alertas"."alt_alertas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_alertas_zonas" ADD CONSTRAINT "alt_alertas_zonas_zona_id_cat_zonas_geograficas_id_fk" FOREIGN KEY ("zona_id") REFERENCES "alertas"."cat_zonas_geograficas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_alertas_zonas" ADD CONSTRAINT "alt_alertas_zonas_creado_por_alt_administradores_id_fk" FOREIGN KEY ("creado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_alertas_zonas" ADD CONSTRAINT "alt_alertas_zonas_eliminado_por_alt_administradores_id_fk" FOREIGN KEY ("eliminado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_notificaciones_enviadas" ADD CONSTRAINT "alt_notificaciones_enviadas_alerta_id_alt_alertas_id_fk" FOREIGN KEY ("alerta_id") REFERENCES "alertas"."alt_alertas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_notificaciones_enviadas" ADD CONSTRAINT "alt_notificaciones_enviadas_actualizacion_id_alt_actualizaciones_alerta_id_fk" FOREIGN KEY ("actualizacion_id") REFERENCES "alertas"."alt_actualizaciones_alerta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_notificaciones_enviadas" ADD CONSTRAINT "alt_notificaciones_enviadas_usuario_id_alt_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "alertas"."alt_usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_usuarios_zonas" ADD CONSTRAINT "alt_usuarios_zonas_usuario_id_alt_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "alertas"."alt_usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."alt_usuarios_zonas" ADD CONSTRAINT "alt_usuarios_zonas_zona_id_cat_zonas_geograficas_id_fk" FOREIGN KEY ("zona_id") REFERENCES "alertas"."cat_zonas_geograficas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."cat_categorias_alerta" ADD CONSTRAINT "cat_categorias_alerta_creado_por_alt_administradores_id_fk" FOREIGN KEY ("creado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."cat_categorias_alerta" ADD CONSTRAINT "cat_categorias_alerta_actualizado_por_alt_administradores_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."cat_categorias_alerta" ADD CONSTRAINT "cat_categorias_alerta_eliminado_por_alt_administradores_id_fk" FOREIGN KEY ("eliminado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."cat_zonas_geograficas" ADD CONSTRAINT "cat_zonas_geograficas_creado_por_alt_administradores_id_fk" FOREIGN KEY ("creado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."cat_zonas_geograficas" ADD CONSTRAINT "cat_zonas_geograficas_actualizado_por_alt_administradores_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas"."cat_zonas_geograficas" ADD CONSTRAINT "cat_zonas_geograficas_eliminado_por_alt_administradores_id_fk" FOREIGN KEY ("eliminado_por") REFERENCES "alertas"."alt_administradores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_alt_usuarios_codigo_postal" ON "alertas"."alt_usuarios" USING btree ("codigo_postal");