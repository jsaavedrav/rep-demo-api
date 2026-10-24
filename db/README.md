# Base de datos — Declaración REP

| Archivo | Qué hace |
|---|---|
| `01-ddl.sql` | Crea el esquema `rep`: tablas, índices y la vista `v_informe_kilos`. |
| `02-dml-datos-iniciales.sql` | Perfiles, permisos, programas, usuarios y datos de ejemplo. |
| `03-consultas-api.sql` | Las consultas que usa la API, con parámetros de ejemplo. Sirve de referencia y de prueba: termina en `ROLLBACK`, así que no deja cambios. |

Los tres scripts son **idempotentes** (se pueden correr más de una vez) y están probados en SQL Server 2022. En local los ejecuta `docker compose` automáticamente (ver el README principal).

## Modelo

```
perfil ──< perfil_permiso >── permiso
  │
usuario (email → perfil; sin contraseña, autentica Entra ID)

programa ──< programa_atributo          (Material, Clase, ...)
   │
  sku ──< sku_componente                (botella, tapa; peso_kg NULL = pendiente)
   │
   └──< movimiento >── importacion      (unidades por documento DIN/venta; bitácora de cargas)
```

- **Atributos en JSON:** los valores de clasificación de cada componente se guardan en una columna JSON (`atributos`), porque cada programa tiene atributos distintos. Coincide 1:1 con el modelo del frontend.
- **SKU obligatorio en el catálogo:** `movimiento` referencia a `sku`, así que la base rechaza unidades de un SKU que no está en el catálogo.
- **Permisos en la base:** la API los lee de `perfil_permiso`. Para crear o ajustar un perfil se modifica esta tabla, no el código.

## Crear la base en Azure: Azure SQL Database *serverless* (oferta gratuita)

1. **Crear recurso → SQL Database.** Si aparece *"Want to try Azure SQL Database for free?"*, presiona **Apply offer**.
2. **Servidor:** crea uno nuevo, en la región más cercana disponible para tu suscripción.
   - Autenticación: **"Use Microsoft Entra-only authentication"**.
   - Define tu usuario como *Microsoft Entra admin*.
3. **Base de datos:** nombre `repdb`. Con la oferta gratuita queda en *General Purpose – Serverless*. Redundancia de backup: **Locally‑redundant**.
4. **Redes:** *Public endpoint*.
   - ✅ **Allow Azure services and resources to access this server**.
   - ✅ **Add current client IP address**.
5. **Ejecutar scripts:** ejecuta `01-ddl.sql` y luego `02-dml-datos-iniciales.sql`, desde **Query editor** en el portal o desde **VS Code con la extensión "SQL Server (mssql)"**.
   - En producción, borra la sección 3 del DML (datos de ejemplo) y cambia los correos de la sección 2 por los reales.

### Dar acceso a la API (Managed Identity, sin contraseñas)
Cuando la Container App exista y tenga activada su *System assigned identity*, ejecuta esto conectado a `repdb` con tu usuario de Entra:

```sql
CREATE USER [<nombre-de-la-container-app>] FROM EXTERNAL PROVIDER;
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::rep TO [<nombre-de-la-container-app>];
```

La API solo puede leer y escribir datos del esquema `rep`. No puede borrar tablas ni modificar el esquema.
