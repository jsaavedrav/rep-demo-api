# rep-demo-api

API de **Declaración REP**. Backend del frontend [`rep-demo-front`](../rep-demo-front).

**NestJS 12 · Azure SQL · Azure Container Apps**

```
rep-demo-front (Static Web App)  ──/api/*──▶  rep-demo-api (Container App)  ──▶  Azure SQL (serverless)
          login Microsoft Entra ID          lee el usuario del header,         permisos en rep.perfil_permiso
                                            valida permisos y datos
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

API en `http://localhost:3000/api`. Sin Static Web Apps delante, el usuario se simula con `DEV_USER_EMAIL`, que se ignora cuando `NODE_ENV=production`. Para probar otro usuario, envía el header como lo haría Azure:

```bash
curl -H "x-ms-client-principal: $(printf '{"userDetails":"consulta@demo.cl"}' | base64)" http://localhost:3000/api/usuarios/me
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
| `SQL_SERVER`, `SQL_DATABASE` | Conexión con **Managed Identity** (Azure, sin contraseña). |
| `AZURE_CLIENT_ID` | Solo si usas una identidad asignada por el usuario. |
| `DEV_USER_EMAIL` | Usuario simulado en desarrollo. |
| `PORT` | Puerto HTTP (por defecto 3000). |

## Despliegue en Azure

1. **Base de datos:** créala y ejecuta los scripts, siguiendo [db/README.md](db/README.md).

2. **Container App:** crea el entorno y la app, compilando la imagen desde este repo. Requiere [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli).
   ```bash
   az group create -n rg-rep -l <region>
   ```
   ```bash
   az containerapp env create -n cae-rep -g rg-rep -l <region>
   ```
   ```bash
   az containerapp up -n rep-api -g rg-rep --environment cae-rep --source . --ingress external --target-port 3000
   ```
   `--source .` crea un Azure Container Registry Basic (~USD 5 al mes). Para evitar ese costo, publica la imagen en GitHub Container Registry desde GitHub Actions.

3. **Identidad y configuración:**
   ```bash
   az containerapp identity assign -n rep-api -g rg-rep --system-assigned
   ```
   ```bash
   az containerapp update -n rep-api -g rg-rep --min-replicas 0 --max-replicas 3 --set-env-vars NODE_ENV=production SQL_SERVER=<servidor>.database.windows.net SQL_DATABASE=repdb
   ```

4. **Acceso a SQL:** da acceso a la identidad de la app ejecutando el `CREATE USER ... FROM EXTERNAL PROVIDER` de [db/README.md](db/README.md).

5. **Enlazar con el frontend:** la Static Web App debe estar en el plan **Standard**. Ve a **Static Web App → APIs → Link → Container App → `rep-api`**.
   - Desde ese momento `/api/*` del sitio llega a esta API.
   - La Container App solo acepta tráfico que pasa por la Static Web App.

## Pendiente en el frontend para el switch

1. **Login con Microsoft:** reemplazar el formulario de usuario y contraseña por un botón que lleve a `/.auth/login/aad`. `ApiAuthRepository.login` pasa a llamar `GET /api/usuarios/me`.
2. **Proteger la API:** en `public/staticwebapp.config.json`, exigir el rol `authenticated` en `/api/*`.
3. **Activar la API:** `dataSource: 'api'` en `src/app/app.settings.ts`.

## Próximos pasos sugeridos
- **Integración SAP:** un *Container Apps Job* programado con la misma imagen, que llame a `SkusService` / `MovimientosService` (mismas validaciones que el Excel).
- **Pipeline CI/CD:** compilar, probar y desplegar en cada push a `main`.
