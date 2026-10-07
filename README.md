# Game Tracker

Aplicación web personal para registrar el historial con cada videojuego: juego y plataforma,
estado, partidas (playthroughs), tiempo jugado, sesiones, dificultad, rating, platino, fechas y
notas.

> **Estado actual: V1 completa.** Autenticación, catálogo (IGDB), biblioteca personal, partidas,
> sesiones y tiempo, dificultades, valoración, platino, notas, detalle del juego y biblioteca con
> búsqueda, filtros y orden. Trofeos/logros, estadísticas, perfil avanzado y demás funcionalidades
> de V2/V3 **no** están incluidas.
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
│   │   ├── auth/             # sesiones, guard global, registro/verificación/login/logout
│   │   ├── email/            # EmailService (Resend) y plantilla del código de verificación
│   │   ├── config/           # carga y validación de variables de entorno
│   │   ├── assets/           # almacenamiento de assets (portadas) y GET /api/assets
│   │   ├── catalog/          # GameCatalogProvider, IGDB, búsqueda e importación
│   │   ├── database/         # opciones TypeORM, DataSource del CLI, migraciones
│   │   ├── games/            # entidad Game (+ GamePlatform) y reglas de visibilidad
│   │   ├── genres/           # géneros precargados (en español) y GET /api/genres
│   │   ├── health/           # endpoint técnico GET /api/health
│   │   ├── library/          # UserGame, partidas, sesiones, dificultades, platino, vistas
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
│       ├── components/       # componentes compartidos (diálogos, secciones, campos)
│       ├── features/         # auth, library (Mis juegos), game-detail, health
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
| `AUTH_RATE_LIMIT_PER_MINUTE`                               | Intentos por IP, minuto y endpoint público de auth (por defecto 10)                                |
| `RESEND_API_KEY`, `EMAIL_FROM`                             | Envío de emails (código de verificación) con Resend. **Secreto, solo backend**. Obligatorias       |
| `CATALOG_PROVIDER`, `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | Catálogo externo. **Solo backend**. Sin credenciales, la búsqueda devuelve solo resultados locales |
| `ASSET_STORAGE_DRIVER`, `ASSET_STORAGE_LOCAL_DIR`          | Almacenamiento de portadas (hoy `local`, en `backend/storage`)                                     |
| `VITE_API_BASE_URL`                                        | URL base de la API vista por el navegador (por defecto `/api`)                                     |
| `DEV_PROXY_TARGET`                                         | Destino del proxy de Vite en desarrollo (no llega al navegador)                                    |

El backend valida todas sus variables al arrancar (class-validator) y no inicia si falta alguna.
Solo las variables con prefijo `VITE_` llegan al bundle del navegador: nunca pongas secretos con
ese prefijo.

### Emails (Resend)

El código de verificación se envía con [Resend](https://resend.com):

1. Creá una cuenta en Resend y generá una API key (**API Keys → Create API Key**).
2. Ponela en `.env` como `RESEND_API_KEY` (nunca en el código ni en commits).
3. Definí el remitente en `EMAIL_FROM`, por ejemplo `Game Tracker <no-reply@tu-dominio.com>`.
   Sin dominio propio podés usar `Game Tracker <onboarding@resend.dev>`, pero Resend solo
   entrega esos emails a la dirección de tu propia cuenta de Resend (alcanza para probar).
   Para enviar a cualquier dirección hay que verificar un dominio en Resend.

Sin `RESEND_API_KEY` y `EMAIL_FROM` el backend no arranca (salvo en tests, que usan un
`MockEmailService` y nunca llaman a Resend). Los logs nunca incluyen la API key ni los códigos.

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

| Endpoint                             | Acceso  | Descripción                                                                         |
| ------------------------------------ | ------- | ----------------------------------------------------------------------------------- |
| `POST /api/auth/register`            | público | Crea la cuenta **no verificada** y envía el código por email. No inicia sesión      |
| `POST /api/auth/verify-email`        | público | Verifica el email con el código de 6 dígitos (`204`). No inicia sesión              |
| `POST /api/auth/resend-verification` | público | Envía un código nuevo (`202` siempre, exista o no la cuenta)                        |
| `POST /api/auth/login`               | público | Inicia sesión. `403 EMAIL_NOT_VERIFIED` (sin cookie) si el email no está verificado |
| `POST /api/auth/logout`              | público | Invalida la sesión en el servidor y borra la cookie (idempotente)                   |
| `GET /api/auth/me`                   | sesión  | Usuario actual (`401` si no hay sesión)                                             |

**Registro:** username + email + contraseña + aceptación de Términos de uso y Política de
privacidad (`acceptTerms` y `acceptPrivacy`, ambos obligatorios; en el frontend un único
checkbox con links a `/terms` y `/privacy`). Se guardan la fecha y la versión aceptada de cada
documento. El username tiene 3–30 caracteres (letras, números y `_`), se guarda en minúsculas y
es único sin distinguir mayúsculas.

**Verificación de email (obligatoria):**

- Código de 6 dígitos generado con el CSPRNG del sistema (`crypto.randomInt`), de un solo uso,
  válido 10 minutos. En la base solo se guarda su HMAC-SHA256 (con `AUTH_SECRET`, ligado al
  usuario), nunca el código.
- Código incorrecto, vencido, ya usado o de una cuenta inexistente: la misma respuesta
  (`400 INVALID_VERIFICATION_CODE`). Tras 5 intentos fallidos el código se invalida.
- Reenvío: invalida el código anterior, tiene un cooldown de 60 s por cuenta y responde siempre
  igual (no permite enumerar cuentas). El envío ocurre en segundo plano.
- Si el email de registro no se puede enviar, la cuenta no se crea (`503 EMAIL_DELIVERY_FAILED`)
  y se puede reintentar.
- **Bloqueo total:** un usuario no verificado no puede iniciar sesión, y el guard global rechaza
  con `403 EMAIL_NOT_VERIFIED` (y revoca la sesión) cualquier endpoint autenticado aunque
  presente una sesión válida. Solo quedan accesibles los endpoints públicos de verificación y
  reenvío.
- **CAPTCHA:** no implementado. Los endpoints públicos de auth están preparados para sumar un
  guard (por ejemplo Cloudflare Turnstile) sin tocar los servicios; hoy se protegen con rate
  limiting y cooldown.

- **Sesiones en PostgreSQL** (tabla `sessions`) identificadas por un token aleatorio de 256 bits
  en una cookie `HttpOnly`, `SameSite=Lax` (`Secure` en producción). En la base solo se guarda
  el HMAC-SHA256 del token (con `AUTH_SECRET`), nunca el token.
- **Expiración deslizante:** `AUTH_SESSION_TTL_DAYS` desde el último uso; se renueva como máximo
  una vez por día. Cada dispositivo tiene su propia sesión.
- **Contraseñas** con Argon2id (parámetros OWASP), 8–128 caracteres. El login responde lo mismo
  para email inexistente y contraseña incorrecta, con tiempos equivalentes.
- **Seguro por defecto:** un guard global exige sesión en todos los endpoints salvo los marcados
  con `@Public()`. Los endpoints de negocio solo deben usar `@CurrentUser()`.
- **Rate limiting** en registro, login, verificación y reenvío (`AUTH_RATE_LIMIT_PER_MINUTE` por
  IP y endpoint). En producción,
  detrás de un reverse proxy habrá que configurar `trust proxy` para que la IP sea la real.
- Los errores llevan un `code` estable (`INVALID_CREDENTIALS`, `EMAIL_ALREADY_REGISTERED`,
  `USERNAME_TAKEN`, `UNAUTHENTICATED`, `EMAIL_NOT_VERIFIED`, `INVALID_VERIFICATION_CODE`,
  `EMAIL_DELIVERY_FAILED`); el frontend lo traduce a textos en español.

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

## Biblioteca (V1)

Un **UserGame** es el registro personal de un juego en una plataforma (usuario + juego +
plataforma, único). Cada uno tiene siempre al menos una partida: la #1 se crea automáticamente y
nunca se puede eliminar.

- **Valores derivados** (vistas `playthrough_times` y `user_game_summaries`, nunca guardados):
  estado (IN_PROGRESS si alguna partida está en progreso; si no, COMPLETED si alguna está
  completada; si no, PENDING), inicio (el inicio más antiguo), finalización (la **primera**
  finalización) y tiempo total (suma de las partidas).
- **Tiempo** siempre en minutos enteros. Cada partida está en modo MANUAL (tiempo total cargado a
  mano) o SESSIONS (suma de sus sesiones); nunca se mezclan, y cambiar de modo no pierde tiempo.
- **Dificultades:** dos listas propias por UserGame (partidas y platino), con valores por defecto,
  editables y reordenables; una dificultad en uso no se puede eliminar.
- **Platino:** independiente del estado, del tiempo de juego y de la dificultad de las partidas.
- **Propiedad:** todos los endpoints exigen sesión y verifican que el recurso sea del usuario; los
  datos de otro usuario responden 404.

| Endpoint                                                                           | Descripción                                                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /api/library`                                                                 | Lista con `search`, `status`, `platformId`, `genreId`, `platinum`, `sort`, `order` |
| `POST /api/library`                                                                | Agrega un juego (`gameId`, `catalog` o `manualGame`) en una plataforma             |
| `GET / PATCH / DELETE /api/library/:id`                                            | Detalle, valoración y nota general, eliminación                                    |
| `GET / POST /api/library/:id/playthroughs`                                         | Partidas                                                                           |
| `PATCH / DELETE /api/library/:id/playthroughs/:pid`                                | Editar / eliminar partida (no la #1)                                               |
| `PUT /api/library/:id/playthroughs/:pid/manual-time`                               | Tiempo manual                                                                      |
| `PUT /api/library/:id/playthroughs/:pid/time-mode`                                 | Cambiar MANUAL ↔ SESSIONS                                                          |
| `POST /api/library/:id/playthroughs/:pid/sessions`                                 | Registrar sesión (solo modo SESSIONS)                                              |
| `GET /api/library/:id/sessions`, `PATCH / DELETE …/sessions/:sid`                  | Sesiones                                                                           |
| `GET / PUT /api/library/:id/platinum`                                              | Platino                                                                            |
| `GET / POST /api/library/:id/difficulties`, `PATCH / DELETE …/:did`, `PUT …/order` | Dificultades                                                                       |

## Navegación (frontend)

El header tiene el logo, el **buscador global del catálogo** y la navegación principal (Inicio,
Mis juegos, Mi perfil); en mobile la navegación pasa a un menú lateral y el buscador queda visible.

| Ruta                             | Pantalla                                                         |
| -------------------------------- | ---------------------------------------------------------------- |
| `/`                              | Inicio: hero con artwork, juegos recientes/próximos y funciones  |
| `/catalog/:provider/:externalId` | Juego del catálogo ("este juego existe") con **+ Agregar juego** |
| `/games`                         | Mis juegos: búsqueda, filtros y orden de la biblioteca personal  |
| `/games/:id`                     | Mi juego: partidas, sesiones, platino, dificultades y notas      |
| `/profile`                       | Mi perfil: username, email y cierre de sesión                    |
| `/register`, `/login`            | Registro e inicio de sesión (solo sin sesión)                    |
| `/verify-email?email=…`          | "Verificá tu email": código de 6 dígitos y reenvío               |
| `/terms`, `/privacy`             | Términos de uso y Política de privacidad (públicas, borrador)    |

Flujo para agregar un juego: buscador global → página del catálogo → **Agregar juego** → modal
(plataforma entre las que informa el catálogo, estado inicial, fechas, dificultad, valoración) →
se crea el UserGame con la partida #1 configurada → se abre "Mi juego". Los juegos manuales se
agregan desde Mis juegos con el mismo modal y nunca aparecen en el catálogo.

La Home usa `GET /api/catalog/highlights`: los juegos más esperados (por "hypes" de IGDB)
lanzados en los últimos 180 días y los próximos lanzamientos, sin contenido adulto. Se cachean
una hora, no se importa ni se guarda nada, y las imágenes pasan por el proxy
(`?size=artwork` para el fondo del hero, que se elige al azar en cada visita). Si IGDB no
responde, la Home oculta esas secciones.

La página del catálogo usa `GET /api/catalog/games/:provider/:externalId`: si el juego ya fue
importado responde desde la base (funciona aunque IGDB esté caído); si no, consulta IGDB **sin
guardar nada**. Los juegos manuales no tienen ID externo, así que nunca son accesibles por esa ruta.

## Idiomas

La interfaz está en **español (Argentina)** e **inglés**. El selector del header muestra la
bandera del idioma actual; la elección se guarda en el navegador (`localStorage`, clave
`gt.locale`) y también funciona en login y registro. Por defecto: español.

- Textos en `frontend/src/i18n/es.ts` (referencia) y `en.ts`. El tipo `Messages` obliga a que
  ambos tengan la misma forma, y un test lo verifica en ejecución.
- Los componentes siguen leyendo `messages`: al cambiar el idioma ese objeto se actualiza en el
  lugar y la app se vuelve a montar (la URL y los datos en caché se conservan).
- Fechas con `Intl` en el idioma actual. Los géneros precargados se traducen por slug
  (`i18n/genres.ts`); los resúmenes de IGDB llegan en inglés y los nombres de plataformas y las
  dificultades (datos del usuario) no se traducen.
- Para agregar un idioma: un nuevo diccionario con el tipo `Messages`, sumarlo a `LOCALES` y a
  `dictionaries`, y su bandera en `LanguageSelector`.

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
