# Base de datos — Declaración REP

| Archivo | Qué hace |
|---|---|
| `01-ddl.sql` | Crea el esquema `rep`: tablas, índices y las vistas `v_informe_kilos` y `v_datos_rep`. |
| `02-dml-datos-maestros.sql` | **Obligatorio.** Perfiles, permisos, los 6 productos prioritarios, atributos, metas del DS 8, parámetros, usuarios y su acceso. |
| `03-dml-datos-ejemplo.sql` | **Opcional**, solo para pruebas o demo. Envases de ejemplo y los 100 registros de neumáticos de la especificación. |
| `04-consultas-indicadores.sql` | Línea base, metas, kilos meta con desgaste, % de cumplimiento y costo de gestión, según las fórmulas de la especificación. Solo lectura. |

Los scripts son **idempotentes** (se pueden correr más de una vez) y están probados en SQL Server 2022. En local los ejecuta `docker compose` automáticamente (ver el README principal).

> **Si ya tenías la base local del modelo anterior**, bórrala antes de levantar: `docker compose down -v`.

## Modelo

```
perfil ──< perfil_permiso >── permiso
  │
usuario ──< usuario_programa >── programa ──< programa_atributo   (Marca, Tipo, Categoría... con sus reglas)
(email → perfil; autentica Entra ID)   │
                                       ├──< meta_legal             (% del DS 8 por categoría, tipo y año)
                                       ├──< parametro              (factor de desgaste 0,84, IVA... con vigencia)
                                       ├──< tarifa_gestion         (CLP/kg por compra; ingreso manual)
                                       ├──< gestion                (kilos gestionados GRANSIC/SISREP; ingreso manual)
                                       │
                                      sku ──< sku_componente       (peso VIGENTE; un neumático = 1 componente)
                                       │            │
sucursal ──< movimiento >─────────────┘            │
             (una línea de la planilla: DIN, fecha, sucursal, unidades; id_origen = ID_Registro / SAP)
                  │                                 │
                  └──< movimiento_componente >──────┘
                       (peso CONGELADO al cargar; NULL = pendiente, no suma masa)
```

**Decisiones del modelo:**
- **Peso congelado por registro.** Cada movimiento guarda el peso con que se cargó. Si después cambia el peso vigente del SKU, los kilos ya registrados no cambian. Al ingresar el peso de un SKU solo se completan los registros que estaban **pendientes**; cómo tratar correcciones de peso en periodos ya cargados está por definir.
- **Kilos y toneladas calculados.** `v_informe_kilos` calcula kilos = unidades × peso congelado y toneladas = kilos / 1000, siempre consistentes con el peso guardado.
- **Año comercial.** `movimiento.anio_comercial` es el año de la fecha de introducción (columna calculada y persistida).
- **Re-importar sin duplicar.** Con `id_origen` (ID_Registro de la planilla o línea de SAP) la línea se actualiza. Sin él, se reconoce por DIN + SKU + fecha + sucursal.
- **Atributos en JSON + reglas en `programa_atributo`.** Cada producto prioritario tiene atributos distintos. La tabla define etiqueta, tipo (texto o número), si es obligatorio y los valores permitidos.
- **Acceso por producto prioritario.** `usuario_programa` define qué productos ve cada usuario. Los no configurados (`configurado = 0`) se muestran deshabilitados.
- **Vista para Power BI.** `v_datos_rep` entrega neumáticos con los nombres de columna exactos de la especificación (`Datos_REP`). La API también ofrece el mismo contenido como CSV.

## Crear la base en Azure: Azure SQL Database *serverless* (oferta gratuita)

1. **Crear recurso → SQL Database.** Si aparece *"Want to try Azure SQL Database for free?"*, presiona **Apply offer**.
2. **Servidor:** crea uno nuevo, en la región más cercana disponible para tu suscripción.
   - Autenticación: **"Use Microsoft Entra-only authentication"**.
   - Define tu usuario como *Microsoft Entra admin*.
3. **Base de datos:** nombre `repdb`. Con la oferta gratuita queda en *General Purpose – Serverless*. Redundancia de backup: **Locally‑redundant**.
4. **Redes:** *Public endpoint*.
   - ✅ **Allow Azure services and resources to access this server**.
   - ✅ **Add current client IP address**.
5. Carga los scripts siguiendo la sección siguiente.

## Cargar los scripts en Azure

**Orden:**
1. `01-ddl.sql`.
2. `02-dml-datos-maestros.sql`.
3. `03-dml-datos-ejemplo.sql`, solo si quieres datos de prueba.

**Antes de ejecutar `02`:** en su sección 2, reemplaza los correos `admin@demo.cl`, `operador@demo.cl` y `consulta@demo.cl` por los correos reales con que cada persona entra a Microsoft. Ajusta también a qué productos prioritarios accede cada uno. Si te equivocas, corrige y vuelve a ejecutar: el script es idempotente.

> El **Query editor del portal** no sirve para estos scripts: no acepta el separador `GO`, que `01-ddl.sql` necesita para crear las vistas. Usa una de estas dos opciones.

**Opción A: VS Code** (recomendada si prefieres una interfaz)
1. Instala la extensión **SQL Server (mssql)** de Microsoft.
2. *Add Connection*:
   - Servidor: `<tu-servidor>.database.windows.net`
   - Base: `repdb`
   - Autenticación: **Microsoft Entra ID - Universal with MFA**, con tu cuenta.
3. Abre cada archivo en orden y presiona **Execute Query** (`Cmd+Shift+E`).

**Opción B: terminal con `sqlcmd`**

Instalarlo una vez:
```bash
brew install sqlcmd
```

Ejecutar desde la carpeta `rep-demo-api`. Se abre el navegador para que inicies sesión con tu cuenta de Microsoft:
```bash
sqlcmd -S <tu-servidor>.database.windows.net -d repdb --authentication-method ActiveDirectoryInteractive -U <tu-correo> -i db/01-ddl.sql -i db/02-dml-datos-maestros.sql
```

Datos de ejemplo (opcional):
```bash
sqlcmd -S <tu-servidor>.database.windows.net -d repdb --authentication-method ActiveDirectoryInteractive -U <tu-correo> -i db/03-dml-datos-ejemplo.sql
```

**Si no conecta:**
- Revisa que tu IP esté permitida en **SQL server → Networking → Firewall rules → Add your client IPv4 address**.
- Revisa que tu cuenta sea *Microsoft Entra admin* del servidor.

**Comprobar la carga:** debe responder 6 programas y 3 usuarios (o los que hayas definido).
```sql
SELECT (SELECT COUNT(*) FROM rep.programa) AS programas, (SELECT COUNT(*) FROM rep.usuario) AS usuarios;
```

### Dar acceso a la API (Managed Identity, sin contraseñas)
Cuando la Container App exista y tenga activada su *System assigned identity*, ejecuta esto conectado a `repdb` con tu usuario de Entra:

```sql
CREATE USER [<nombre-de-la-container-app>] FROM EXTERNAL PROVIDER;
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::rep TO [<nombre-de-la-container-app>];
```

La API solo puede leer y escribir datos del esquema `rep`. No puede borrar tablas ni modificar el esquema.
