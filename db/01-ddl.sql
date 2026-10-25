/* =============================================================================
   Declaración REP - Esquema de base de datos (DDL)
   Motor: Azure SQL Database (compatible con SQL Server 2019+)
   Ejecutar sobre una base vacía. Idempotente: no falla si ya existe.
   ============================================================================= */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON; -- requerido por los índices filtrados (sqlcmd lo trae apagado)
GO

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

/* ---------- Productos prioritarios (programas REP) --------------------------- */

IF OBJECT_ID('rep.programa') IS NULL
CREATE TABLE rep.programa (
  id          varchar(20)   NOT NULL CONSTRAINT pk_programa PRIMARY KEY,
  nombre      nvarchar(100) NOT NULL,
  orden       tinyint       NOT NULL,
  configurado bit           NOT NULL CONSTRAINT df_programa_configurado DEFAULT (0), -- 0 = aún no disponible en la app
  agrupador   varchar(30)   NULL, -- clave de atributo para totales y metas (ej: categoria)
  desglose    varchar(30)   NULL  -- clave de atributo para filas del resumen (ej: subcategoria)
);

/* Atributos de clasificación de cada programa y sus reglas de validación. */
IF OBJECT_ID('rep.programa_atributo') IS NULL
CREATE TABLE rep.programa_atributo (
  programa_id  varchar(20)   NOT NULL CONSTRAINT fk_programa_atributo_programa REFERENCES rep.programa (id),
  clave        varchar(30)   NOT NULL,
  etiqueta     nvarchar(50)  NOT NULL, -- también es el nombre de la columna en la planilla y en el export
  orden        tinyint       NOT NULL,
  tipo         varchar(10)   NOT NULL CONSTRAINT df_programa_atributo_tipo DEFAULT ('texto'),
  obligatorio  bit           NOT NULL CONSTRAINT df_programa_atributo_oblig DEFAULT (0),
  valores      nvarchar(500) NULL,     -- JSON con los valores permitidos, ej: ["Radial","Diagonal"]
  CONSTRAINT pk_programa_atributo PRIMARY KEY (programa_id, clave),
  CONSTRAINT ck_programa_atributo_tipo CHECK (tipo IN ('texto', 'numero')),
  CONSTRAINT ck_programa_atributo_valores CHECK (valores IS NULL OR ISJSON(valores) = 1)
);

/* Productos prioritarios a los que tiene acceso cada usuario. */
IF OBJECT_ID('rep.usuario_programa') IS NULL
CREATE TABLE rep.usuario_programa (
  usuario_id   int         NOT NULL CONSTRAINT fk_usuario_programa_usuario REFERENCES rep.usuario (id) ON DELETE CASCADE,
  programa_id  varchar(20) NOT NULL CONSTRAINT fk_usuario_programa_programa REFERENCES rep.programa (id),
  CONSTRAINT pk_usuario_programa PRIMARY KEY (usuario_id, programa_id)
);

/* ---------- Sucursales ------------------------------------------------------- */

IF OBJECT_ID('rep.sucursal') IS NULL
CREATE TABLE rep.sucursal (
  codigo  nvarchar(30)  NOT NULL CONSTRAINT pk_sucursal PRIMARY KEY,
  nombre  nvarchar(100) NOT NULL,
  region  nvarchar(60)  NULL -- relevante para las metas regionales de recolección (Cat. A)
);

/* ---------- Catálogo: SKU y sus componentes --------------------------------- */

IF OBJECT_ID('rep.sku') IS NULL
CREATE TABLE rep.sku (
  programa_id  varchar(20)  NOT NULL CONSTRAINT fk_sku_programa REFERENCES rep.programa (id),
  sku          nvarchar(50) NOT NULL,
  creado_en    datetime2(0) NOT NULL CONSTRAINT df_sku_creado DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT pk_sku PRIMARY KEY (programa_id, sku)
);

/* Un SKU puede tener varios componentes (envases: botella, tapa...). Un neumático tiene uno.
   Los valores de clasificación van en JSON porque cada programa tiene atributos distintos.
   peso_kg es el peso VIGENTE: se usa para autocompletar las próximas cargas. */
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
  tipo          varchar(20)   NOT NULL CONSTRAINT ck_importacion_tipo CHECK (tipo IN ('catalogo', 'movimientos', 'ventas')),
  origen        varchar(20)   NOT NULL CONSTRAINT ck_importacion_origen CHECK (origen IN ('excel', 'sap', 'manual')),
  archivo       nvarchar(260) NULL,
  usuario_id    int           NULL CONSTRAINT fk_importacion_usuario REFERENCES rep.usuario (id),
  creados       int           NOT NULL CONSTRAINT df_importacion_creados DEFAULT (0),
  actualizados  int           NOT NULL CONSTRAINT df_importacion_actualizados DEFAULT (0),
  omitidos      int           NOT NULL CONSTRAINT df_importacion_omitidos DEFAULT (0),
  fecha         datetime2(0)  NOT NULL CONSTRAINT df_importacion_fecha DEFAULT (SYSUTCDATETIME())
);

/* Unidades introducidas al mercado: una fila por línea de la planilla de ventas/aduana. */
IF OBJECT_ID('rep.movimiento') IS NULL
CREATE TABLE rep.movimiento (
  id              bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_movimiento PRIMARY KEY,
  programa_id     varchar(20)   NOT NULL,
  id_origen       nvarchar(50)  NULL,      -- ID_Registro de la planilla o línea de SAP: evita duplicar al re-importar
  documento       nvarchar(50)  NOT NULL,  -- DIN
  fecha           date          NOT NULL,  -- fecha de introducción al mercado
  anio_comercial  AS (YEAR(fecha)) PERSISTED,
  sucursal_codigo nvarchar(30)  NULL CONSTRAINT fk_movimiento_sucursal REFERENCES rep.sucursal (codigo),
  proveedor       nvarchar(150) NULL,
  sku             nvarchar(50)  NOT NULL,
  unidades        int           NOT NULL,
  importacion_id  bigint        NULL CONSTRAINT fk_movimiento_importacion REFERENCES rep.importacion (id),
  CONSTRAINT fk_movimiento_sku FOREIGN KEY (programa_id, sku) REFERENCES rep.sku (programa_id, sku),
  CONSTRAINT ck_movimiento_unidades CHECK (unidades > 0)
);

/* Peso CONGELADO de cada componente al momento de la carga. Si después cambia el peso vigente
   del SKU, los kilos ya registrados no cambian. NULL = pendiente: no suma masa hasta ingresarlo. */
IF OBJECT_ID('rep.movimiento_componente') IS NULL
CREATE TABLE rep.movimiento_componente (
  movimiento_id  bigint        NOT NULL CONSTRAINT fk_mov_comp_movimiento REFERENCES rep.movimiento (id) ON DELETE CASCADE,
  componente_id  int           NOT NULL CONSTRAINT fk_mov_comp_componente REFERENCES rep.sku_componente (id),
  peso_kg        decimal(14,6) NULL CONSTRAINT ck_mov_comp_peso CHECK (peso_kg IS NULL OR peso_kg > 0),
  CONSTRAINT pk_movimiento_componente PRIMARY KEY (movimiento_id, componente_id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_movimiento_origen')
  CREATE UNIQUE INDEX ux_movimiento_origen ON rep.movimiento (programa_id, id_origen) WHERE id_origen IS NOT NULL;
/* Sin id de origen, la misma línea se reconoce por DIN + SKU + fecha + sucursal. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_movimiento_natural')
  CREATE UNIQUE INDEX ux_movimiento_natural ON rep.movimiento (programa_id, documento, sku, fecha, sucursal_codigo) WHERE id_origen IS NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_movimiento_programa_fecha')
  CREATE INDEX ix_movimiento_programa_fecha ON rep.movimiento (programa_id, fecha) INCLUDE (sku, unidades, documento, sucursal_codigo);
GO

/* ---------- Parámetros legales y financieros --------------------------------- */

/* Metas del decreto por programa, categoría y tipo. Cada fila rige desde anio_desde
   hasta la siguiente (la de 2030 rige "2030 en adelante"). Porcentaje sobre lo introducido el año anterior. */
IF OBJECT_ID('rep.meta_legal') IS NULL
CREATE TABLE rep.meta_legal (
  programa_id  varchar(20)   NOT NULL CONSTRAINT fk_meta_legal_programa REFERENCES rep.programa (id),
  categoria    nvarchar(50)  NOT NULL,
  tipo_meta    varchar(20)   NOT NULL CONSTRAINT ck_meta_legal_tipo CHECK (tipo_meta IN ('recoleccion', 'valorizacion')),
  anio_desde   smallint      NOT NULL,
  porcentaje   decimal(5,4)  NOT NULL CONSTRAINT ck_meta_legal_pct CHECK (porcentaje BETWEEN 0 AND 1),
  CONSTRAINT pk_meta_legal PRIMARY KEY (programa_id, categoria, tipo_meta, anio_desde)
);

/* Parámetros con vigencia (factor de desgaste, IVA...). Se usa el de vigente_desde más reciente. */
IF OBJECT_ID('rep.parametro') IS NULL
CREATE TABLE rep.parametro (
  programa_id    varchar(20)    NOT NULL CONSTRAINT fk_parametro_programa REFERENCES rep.programa (id),
  clave          varchar(40)    NOT NULL,
  vigente_desde  date           NOT NULL,
  valor          decimal(18,6)  NOT NULL,
  descripcion    nvarchar(200)  NULL,
  CONSTRAINT pk_parametro PRIMARY KEY (programa_id, clave, vigente_desde)
);

/* Precio por kilo del servicio de gestión (CLP), según cada compra o contrato. Ingreso manual. */
IF OBJECT_ID('rep.tarifa_gestion') IS NULL
CREATE TABLE rep.tarifa_gestion (
  id             int IDENTITY(1,1) NOT NULL CONSTRAINT pk_tarifa_gestion PRIMARY KEY,
  programa_id    varchar(20)    NOT NULL CONSTRAINT fk_tarifa_programa REFERENCES rep.programa (id),
  categoria      nvarchar(50)   NOT NULL,
  fecha          date           NOT NULL,  -- fecha de la compra o del contrato
  precio_kg_clp  decimal(14,2)  NOT NULL CONSTRAINT ck_tarifa_precio CHECK (precio_kg_clp > 0),
  gestor         nvarchar(150)  NULL,      -- sistema de gestión o gestor que presta el servicio
  documento      nvarchar(100)  NULL,      -- orden de compra, contrato o factura
  observacion    nvarchar(500)  NULL,
  creado_por     int            NULL CONSTRAINT fk_tarifa_usuario REFERENCES rep.usuario (id),
  creado_en      datetime2(0)   NOT NULL CONSTRAINT df_tarifa_creado DEFAULT (SYSUTCDATETIME())
);

/* Kilos gestionados (recolectados / valorizados) informados por GRANSIC, SISREP u otros. Ingreso manual. */
IF OBJECT_ID('rep.gestion') IS NULL
CREATE TABLE rep.gestion (
  id           int IDENTITY(1,1) NOT NULL CONSTRAINT pk_gestion PRIMARY KEY,
  programa_id  varchar(20)    NOT NULL CONSTRAINT fk_gestion_programa REFERENCES rep.programa (id),
  anio         smallint       NOT NULL,  -- año de la meta que se está cumpliendo
  categoria    nvarchar(50)   NOT NULL,
  tipo_meta    varchar(20)    NOT NULL CONSTRAINT ck_gestion_tipo CHECK (tipo_meta IN ('recoleccion', 'valorizacion')),
  kilos        decimal(14,3)  NOT NULL CONSTRAINT ck_gestion_kilos CHECK (kilos > 0),
  fuente       varchar(20)    NOT NULL CONSTRAINT ck_gestion_fuente CHECK (fuente IN ('GRANSIC', 'SISREP', 'otro')),
  fecha        date           NULL,      -- fecha del certificado o informe
  documento    nvarchar(100)  NULL,      -- n° de certificado o informe
  sku          nvarchar(50)   NULL,      -- opcional, si el certificado lo detalla
  observacion  nvarchar(500)  NULL,
  creado_por   int            NULL CONSTRAINT fk_gestion_usuario REFERENCES rep.usuario (id),
  creado_en    datetime2(0)   NOT NULL CONSTRAINT df_gestion_creado DEFAULT (SYSUTCDATETIME())
);
GO

/* ---------- Vistas ----------------------------------------------------------- */

/* Base de los informes: una fila por movimiento y componente, con la masa calculada
   desde el peso congelado. Peso NULL => kilos NULL (pendiente, no suma). */
CREATE OR ALTER VIEW rep.v_informe_kilos AS
SELECT
  m.programa_id,
  m.id                 AS movimiento_id,
  m.id_origen,
  m.documento,
  m.fecha,
  m.anio_comercial,
  m.sucursal_codigo,
  s.nombre             AS sucursal,
  m.proveedor,
  m.sku,
  c.id                 AS componente_id,
  c.nombre             AS componente,
  c.atributos,
  m.unidades,
  mc.peso_kg,
  CAST(m.unidades * mc.peso_kg AS decimal(18,3))          AS kilos,
  CAST(m.unidades * mc.peso_kg / 1000 AS decimal(18,6))   AS toneladas
FROM rep.movimiento m
JOIN rep.movimiento_componente mc ON mc.movimiento_id = m.id
JOIN rep.sku_componente c ON c.id = mc.componente_id
LEFT JOIN rep.sucursal s ON s.codigo = m.sucursal_codigo;
GO

/* Neumáticos con los nombres de columna exactos de la especificación (tabla Datos_REP),
   para conectar Power BI directamente a la base sin cambiar sus fórmulas DAX. */
CREATE OR ALTER VIEW rep.v_datos_rep AS
SELECT
  v.movimiento_id                              AS ID_Registro,
  v.id_origen                                  AS ID_Origen,
  v.fecha                                      AS Fecha_Introduccion,
  v.anio_comercial                             AS [Año_Comercial],
  v.documento                                  AS DIN,
  v.sku                                        AS SKU,
  JSON_VALUE(v.atributos, '$.marca')           AS Marca,
  JSON_VALUE(v.atributos, '$.tipo')            AS Tipo,
  JSON_VALUE(v.atributos, '$.categoria')       AS [Categoría],
  JSON_VALUE(v.atributos, '$.subcategoria')    AS [Subcategoría],
  TRY_CAST(JSON_VALUE(v.atributos, '$.aro') AS decimal(4,1)) AS Aro,
  JSON_VALUE(v.atributos, '$.dimension')       AS [Dimensión],
  v.sucursal                                   AS Sucursal,
  v.peso_kg                                    AS Peso_Unitario_KG,
  v.unidades                                   AS Unidades,
  v.kilos                                      AS Kilos_Introducidos,
  v.toneladas                                  AS Toneladas_Introducidas
FROM rep.v_informe_kilos v
WHERE v.programa_id = 'neu';
GO
