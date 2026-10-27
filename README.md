# rep-demo-api

API de **Declaración REP**. Backend del frontend [`rep-demo-front`](../rep-demo-front).

**NestJS 12 · Azure SQL · Azure Container Apps**

```
Usuario ──login──▶ Microsoft Entra ID ──JWT──▶ rep-demo-front (Static Web App, Free)
                                                    │  Authorization: Bearer <JWT>  (CORS)
                                                    ▼
                                    rep-demo-api (Container App)  ──Managed Identity──▶  Azure SQL (serverless)
                                    valida el JWT, permisos y datos                     permisos en rep.perfil_permiso
```

## Estructura

```
src/
├── main.ts / app.module.ts   arranque: prefijo /api, validación global, guard global
├── auth/                     AuthGuard (sesión + permisos), @RequierePermiso(), @Publico(), @UsuarioAutenticado()
├── database/                 pool de conexiones a SQL (cadena de conexión o Managed Identity)
├── dominio/models.ts         modelos compartidos con el frontend (misma forma JSON)
├── importacion.ts            reglas comunes de importación (máx. filas, todo o nada)
├── usuarios/  programas/     controller → repository  (lecturas simples)
├── skus/  movimientos/       controller → service → repository  (con reglas de negocio)
├── gestion/                  kilos gestionados, tarifas, metas y parámetros
├── dominio/atributos.ts      validación de atributos y reglas por producto (DS 8: categoría según aro)
└── health.controller.ts      /api/health para Container Apps (no toca la base)
db/                           DDL, datos maestros, datos de ejemplo y consultas de indicadores (ver db/README.md)
```

**Capas:**
- **Controller:** HTTP y permisos.
- **Service:** reglas de negocio y validaciones que dependen de datos.
- **Repository:** SQL parametrizado, sin concatenar texto.

## Endpoints

Todas las rutas con `:id` de programa exigen además que el usuario tenga **acceso a ese producto prioritario** (`rep.usuario_programa`).

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/api/health` | público | Sonda de vida |
| GET | `/api/usuarios/me` | sesión | Usuario actual, permisos y productos prioritarios |
| GET | `/api/usuarios` | `usuarios.ver` | Lista de usuarios |
| GET | `/api/programas` | sesión | Los 6 productos prioritarios, con `acceso` y `configurado` |
| POST | `/api/ventas/importar` | `sku.importar` | **Importación unificada** (planilla de ventas / aduana): crea SKUs y registra unidades |
| GET | `/api/programas/:id/movimientos` | `informes.ver` | Registros con su peso congelado por componente |
| GET | `/api/programas/:id/export/datos.csv` | `informes.exportar` | CSV para Power BI (columnas de la especificación) |
| GET | `/api/programas/:id/skus` | `informes.ver` | Componentes de SKU con su peso vigente |
| POST | `/api/skus/importar` | `sku.importar` | Catálogo con componentes (envases: botella, tapa...) |
| PATCH | `/api/skus/:id` | `sku.pesos` | Ingresa el peso `{ "pesoKg": 9.1 }` y completa los registros pendientes |
| GET | `/api/programas/:id/gestion` | `informes.ver` | Kilos gestionados (GRANSIC / SISREP) |
| POST / DELETE | `/api/gestion`, `/api/gestion/:id` | `gestion.ingresar` | Ingreso manual de kilos gestionados |
| GET | `/api/programas/:id/tarifas` | `informes.ver` | Tarifas de gestión (CLP/kg) |
| POST / DELETE | `/api/tarifas`, `/api/tarifas/:id` | `gestion.ingresar` | Ingreso manual de tarifas por compra |
| GET | `/api/programas/:id/metas` | `informes.ver` | Metas del DS 8 por categoría, tipo y año |
| GET | `/api/programas/:id/parametros` | `informes.ver` | Factor de desgaste, IVA (con vigencia) |

**Importación de ventas (`POST /api/ventas/importar`):**
- **Cuerpo:** arreglo de filas `{ programaId, idOrigen?, documento (DIN), fecha, sucursal?, proveedor?, sku, descripcion?, atributos?, unidades, pesoKg? }`.
- **SKU nuevo:** se crea; debe traer todos los atributos obligatorios del programa.
- **SKU existente:** los atributos son opcionales y se actualizan con los que vengan.
- **Peso de cada registro:** el de la planilla; si no viene, el vigente del SKU; si tampoco hay, queda **pendiente** (no suma masa) y se informa en `pendientesPeso`.
- **Re-importar:** con `idOrigen` se actualiza el mismo registro; sin él, se reconoce por DIN + SKU + fecha + sucursal.
- **Advertencias (no bloquean):** categoría que no corresponde al aro según el DS 8 (A bajo 57", B desde 57"), o peso de la planilla distinto del vigente.

**Reglas de las importaciones:**
- **Todo o nada:** si alguna fila tiene errores, no se guarda ninguna y se responde `400` con la lista `errores: [{ fila, mensaje }]`.
- **Bitácora:** cada carga queda registrada en `rep.importacion` con su usuario.

**Respuestas de autorización:**
- Sin sesión → `401`.
- Token inválido, expirado, de otra aplicación o sin el permiso `access_as_user` → `401`.
- Correo que no está dado de alta en `rep.usuario` → `403`.
- Usuario sin el permiso que exige el endpoint, o sin acceso al producto prioritario → `403`.

**Power BI:** *Obtener datos → Texto/CSV* con la URL de export, o conexión directa a Azure SQL sobre la vista `rep.v_datos_rep`. El CSV usa coma como separador y punto decimal; si Power BI está en español, elige *Configuración regional: Inglés* al importar.

## Desarrollo local

Requisitos: **Node 22+** y **Docker**. El repo trae `.nvmrc`: en cada terminal nueva ejecuta `nvm use` dentro de la carpeta (si tu Node por defecto es más antiguo, verás errores como *Unexpected token 'with'*).

```bash
cp .env.example .env        # define MSSQL_SA_PASSWORD (y DEV_USER_EMAIL si quieres otro usuario)
```

**Todo con Docker** (SQL Server + carga de datos + API):
```bash
docker compose up --build
```

**API con recarga automática** (SQL en Docker, API local): en `.env`, `SQL_CONNECTION_STRING` debe usar la misma contraseña de `sa`. La contraseña no puede contener `;`.
```bash
docker compose up -d sql db-init
```
```bash
npm install
```
```bash
npm run start:dev
```

API en `http://localhost:3000/api`. Las peticiones **sin token** usan el usuario de `DEV_USER_EMAIL` (cómodo para probar con curl); se ignora con `NODE_ENV=production`. Las peticiones con `Authorization: Bearer <JWT>` se validan igual que en Azure: así funciona el front local en modo `api`.

```bash
curl http://localhost:3000/api/usuarios/me
```

**Pruebas:**
```bash
npm test
```

> Con npm 10 la instalación puede fallar por un bug de npm con las dependencias de Vitest. Usa npm 11: `npx npm@11 install`.

### Desarrollo local contra la base de Azure

Para usar la base real en vez de la de Docker, la API entra con **tu cuenta de Microsoft**, igual que en Azure lo hace con Managed Identity: sin contraseñas.

Requisitos: tu cuenta debe ser *Microsoft Entra admin* del servidor (o un usuario creado con `FROM EXTERNAL PROVIDER`) y tu IP debe estar en el firewall del servidor.

1. Instalar la Azure CLI e iniciar sesión (una vez; la sesión dura semanas):
   ```bash
   brew install azure-cli
   ```
   ```bash
   az login
   ```
2. En `.env`, deja `SQL_CONNECTION_STRING` vacío y define el servidor y la base, por ejemplo:
   ```
   SQL_SERVER=sql-rep-demo.database.windows.net
   SQL_DATABASE=free-sql-db-rep-demo
   DEV_USER_EMAIL=<un correo dado de alta en rep.usuario>
   ```
   Ojo: con la oferta gratuita, Azure le pone a la base un nombre como `free-sql-db-...`, que no es el que se escribió al crearla. Lo ves en el portal o con `az sql db list -s <servidor> -g <grupo> -o table`. `rep` es el esquema, no la base.
3. Levanta la API:
   ```bash
   npm run start:dev
   ```
   La primera consulta puede tardar unos segundos si la base estaba en pausa.

## Variables de entorno

| Variable | Uso |
|---|---|
| `SQL_CONNECTION_STRING` | Cadena de conexión completa (local, o usuario SQL). Si está definida, tiene prioridad. |
| `SQL_SERVER`, `SQL_DATABASE` | Conexión con **Managed Identity** en Azure, o con tu cuenta (`az login`) en local. Sin contraseña. |
| `AZURE_CLIENT_ID` | Solo si usas una identidad asignada por el usuario. |
| `AUTH_CLIENT_ID` | Client ID de la app "rep-demo" en Microsoft Entra ID: audiencia que se exige en el JWT. |
| `CORS_ORIGINS` | Orígenes del front autorizados, separados por coma. |
| `DEV_USER_EMAIL` | Usuario simulado cuando la petición llega sin token (solo desarrollo; se ignora con `NODE_ENV=production`). |
| `PORT` | Puerto HTTP (por defecto 3000). |

## Despliegue en Azure (costo cero)

Recursos actuales, todos en el grupo `rg-rep-demo`:

| Recurso | Nombre | Notas |
|---|---|---|
| App en Microsoft Entra ID | `rep-demo` (client ID `b298bb74-9588-41c9-89fc-7034f0b388c0`) | Emite los JWT. Acepta cualquier cuenta Microsoft; quién entra lo decide `rep.usuario`. Scope `api://<client-id>/access_as_user`. |
| Imagen | `ghcr.io/jsaavedrav/rep-demo-api` (pública) | La publica el workflow `.github/workflows/imagen.yml` en cada push a `main`, después de correr las pruebas. |
| Entorno de Container Apps | `cae-rep-demo` (Brazil South) | Sin destino de logs (costo cero). |
| Container App | `rep-api` | `https://rep-api.lemondesert-1bad17fd.brazilsouth.azurecontainerapps.io`. Escala a cero; identidad asignada por el sistema. |
| Usuario SQL | `rep-api` | Creado por SID para la identidad de la Container App; solo lectura y escritura sobre el esquema `rep`. |

### Publicar una nueva versión
1. Push a `main`. El workflow prueba, construye y publica `ghcr.io/jsaavedrav/rep-demo-api:latest` y `:<sha>`.
2. Cuando termine en verde, actualiza la Container App. Usar el tag con el SHA del commit deja registro exacto de qué versión corre:
   ```bash
   az containerapp update -n rep-api -g rg-rep-demo --image ghcr.io/jsaavedrav/rep-demo-api:<sha-del-commit>
   ```

### Cómo se creó (para recrearlo en otro ambiente)
1. **Base de datos:** ver [db/README.md](db/README.md).
2. **App en Entra ID:**
   - Registro con `signInAudience = AzureADandPersonalMicrosoftAccount` y `requestedAccessTokenVersion = 2`.
   - Scope `access_as_user` y URI `api://<client-id>`, pre-autorizada para sí misma (evita la pantalla de consentimiento).
   - Redirect URIs de tipo **SPA**: la URL de la Static Web App y `http://localhost:4200`.
3. **Container App:**
   ```bash
   az containerapp env create -n cae-rep-demo -g rg-rep-demo -l brazilsouth --logs-destination none
   ```
   ```bash
   az containerapp create -n rep-api -g rg-rep-demo --environment cae-rep-demo --image ghcr.io/jsaavedrav/rep-demo-api:latest --target-port 3000 --ingress external --min-replicas 0 --max-replicas 2 --cpu 0.25 --memory 0.5Gi --system-assigned --env-vars NODE_ENV=production SQL_SERVER=<servidor>.database.windows.net SQL_DATABASE=<base> AUTH_CLIENT_ID=<client-id> CORS_ORIGINS=<url-del-front>
   ```
4. **Acceso a SQL de la identidad:** obtén su client ID con `az ad sp show --id <principalId> --query appId -o tsv`. Luego, conectado a la base como admin de Entra:
   ```sql
   -- SID = client ID de la identidad en formato binario (uuid.bytes_le). Ver db/README.md.
   CREATE USER [rep-api] WITH SID = 0x..., TYPE = E;
   GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::rep TO [rep-api];
   ```

**Costos:** la Container App queda dentro del cupo gratuito mensual de Container Apps, la imagen en GHCR es gratis, el entorno no envía logs y la base usa la oferta gratuita. Conviene una alerta de presupuesto en *Cost Management → Budgets*.

## Próximos pasos sugeridos
- **Integración SAP:** un *Container Apps Job* programado con la misma imagen, que llame a `SkusService` / `MovimientosService` (mismas validaciones que el Excel).
- **Despliegue automático:** que el workflow también actualice la Container App (requiere configurar credenciales federadas de Azure en GitHub).
