/* =============================================================================
   Declaración REP - Esquema de base de datos (DDL)
   Motor: Azure SQL Database (compatible con SQL Server 2019+)
   Ejecutar una vez sobre una base vacía. Idempotente: no falla si ya existe.
   ============================================================================= */

IF SCHEMA_ID('rep') IS NULL EXEC('CREATE SCHEMA rep');
GO

/* ---------- Seguridad: perfiles, permisos y usuarios ------------------------ */

IF OBJECT_ID('rep.perfil') IS NULL
CREATE TABLE rep.perfil (
  codigo       varchar(20)   NOT NULL CONSTRAINT pk_perfil PRIMARY KEY,
  nombre       nvarchar(50)  NOT NULL,
  descripcion  nvarchar(200) NULL
);

IF OBJECT_ID('rep.permiso') IS NULL
CREATE TABLE rep.permiso (
  codigo       varchar(40)   NOT NULL CONSTRAINT pk_permiso PRIMARY KEY,
  descripcion  nvarchar(100) NOT NULL
);

IF OBJECT_ID('rep.perfil_permiso') IS NULL
CREATE TABLE rep.perfil_permiso (
  perfil_codigo  varchar(20) NOT NULL CONSTRAINT fk_perfil_permiso_perfil REFERENCES rep.perfil (codigo),
  permiso_codigo varchar(40) NOT NULL CONSTRAINT fk_perfil_permiso_permiso REFERENCES rep.permiso (codigo),
  CONSTRAINT pk_perfil_permiso PRIMARY KEY (perfil_codigo, permiso_codigo)
);

/* Sin contraseñas: la autenticación la hace Microsoft Entra ID (login de Azure Static Web Apps).
   Esta tabla solo autoriza: vincula el correo con un perfil. */
IF OBJECT_ID('rep.usuario') IS NULL
CREATE TABLE rep.usuario (
  id             int IDENTITY(1,1) NOT NULL CONSTRAINT pk_usuario PRIMARY KEY,
  email          nvarchar(254) NOT NULL CONSTRAINT uq_usuario_email UNIQUE,
  nombre         nvarchar(100) NOT NULL,
  perfil_codigo  varchar(20)   NOT NULL CONSTRAINT fk_usuario_perfil REFERENCES rep.perfil (codigo),
  activo         bit           NOT NULL CONSTRAINT df_usuario_activo DEFAULT (1),
  creado_en      datetime2(0)  NOT NULL CONSTRAINT df_usuario_creado DEFAULT (SYSUTCDATETIME())
);

/* ---------- Programas REP y sus atributos de clasificación ------------------ */

IF OBJECT_ID('rep.programa') IS NULL
CREATE TABLE rep.programa (
  id         varchar(20)   NOT NULL CONSTRAINT pk_programa PRIMARY KEY,
  nombre     nvarchar(100) NOT NULL,
  agrupador  varchar(30)   NOT NULL,  -- clave de atributo para totales (ej: clase)
  desglose   varchar(30)   NOT NULL   -- clave de atributo para filas del resumen (ej: material)
);

IF OBJECT_ID('rep.programa_atributo') IS NULL
CREATE TABLE rep.programa_atributo (
  programa_id  varchar(20)  NOT NULL CONSTRAINT fk_programa_atributo_programa REFERENCES rep.programa (id),
  clave        varchar(30)  NOT NULL,
  etiqueta     nvarchar(50) NOT NULL,
  orden        tinyint      NOT NULL,
  CONSTRAINT pk_programa_atributo PRIMARY KEY (programa_id, clave)
);

/* ---------- Catálogo: SKU y sus componentes --------------------------------- */

IF OBJECT_ID('rep.sku') IS NULL
CREATE TABLE rep.sku (
  programa_id  varchar(20)  NOT NULL CONSTRAINT fk_sku_programa REFERENCES rep.programa (id),
  sku          nvarchar(50) NOT NULL,
  creado_en    datetime2(0) NOT NULL CONSTRAINT df_sku_creado DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT pk_sku PRIMARY KEY (programa_id, sku)
);

/* Un SKU puede tener varios componentes (botella, tapa, etiqueta...), cada uno con su
   material y peso. Los valores de clasificación se guardan como JSON porque cada programa
   tiene atributos distintos (definidos en rep.programa_atributo). */
IF OBJECT_ID('rep.sku_componente') IS NULL
CREATE TABLE rep.sku_componente (
  id              int IDENTITY(1,1) NOT NULL CONSTRAINT pk_sku_componente PRIMARY KEY,
  programa_id     varchar(20)    NOT NULL,
  sku             nvarchar(50)   NOT NULL,
  nombre          nvarchar(150)  NOT NULL,
  atributos       nvarchar(max)  NOT NULL CONSTRAINT df_sku_componente_atributos DEFAULT (N'{}'),
  peso_kg         decimal(14,6)  NULL,  -- NULL = peso pendiente de ingresar
  actualizado_en  datetime2(0)   NOT NULL CONSTRAINT df_sku_componente_act DEFAULT (SYSUTCDATETIME()),
  actualizado_por int            NULL CONSTRAINT fk_sku_componente_usuario REFERENCES rep.usuario (id),
  CONSTRAINT fk_sku_componente_sku FOREIGN KEY (programa_id, sku) REFERENCES rep.sku (programa_id, sku),
  CONSTRAINT uq_sku_componente UNIQUE (programa_id, sku, nombre),
  CONSTRAINT ck_sku_componente_atributos CHECK (ISJSON(atributos) = 1),
  CONSTRAINT ck_sku_componente_peso CHECK (peso_kg IS NULL OR peso_kg > 0)
);

/* ---------- Importaciones (bitácora) y movimientos -------------------------- */

IF OBJECT_ID('rep.importacion') IS NULL
CREATE TABLE rep.importacion (
  id            bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_importacion PRIMARY KEY,
  programa_id   varchar(20)   NOT NULL CONSTRAINT fk_importacion_programa REFERENCES rep.programa (id),
  tipo          varchar(20)   NOT NULL CONSTRAINT ck_importacion_tipo CHECK (tipo IN ('catalogo', 'movimientos')),
  origen        varchar(20)   NOT NULL CONSTRAINT ck_importacion_origen CHECK (origen IN ('excel', 'sap', 'manual')),
  archivo       nvarchar(260) NULL,
  usuario_id    int           NULL CONSTRAINT fk_importacion_usuario REFERENCES rep.usuario (id),
  creados       int           NOT NULL CONSTRAINT df_importacion_creados DEFAULT (0),
  actualizados  int           NOT NULL CONSTRAINT df_importacion_actualizados DEFAULT (0),
  omitidos      int           NOT NULL CONSTRAINT df_importacion_omitidos DEFAULT (0),
  fecha         datetime2(0)  NOT NULL CONSTRAINT df_importacion_fecha DEFAULT (SYSUTCDATETIME())
);

/* Unidades puestas en el mercado: importaciones (DIN) o ventas. */
IF OBJECT_ID('rep.movimiento') IS NULL
CREATE TABLE rep.movimiento (
  id             bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_movimiento PRIMARY KEY,
  programa_id    varchar(20)   NOT NULL,
  documento      nvarchar(50)  NOT NULL,
  fecha          date          NOT NULL,
  proveedor      nvarchar(150) NOT NULL CONSTRAINT df_movimiento_proveedor DEFAULT (N''),
  sku            nvarchar(50)  NOT NULL,
  unidades       int           NOT NULL,
  importacion_id bigint        NULL CONSTRAINT fk_movimiento_importacion REFERENCES rep.importacion (id),
  CONSTRAINT fk_movimiento_sku FOREIGN KEY (programa_id, sku) REFERENCES rep.sku (programa_id, sku),
  CONSTRAINT uq_movimiento UNIQUE (programa_id, documento, sku),
  CONSTRAINT ck_movimiento_unidades CHECK (unidades > 0)
);
GO

/* Informes: siempre filtran por programa y rango de fechas. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_movimiento_programa_fecha')
  CREATE INDEX ix_movimiento_programa_fecha ON rep.movimiento (programa_id, fecha) INCLUDE (sku, unidades, documento);
GO

/* Vista base de los informes: una fila por movimiento y componente, con los kilos calculados.
   Equivale a calcularInforme() del frontend. */
CREATE OR ALTER VIEW rep.v_informe_kilos AS
SELECT
  m.programa_id,
  m.documento,
  m.fecha,
  m.proveedor,
  m.sku,
  c.id        AS componente_id,
  c.nombre    AS componente,
  c.atributos,
  m.unidades,
  c.peso_kg,
  CAST(m.unidades * ISNULL(c.peso_kg, 0) AS decimal(18,3)) AS kilos
FROM rep.movimiento m
JOIN rep.sku_componente c ON c.programa_id = m.programa_id AND c.sku = m.sku;
GO
