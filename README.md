# Game Tracker

Aplicación web personal para registrar el historial con cada videojuego: juego y plataforma,
estado, partidas (playthroughs), tiempo jugado, sesiones, dificultad, rating, platino, fechas y
notas.

> **Estado actual: Fase 4 — catálogo externo.** Infraestructura, autenticación, modelo de catálogo
> e integración con IGDB (búsqueda, importación y portadas). Todavía **no** hay biblioteca
> (UserGame) ni partidas.
>
> Las decisiones funcionales que completan la especificación están en
> [`docs/decisions.md`](docs/decisions.md).

## Stack

| Capa           | Tecnologías                                                          |
| -------------- | -------------------------------------------------------------------- |
| Frontend       | React 19, TypeScript, Vite, React Router, TanStack Query, MUI (dark) |
| Backend        | Node.js, TypeScript, NestJS 12, TypeORM, class-validator             |
| Base de datos  | PostgreSQL 17 (Docker Compose)                                       |
| Tests frontend | Vitest + React Testing Library                                       |
| Tests backend  | Jest + Supertest                                                     |
| Calidad        | ESLint (flat config, type-aware), Prettier, TypeScript `strict`      |

## Arquitectura

```text
Frontend (React)  ──/api──▶  Backend API (NestJS)  ──▶  PostgreSQL
                                     │
                                     └──▶  Catálogo externo (IGDB, vía GameCatalogProvider)
```

- El frontend solo habla con el backend (`/api`). Nunca accede a PostgreSQL ni a IGDB.
- En desarrollo, Vite hace de proxy de `/api` hacia el backend, así frontend y API comparten
  origen y las cookies HttpOnly funcionan sin configuración extra.
- El esquema de la base se gestiona **solo con migraciones** (`synchronize` siempre en `false`).

## Estructura

```text
game-tracker/
├── backend/                  # API NestJS
│   ├── src/
│   │   ├── auth/             # sesiones, guard global, login/registro/logout
│   │   ├── config/           # carga y validación de variables de entorno
│   │   ├── assets/           # almacenamiento de assets (portadas) y GET /api/assets
│   │   ├── catalog/          # GameCatalogProvider, IGDB, búsqueda e importación
│   │   ├── database/         # opciones TypeORM, DataSource del CLI, migraciones
│   │   ├── games/            # entidad Game (+ GamePlatform) y reglas de visibilidad
│   │   ├── genres/           # géneros precargados (en español) y GET /api/genres
│   │   ├── health/           # endpoint técnico GET /api/health
│   │   ├── platforms/        # plataformas precargadas y GET /api/platforms
│   │   ├── users/            # entidad User y servicio
│   │   ├── app.module.ts
│   │   ├── app.setup.ts      # prefijo /api, CORS, helmet, ValidationPipe
│   │   └── main.ts
│   ├── test/                 # tests e2e (Jest + Supertest) contra la DB de test
│   ├── scripts/              # helpers de migraciones y verificación de IDs de IGDB
│   └── storage/              # assets locales (ignorado por git)
├── frontend/                 # SPA React + Vite
│   └── src/
│       ├── app/              # providers, query client, rutas
│       ├── features/         # código por funcionalidad (auth, health)
│       ├── i18n/             # textos de la UI centralizados (español)
│       ├── layouts/
│       ├── lib/api/          # cliente HTTP (fetch con credentials: 'include')
│       ├── pages/
│       ├── test/             # setup y helpers de tests
│       └── theme/            # tema MUI dark-first
├── docs/decisions.md         # decisiones funcionales tomadas
├── docker/postgres/init/     # crea la base de test al inicializar el volumen
├── docker-compose.yml        # PostgreSQL
├── .env.example              # plantilla de variables (copiar a .env)
└── package.json              # scripts de conveniencia (sin dependencias)
```

## Requisitos

- **Node.js ≥ 24.9** (ver `.nvmrc`). NestJS 12 es ESM-only y Jest solo puede cargarlo de forma
  nativa desde Node 24.9; Vitest 5 requiere Node ≥ 22.
- npm ≥ 11 (viene con Node 24)
- Docker Desktop (o Docker Engine) con Docker Compose v2

## Instalación

```bash
cp .env.example .env          # y completar los valores (ver abajo)
npm run install:all           # instala backend/ y frontend/
docker compose up -d          # levanta PostgreSQL
npm run migration:run         # aplica las migraciones
```

## Variables de entorno

Hay **un único `.env` en la raíz**, compartido por Docker Compose, el backend y Vite. Nunca se
versiona (`.gitignore`); `.env.example` documenta todas las variables.

| Variable                                                   | Uso                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `POSTGRES_HOST`, `POSTGRES_PORT`                           | Conexión del backend a PostgreSQL (puerto del host, por defecto 5434)                              |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`                       | Credenciales (Docker crea el usuario con estos valores)                                            |
| `POSTGRES_DB`                                              | Base de desarrollo                                                                                 |
| `POSTGRES_TEST_DB`                                         | Base para los tests e2e (Docker la crea automáticamente)                                           |
| `NODE_ENV`, `BACKEND_PORT`                                 | Entorno y puerto de la API                                                                         |
| `FRONTEND_ORIGIN`                                          | Origen permitido por CORS                                                                          |
| `AUTH_SECRET`, `AUTH_COOKIE_NAME`, `AUTH_SESSION_TTL_DAYS` | Sesiones. `AUTH_SECRET` ≥ 32 caracteres (cambiarlo cierra todas las sesiones)                      |
| `AUTH_RATE_LIMIT_PER_MINUTE`                               | Intentos de login/registro por IP y minuto (por defecto 10)                                        |
| `CATALOG_PROVIDER`, `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | Catálogo externo. **Solo backend**. Sin credenciales, la búsqueda devuelve solo resultados locales |
| `ASSET_STORAGE_DRIVER`, `ASSET_STORAGE_LOCAL_DIR`          | Almacenamiento de portadas (hoy `local`, en `backend/storage`)                                     |
| `VITE_API_BASE_URL`                                        | URL base de la API vista por el navegador (por defecto `/api`)                                     |
| `DEV_PROXY_TARGET`                                         | Destino del proxy de Vite en desarrollo (no llega al navegador)                                    |

El backend valida todas sus variables al arrancar (class-validator) y no inicia si falta alguna.
Solo las variables con prefijo `VITE_` llegan al bundle del navegador: nunca pongas secretos con
ese prefijo.

Para generar un `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Docker / PostgreSQL

```bash
docker compose up -d      # levanta PostgreSQL en segundo plano
docker compose ps         # estado (healthcheck incluido)
docker compose logs -f    # logs
docker compose down       # detiene (los datos persisten en el volumen)
docker compose down -v    # detiene y BORRA los datos
```

- Imagen `postgres:17-alpine`, datos en el volumen `game-tracker_postgres_data`.
- El puerto del host es `POSTGRES_PORT` (por defecto **5434**, para no chocar con otras
  instancias locales de PostgreSQL en 5432/5433).
- En el primer arranque (volumen vacío) se crea también la base `POSTGRES_TEST_DB`. Si el
  volumen ya existía antes de configurarla, recrealo con `docker compose down -v`.

## Migraciones

Ejecutar desde `backend/`:

```bash
npm run migration:run                    # aplica migraciones pendientes
npm run migration:revert                 # revierte la última
npm run migration:show                   # lista migraciones y su estado
npm run migration:generate -- NombreEnPascalCase   # genera a partir de cambios en entidades
npm run migration:create -- NombreEnPascalCase     # crea una migración vacía
```

Las migraciones viven en `backend/src/database/migrations/`. La base se puede reconstruir desde
cero aplicándolas en orden; los tests e2e lo hacen en cada corrida sobre la base de test.

## Ejecutar en desarrollo

```bash
npm run dev:backend    # API en http://localhost:3000/api  (watch mode)
npm run dev:frontend   # App en http://localhost:5173
```

`GET /api/health` responde `{"status":"ok","database":"up"}` si la API y la base funcionan; el
header del frontend muestra ese estado.

## Autenticación

| Endpoint                  | Acceso  | Descripción                                                       |
| ------------------------- | ------- | ----------------------------------------------------------------- |
| `POST /api/auth/register` | público | Crea la cuenta (email + contraseña) y deja la sesión iniciada     |
| `POST /api/auth/login`    | público | Inicia sesión                                                     |
| `POST /api/auth/logout`   | público | Invalida la sesión en el servidor y borra la cookie (idempotente) |
| `GET /api/auth/me`        | sesión  | Usuario actual (`401` si no hay sesión)                           |

- **Sesiones en PostgreSQL** (tabla `sessions`) identificadas por un token aleatorio de 256 bits
  en una cookie `HttpOnly`, `SameSite=Lax` (`Secure` en producción). En la base solo se guarda
  el HMAC-SHA256 del token (con `AUTH_SECRET`), nunca el token.
- **Expiración deslizante:** `AUTH_SESSION_TTL_DAYS` desde el último uso; se renueva como máximo
  una vez por día. Cada dispositivo tiene su propia sesión.
- **Contraseñas** con Argon2id (parámetros OWASP), 8–128 caracteres. El login responde lo mismo
  para email inexistente y contraseña incorrecta, con tiempos equivalentes.
- **Seguro por defecto:** un guard global exige sesión en todos los endpoints salvo los marcados
  con `@Public()`. Los endpoints de negocio solo deben usar `@CurrentUser()`.
- **Rate limiting** en login y registro (`AUTH_RATE_LIMIT_PER_MINUTE` por IP). En producción,
  detrás de un reverse proxy habrá que configurar `trust proxy` para que la IP sea la real.
- Los errores llevan un `code` estable (`INVALID_CREDENTIALS`, `EMAIL_ALREADY_REGISTERED`,
  `UNAUTHENTICATED`); el frontend lo traduce a textos en español.

## Modelo de catálogo

- **`platforms`** — lista global precargada por migración (31, incluye retro). Los usuarios no
  crean plataformas. `GET /api/platforms` la devuelve en orden de visualización.
- **`genres`** — 23 géneros de IGDB con nombre en español. `GET /api/genres`.
- **`platform_external_ids` / `genre_external_ids`** — correspondencia con los IDs de cada
  proveedor (hoy IGDB). Windows, Mac y Linux de IGDB apuntan a "PC".
- **`games`** — datos de catálogo, nunca datos personales. Un juego es **de catálogo**
  (`provider` + `external_id`, único, visible para todos) o **manual** (`created_by_user_id`,
  privado de su creador). Lo garantiza un CHECK en la base.
- **`game_platforms`** (GamePlatform) — plataformas que informa el catálogo para cada juego;
  restringen dónde se puede registrar. Los juegos manuales aceptan cualquier plataforma.
- **`game_genres`** — géneros de cada juego.

Las tablas de referencia se cargan con migraciones (datos inline, inmutables); los tests e2e
nunca las vacían.

## Catálogo externo (IGDB)

Arquitectura: `GameCatalogProvider` (interfaz) → `IgdbProvider` (primera implementación). El
frontend nunca habla con IGDB; las credenciales solo viven en el `.env` del backend.

| Endpoint                                 | Descripción                                                         |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `GET /api/catalog/search?q=`             | Busca en IGDB + juegos importados + juegos manuales propios         |
| `GET /api/catalog/:provider/images/:ref` | Proxy de miniaturas de resultados aún no importados (no se guardan) |
| `GET /api/assets/:folder/:file`          | Portadas almacenadas (públicas, cache inmutable)                    |

- **Búsqueda:** 2–100 caracteres, cache en memoria de 10 minutos, límite de 60 búsquedas por
  minuto. Si IGDB falla o no está configurado responde `catalogAvailable: false` con los
  resultados locales. Solo se buscan los tipos permitidos (juego, remake, remaster, port, versión
  expandida, expansión independiente).
- **Importación** (`CatalogImportService`, la usará la biblioteca al agregar un juego): guarda el
  juego, sus plataformas conocidas (las desconocidas se ignoran), sus géneros (los desconocidos
  se crean con el nombre de IGDB) y descarga la portada a la abstracción de almacenamiento. Un
  juego ya importado se devuelve tal cual (sin sincronización). Si la portada falla, el juego se
  importa igual.
- **Almacenamiento de assets:** interfaz `AssetStorage` con driver `local`; las claves son el
  hash del contenido (`covers/<sha256>.jpg`). Preparado para agregar un driver S3.

### Verificar los IDs de IGDB

Los IDs de plataformas, géneros y tipos de juego se verifican contra la API real:

```bash
npm --prefix backend run catalog:verify-igdb
```

Es de solo lectura: imprime un informe y sale con código 1 si algo no coincide. Las
correcciones se aplican con una migración nueva, revisada. Nunca imprime credenciales.

## Tests

```bash
npm test                          # unit tests de backend (Jest) y frontend (Vitest)
npm run test:e2e                  # e2e del backend (Jest + Supertest); requiere Docker levantado
npm --prefix backend run test:cov
npm --prefix frontend run test:cov
```

Los tests e2e usan **siempre** `POSTGRES_TEST_DB`: la borran y la reconstruyen con las
migraciones antes de correr, sin tocar la base de desarrollo.

## Lint, typecheck y formato

```bash
npm run lint           # ESLint en ambos paquetes
npm run typecheck      # tsc --noEmit en ambos paquetes
npm run format         # Prettier (escribe)
npm run format:check   # Prettier (verifica)
npm run check          # typecheck + lint + format:check + tests unitarios
```

## Alcance por versiones

- **V1**: núcleo de gestión de juegos (auth, catálogo, biblioteca, partidas, sesiones,
  dificultades, rating, platino, notas).
- **V2**: mejoras de organización, importaciones, más fuentes de catálogo, tags, etc.
- **V3**: estadísticas, perfil avanzado, trofeos/logros.
