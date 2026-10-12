# Game Tracker

Aplicación web personal para registrar el historial con cada videojuego: juego y plataforma,
estado, partidas (playthroughs), tiempo jugado, sesiones, dificultad, rating, platino, fechas y
notas.

> **Estado actual: V1 completa.** Autenticación, catálogo (IGDB), biblioteca personal, partidas,
> sesiones y tiempo, dificultades, valoración, platino, notas, detalle del juego y biblioteca con
> búsqueda, filtros y orden. Además, la sección **Explorar**: Descubrir (recomendaciones), calendario
> de Lanzamientos, Noticias (RSS) y Ofertas con wishlist y precio objetivo (IsThereAnyDeal).
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

| Variable                                                             | Uso                                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_HOST`, `POSTGRES_PORT`                                     | Conexión del backend a PostgreSQL (puerto del host, por defecto 5434)                                                                       |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`                                 | Credenciales (Docker crea el usuario con estos valores)                                                                                     |
| `POSTGRES_DB`                                                        | Base de desarrollo                                                                                                                          |
| `POSTGRES_TEST_DB`                                                   | Base para los tests e2e (Docker la crea automáticamente)                                                                                    |
| `NODE_ENV`, `BACKEND_PORT`                                           | Entorno y puerto de la API                                                                                                                  |
| `FRONTEND_ORIGIN`                                                    | Origen permitido por CORS                                                                                                                   |
| `AUTH_SECRET`, `AUTH_COOKIE_NAME`, `AUTH_SESSION_TTL_DAYS`           | Sesiones. `AUTH_SECRET` ≥ 32 caracteres (cambiarlo cierra todas las sesiones)                                                               |
| `AUTH_RATE_LIMIT_PER_MINUTE`                                         | Intentos por IP, minuto y endpoint público de auth (por defecto 10)                                                                         |
| `RESEND_API_KEY`, `EMAIL_FROM`                                       | Envío de emails (código de verificación) con Resend. **Secreto, solo backend**. Obligatorias                                                |
| `ADMIN_EMAIL`                                                        | Recibe las denuncias de usuarios. Opcional: sin él, las denuncias solo quedan en la base                                                    |
| `PORT`, `FRONTEND_DIST_DIR`, `DB_MIGRATIONS_RUN`, `TRUST_PROXY_HOPS` | Producción (ver "Producción (Railway)"); la imagen Docker ya los define                                                                     |
| `CATALOG_PROVIDER`, `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`           | Catálogo externo. **Solo backend**. Sin credenciales, la búsqueda devuelve solo resultados locales                                          |
| `PRICE_PROVIDER`, `ITAD_API_KEY`, `ITAD_COUNTRY`                     | Ofertas y precios (IsThereAnyDeal). **Secreto, solo backend**. Opcionales: sin clave, Ofertas lo explica. `ITAD_COUNTRY` = país por defecto |
| `STEAM_API_KEY`                                                      | Vincular Steam e importar juegos, horas y logros. **Secreto, solo backend**. Opcional: sin clave, Mis juegos no ofrece Steam                |
| `NEWS_PROVIDER`, `NEWS_RSS_FEEDS_ES`, `NEWS_RSS_FEEDS_EN`            | Noticias: URLs de feeds RSS/Atom por idioma, separadas por comas. Opcionales: vacío = Noticias explica qué falta                            |
| `ASSET_STORAGE_DRIVER`, `ASSET_STORAGE_LOCAL_DIR`                    | Almacenamiento de portadas (hoy `local`, en `backend/storage`)                                                                              |
| `VITE_API_BASE_URL`                                                  | URL base de la API vista por el navegador (por defecto `/api`)                                                                              |
| `VITE_CONTACT_EMAIL`                                                 | Email de contacto de los Términos y la Política de privacidad. **Obligatorio antes de publicar**                                            |
| `DEV_PROXY_TARGET`                                                   | Destino del proxy de Vite en desarrollo (no llega al navegador)                                                                             |

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

| Endpoint                             | Acceso  | Descripción                                                                                                                                                   |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/register`            | público | Crea la cuenta **no verificada** (con su país, obligatorio) y envía el código por email. No inicia sesión                                                     |
| `POST /api/auth/verify-email`        | público | Verifica el email con el código de 6 dígitos (`204`). No inicia sesión                                                                                        |
| `POST /api/auth/resend-verification` | público | Envía un código nuevo (`202` siempre, exista o no la cuenta)                                                                                                  |
| `POST /api/auth/login`               | público | Inicia sesión con `username` + `password`. `403 EMAIL_NOT_VERIFIED` (sin cookie, con el `email` de la cuenta para verificarlo) si el email no está verificado |
| `POST /api/auth/logout`              | público | Invalida la sesión en el servidor y borra la cookie (idempotente)                                                                                             |
| `GET /api/auth/me`                   | sesión  | Usuario actual (`401` si no hay sesión)                                                                                                                       |
| `POST /api/auth/delete-account`      | sesión  | `{ password }`: elimina la cuenta y todos sus datos, y borra la cookie (`400 WRONG_PASSWORD`)                                                                 |

**Registro:** username + email + contraseña + aceptación de Términos de uso y Política de
privacidad (`acceptTerms` y `acceptPrivacy`, ambos obligatorios; en el frontend un único
checkbox con links a `/terms` y `/privacy`). Se guardan la fecha y la versión aceptada de cada
documento. El username tiene 3–30 caracteres (letras, números y `_`), se guarda tal como se escribió
(con mayúsculas) y es único sin distinguir mayúsculas. **El login es con username** (en
cualquier combinación de mayúsculas) y contraseña; el email no se usa para entrar.

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
  con `@Public()`. Los endpoints de negocio solo deben usar `@CurrentUser()`. El catálogo usa
  `@OptionalAuth()`: es público, pero si llega una sesión válida la reconoce (`@OptionalUser()`);
  una sesión inválida o no verificada se trata igual que siempre (cookie borrada, sesión
  revocada) y el pedido sigue como anónimo.
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

El catálogo es **público** (la Home y las fichas se ven sin sesión). Sin sesión, la búsqueda no
incluye juegos manuales y la ficha no muestra "Tu juego". Cada endpoint tiene límite por IP y
minuto: búsqueda y ficha 60, destacados 30, imágenes 600.

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

### Explorar: Descubrir y Lanzamientos

Públicos, con límite por IP (60/min; recomendaciones 30/min). Con sesión, cada juego indica en qué
plataformas ya está en la biblioteca (`libraryPlatformIds`) y si está en la wishlist
(`wishlistItemId`). No importan nada: las tarjetas abren la ficha del catálogo.

| Endpoint                                                     | Descripción                                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `GET /api/catalog/discover?platform&genre&release&sort&page` | Catálogo filtrado (slugs; `release` = `upcoming`, `recent` o un año), 24 por página |
| `GET /api/catalog/recommendations`                           | Personalizadas con 3+ juegos del catálogo; si no, populares de los últimos dos años |
| `GET /api/catalog/releases?from&to&platform&genre`           | Lanzamientos del rango (máx. 93 días) con fecha confirmada (`day`) o estimada       |
| `GET /api/catalog/releases/undated?platform&genre`           | Juegos anunciados sin fecha                                                         |

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
  completada; si no, PLAYED si alguna está jugada; si no, PENDING), inicio (el inicio más antiguo), finalización (la **primera**
  finalización) y tiempo total (suma de las partidas).
- **Tiempo** siempre en minutos enteros. Cada sesión pertenece a una partida y suma su duración
  al tiempo de esa partida: **tiempo de la partida = tiempo previo (opcional) + sus sesiones**. El
  tiempo previo cubre lo jugado antes de registrar sesiones o una partida vieja. El tiempo del juego
  es la suma de sus partidas.
- **Dificultades:** dos listas propias por UserGame (partidas y platino), con valores por defecto,
  editables y reordenables; una dificultad en uso no se puede eliminar.
- **Platino:** independiente del estado, del tiempo de juego y de la dificultad de las partidas.
  Marcarlo tilda todos los logros pendientes con la fecha del platino; quitarlo no los destilda.
- **Propiedad:** todos los endpoints exigen sesión y verifican que el recurso sea del usuario; los
  datos de otro usuario responden 404.

| Endpoint                                                                           | Descripción                                                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /api/library`                                                                 | Lista con `search`, `status`, `platformId`, `genreId`, `platinum`, `sort`, `order` |
| `POST /api/library`                                                                | Agrega un juego (`gameId`, `catalog` o `manualGame`) en una plataforma             |
| `GET / PATCH / DELETE /api/library/:id`                                            | Detalle, valoración, nota general y favorito (`favorite`), eliminación             |
| `GET / POST /api/library/:id/playthroughs`                                         | Partidas                                                                           |
| `PATCH / DELETE /api/library/:id/playthroughs/:pid`                                | Editar / eliminar partida (no la #1)                                               |
| `POST /api/library/:id/playthroughs/:pid/sessions`                                 | Registrar sesión en una partida                                                    |
| `GET /api/library/:id/sessions`, `PATCH / DELETE …/sessions/:sid`                  | Sesiones                                                                           |
| `GET / PUT /api/library/:id/platinum`                                              | Platino                                                                            |
| `GET / POST /api/library/:id/difficulties`, `PATCH / DELETE …/:did`, `PUT …/order` | Dificultades                                                                       |

## Navegación (frontend)

El header tiene el logo, el **buscador global del catálogo** y la navegación principal (Inicio,
Mis juegos, Mi perfil y **Explorar**, un menú con Descubrir, Lanzamientos, Noticias, Ofertas y Mi
wishlist); en mobile la navegación pasa a un menú lateral y el buscador queda visible. Sin sesión
muestra Inicio, Explorar, **Iniciar sesión** y **Crear cuenta**.

| Ruta                             | Pantalla                                                        |
| -------------------------------- | --------------------------------------------------------------- |
| `/`                              | Inicio (pública): hero, juegos recientes/próximos y funciones   |
| `/catalog/:provider/:externalId` | Juego del catálogo (pública) con **+ Agregar juego**            |
| `/games`                         | Mis juegos: búsqueda, filtros y orden de la biblioteca personal |
| `/games/:id`                     | Mi juego: partidas, sesiones, platino, dificultades y notas     |
| `/profile`                       | Ficha del jugador: avatar, username, estadísticas y cuenta      |
| `/discover`                      | Descubrir (pública): recomendaciones, destacados y catálogo     |
| `/releases`                      | Calendario de lanzamientos (pública)                            |
| `/news`                          | Noticias (pública)                                              |
| `/deals`                         | Ofertas (pública)                                               |
| `/wishlist`                      | Mi wishlist: precios y precio objetivo                          |
| `/register`, `/login`            | Registro e inicio de sesión (solo sin sesión)                   |
| `/verify-email?email=…`          | "Verificá tu email": código de 6 dígitos y reenvío              |
| `/terms`, `/privacy`             | Términos de uso y Política de privacidad (públicas, borrador)   |

Flujo para agregar un juego: buscador global → página del catálogo → **Agregar juego** → modal
(plataforma entre las que informa el catálogo, estado inicial, fechas, dificultad, valoración) →
se crea el UserGame con la partida #1 configurada → se abre "Mi juego". Los juegos manuales se
agregan desde Mis juegos con el mismo modal y nunca aparecen en el catálogo.

La Home usa `GET /api/catalog/highlights`: los juegos más esperados (por "hypes" de IGDB)
lanzados en los últimos 180 días y los próximos lanzamientos, sin contenido adulto. Se cachean
una hora, no se importa ni se guarda nada, y las imágenes pasan por el proxy
(`?size=artwork` para el fondo del hero, que se elige al azar en cada visita). Si IGDB no
responde, la Home oculta esas secciones. Además suma juegos recomendados, noticias destacadas y
ofertas recomendadas, cada uno con "Ver todo" a su sección; noticias y ofertas se ocultan si su
fuente no está configurada o no responde.

La ficha del juego muestra el resumen (con scroll propio si es muy largo), "Tu juego" si está
en tu biblioteca, una galería de capturas con visor y "Juegos relacionados" (los juegos similares
que informa IGDB). Capturas y relacionados no se guardan nunca.

La página del catálogo usa `GET /api/catalog/games/:provider/:externalId`: si el juego ya fue
importado responde desde la base (funciona aunque IGDB esté caído); si no, consulta IGDB **sin
guardar nada**. Los juegos manuales no tienen ID externo, así que nunca son accesibles por esa ruta.

## Ofertas y wishlist

Arquitectura: `PriceProvider` (interfaz) → `ItadProvider` (IsThereAnyDeal API v2). Para
activarlas, creá una cuenta en IsThereAnyDeal, registrá una app en
<https://isthereanydeal.com/apps/my/> y poné su clave en `ITAD_API_KEY` (revisá sus
[condiciones](https://docs.isthereanydeal.com/): piden mencionarlos y no alterar los datos). La
clave viaja en un header y nunca llega al frontend. Los precios se muestran en la moneda que
informa la fuente (no se convierten); hoy cubre tiendas de PC.

**País de los precios** (decisión #68): cada endpoint acepta `?country=` (ISO 3166-1 alfa-2,
por ejemplo `AU`; si falta, `ITAD_COUNTRY`). El frontend manda el país del perfil del usuario
(`PUT /api/profile/country`), si no el elegido en ese navegador, si no la región del idioma del
navegador (`en-AU` → Australia). Se cambia desde Ofertas, la wishlist o el perfil.

| Endpoint                                                                          | Sesión | Descripción                                                                                                    |
| --------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `GET /api/deals?country&sort&shops&platform&type&minCut&minPrice&maxPrice&offset` | no     | Ofertas (24 por página); `sort` = `relevance` (popularidad), `cut` o `price`; `type` = `game`, `dlc` u `other` |
| `GET /api/deals/shops`                                                            | no     | Tiendas del país                                                                                               |
| `GET /api/deals/recommended`                                                      | no     | Para la Home: primero ofertas de la wishlist y pendientes, luego generales                                     |
| `GET /api/deals/games/:provider/:externalId?country`                              | no     | Precios de PC de un juego del catálogo (ficha del juego): una fila por tienda, la más barata primero           |
| `GET / POST /api/wishlist`                                                        | sí     | Lista con precios / agrega un juego del catálogo (`{ provider, externalId }`)                                  |
| `PATCH / DELETE /api/wishlist/:id`                                                | sí     | Precio objetivo (`{ targetPrice }`, `null` lo quita) / quitar                                                  |
| `GET /api/wishlist/:id/history`                                                   | sí     | Historial real de precios del último año                                                                       |

Todas responden `configured`/`available`: sin clave o si la fuente falla, la interfaz lo
explica y no inventa precios. El descuento se calcula de los precios reales. "Alcanzó tu precio
objetivo" se muestra en la app (no se envían emails ni hay tareas programadas).

## Comunidad: amigos y actividad

Decisiones #84 a #88.

- **Amigos:** amistad mutua con solicitud. Se busca a otros jugadores por parte del username
  (3 letras o más; solo username y foto, nunca el email). Si los dos se mandan solicitud, quedan
  amigos. El contador de solicitudes pendientes aparece en el menú **Comunidad** del encabezado.
- **Visibilidad:** cada usuario elige en su perfil "Mis amigos" (por defecto) o "Solo yo". Los
  amigos ven estadísticas, destacados, biblioteca (con notas), lista de deseos y actividad, todo
  en solo lectura. Nadie más ve nada.
- **Bloquear:** corta la amistad y las solicitudes, oculta a cada uno en la búsqueda del otro y
  no deja ver nada. No se avisa.
- **Denuncias:** foto o username ofensivo; se guardan en `user_reports` y se envían por email a
  `ADMIN_EMAIL`. El administrador actúa a mano.
- **Actividad:** se registran juegos agregados, cambios de estado de partidas, platinos, logros,
  valoraciones, favoritos y lista de deseos. Los eventos repetidos del mismo juego en una hora se
  agrupan; lo de Steam se agrupa ("Agregó 40 juegos desde Steam"). Solo lectura, sin "me gusta".
- **Documentos legales:** cuando cambian, el usuario tiene que aceptarlos para seguir usando la
  app (la API responde `403 LEGAL_ACCEPTANCE_REQUIRED` salvo en `/auth/me`, aceptar y eliminar
  la cuenta).

| Endpoint                                                 | Descripción                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| `GET /api/users/search?q=`                               | Jugadores por parte del username, con la relación           |
| `GET /api/users/:username/avatar`                        | Foto de perfil de otro jugador (si no hay bloqueo)          |
| `GET /api/friends`                                       | Amigos, solicitudes recibidas y enviadas                    |
| `POST /api/friends/requests`                             | `{ username }`: envía una solicitud (o acepta la del otro)  |
| `POST /api/friends/requests/:username/accept`            | Acepta una solicitud                                        |
| `DELETE /api/friends/requests/:username`                 | Rechaza o cancela una solicitud                             |
| `DELETE /api/friends/:username`                          | Elimina un amigo                                            |
| `GET / POST /api/blocks`, `DELETE /api/blocks/:username` | Bloqueados: listar, bloquear, desbloquear                   |
| `PUT /api/profile/visibility`                            | `{ visibility: FRIENDS \| PRIVATE }`                        |
| `POST /api/reports`                                      | `{ username, reason, details? }`: denuncia                  |
| `GET /api/users/:username/profile`                       | Perfil de un amigo (o el propio): estadísticas y destacados |
| `GET /api/users/:username/library[/:id]`                 | Biblioteca de un amigo y un juego, en solo lectura          |
| `GET /api/users/:username/wishlist`                      | Lista de deseos de un amigo                                 |
| `GET /api/activity?cursor=`                              | Actividad propia y de los amigos, paginada                  |
| `GET /api/users/:username/activity?cursor=`              | Actividad de un amigo                                       |
| `POST /api/auth/accept-legal`                            | Acepta la versión vigente de los Términos y la Política     |

## Steam y logros

Decisión #78. El usuario vincula su cuenta de Steam desde **Mis juegos** con el login oficial de
Steam (OpenID: nunca recibimos su contraseña). Clave gratuita en
<https://steamcommunity.com/dev/apikey> → `STEAM_API_KEY`.

- **Importación:** la sincronización busca los juegos de la cuenta con **1 hora o más** y los
  ofrece en un modal (decisión #80), todos tildados: el usuario destilda los que no quiere. Los
  elegidos entran a Mis juegos en PC como "Jugado", con sus horas; los que no, pasan a juegos
  quitados. Los que están en IGDB se cruzan por su ID de Steam; los que no, entran como juegos
  manuales (con la portada de Steam) y la card lo indica. Si el juego ya estaba en PC, se vincula
  sin duplicarse (el modal lo avisa). Las sincronizaciones siguientes ofrecen solo los juegos
  nuevos.
- **Horas:** el tiempo de Steam es la base de la partida #1 (`steam_minutes`); los cambios del
  usuario (sumar o restar) se guardan aparte como tiempo previo, con su historial
  (`playthrough_time_adjustments`), y se mantienen encima de Steam en cada sincronización.
- **Logros:** los de Steam se importan en inglés y español (se muestran según el idioma de la
  app) con la fecha de desbloqueo. Cualquier logro se puede tildar o destildar; una
  sincronización solo tilda los desbloqueados de nuevo en Steam. Todo juego (también de consola)
  puede tener logros propios del usuario.
- **Sincronización:** automática al abrir Mis juegos si la última tiene 6 horas o más, y con el
  botón "Sincronizar ahora" (mínimo 5 minutos entre usos). Corre en segundo plano y la interfaz
  muestra el progreso. Los logros solo se piden de los juegos jugados desde la última vez.
- **Platino automático:** cuando todos los logros de Steam de un juego vinculado quedan
  desbloqueados en Steam, la sincronización le pone el platino (si no lo tiene), con la fecha del
  último logro y el tiempo total del juego. Si el usuario lo quita, no se vuelve a poner hasta que
  el juego sume logros nuevos y se completen (decisión #81).
- **Juegos quitados:** si el usuario borra un juego de Steam o lo destilda en el modal, no vuelve
  a ofrecerse hasta que lo restaure desde el panel de Steam (restaurarlo lo agrega directamente).
- **Desvincular:** el usuario elige dejar los juegos (quedan con sus horas y logros) o borrar los
  que trajo Steam; los que ya tenía en PC antes de vincular quedan, sin las horas ni los logros de
  Steam. En los dos casos se olvida la lista de juegos quitados.
- **Perfil privado:** Steam no devuelve nada; la app explica cómo hacer públicos los "Detalles de
  los juegos".

| Endpoint                                                   | Descripción                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| `GET /api/steam`                                           | Estado: configurado, cuenta vinculada, sincronización y juegos quitados     |
| `GET /api/steam/link` → `GET /api/steam/callback`          | Login de Steam (navegación del navegador); vuelve a `/games?steam=...`      |
| `POST /api/steam/sync`                                     | `{ auto }`: automática (si pasaron 6 h) o manual (`429` antes de 5 minutos) |
| `DELETE /api/steam?deleteGames=`                           | Desvincular; `true` borra los juegos que trajo Steam                        |
| `GET /api/steam/pending`                                   | Juegos encontrados que esperan la revisión del usuario                      |
| `POST /api/steam/pending`                                  | `{ appIds }`: agrega los elegidos; el resto pasa a juegos quitados          |
| `DELETE /api/steam/excluded/:appId`                        | Restaurar (agregar) un juego quitado                                        |
| `POST / PATCH / DELETE /api/library/:id/achievements[/:a]` | Logros: agregar uno propio / tildar o editar / borrar uno propio            |

## Noticias

`GET /api/news?lang&category&q&page` (público, 60/min): titulares de los feeds RSS/Atom del
idioma de la interfaz (decisión #68): `lang=es` lee `NEWS_RSS_FEEDS_ES` y `lang=en` lee
`NEWS_RSS_FEEDS_EN` (por defecto `es`). Si un idioma no tiene feeds se usan los del otro y la
respuesta lo indica en `language`. Ejemplos en `.env.example`; revisá las condiciones de cada
medio. Solo se usan título, resumen corto, imagen, medio, fecha y enlace al
artículo original, en memoria y con caché de 15 minutos. `category` = `playstation`, `xbox`,
`nintendo`, `pc` o `general`.

## Perfil

`/profile` es la "ficha del jugador": avatar, username, estadísticas con los datos reales del
usuario y la cuenta (email y cierre de sesión). A la derecha, una columna de destacados: los
**juegos favoritos** (hasta 5, se marcan con el corazón en Mis juegos o en Mi juego), el juego
más jugado (más tiempo total), el pasado más rápido (la partida completada con menos tiempo
registrado, mayor a cero) y los de mayor y menor puntuación (el de menor solo con dos o más
juegos valorados). Los empates se resuelven por nombre.

| Endpoint                        | Descripción                                                              |
| ------------------------------- | ------------------------------------------------------------------------ |
| `GET /api/profile/stats`        | Juegos registrados, completados, en progreso, pendientes, platinos, etc. |
| `GET /api/profile/highlights`   | Favoritos, más jugado, pasado más rápido, mayor y menor puntuación       |
| `PUT /api/profile/country`      | País de los precios (`{ "country": "AU" }`, `null` lo quita)             |
| `PUT /api/profile/avatar`       | Elige un avatar predeterminado (`{ "preset": "knight" }`)                |
| `PUT /api/profile/avatar/image` | Sube una foto: cuerpo binario JPG/PNG/WebP, máximo 2 MB                  |
| `DELETE /api/profile/avatar`    | Quita el avatar                                                          |
| `GET /api/profile/avatar/image` | Devuelve la foto subida del usuario actual                               |

- **Avatares predeterminados:** 12 ilustraciones SVG propias, inspiradas en arquetipos gamer
  (`frontend/src/features/profile/AvatarIllustration.tsx`). No se usan personajes con copyright.
- **Foto propia:** el formato se detecta por el contenido (no por la extensión ni el
  `Content-Type`), se guarda con el mismo almacenamiento de las portadas en
  `avatars/<sha256>.<ext>` y **nunca** se sirve por la ruta pública de assets: solo su dueño la
  ve, con sesión. Al reemplazarla o quitarla se borra el archivo si nadie más lo usa.
- **Horas jugadas** = suma del tiempo de todas las partidas (el tiempo del platino es aparte).

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

## Producción (Railway)

Decisión #89. La app se publica como **un único servicio**: la imagen Docker (`Dockerfile` en
la raíz) construye el frontend y el backend, y la API sirve el frontend en el mismo dominio (así la
cookie de sesión funciona sin CORS). Al arrancar aplica las migraciones pendientes. Railway lee
`railway.json`: build con el Dockerfile, chequeo de salud en `GET /api/health` (verifica la
base) y una sola réplica (las sincronizaciones de Steam y algunos cachés viven en memoria).

- **Base de datos:** el plugin PostgreSQL de Railway.
- **Archivos:** portadas y fotos de perfil en un **volumen montado en `/data`**
  (`ASSET_STORAGE_LOCAL_DIR=/data/storage`, ya definido en la imagen).
- **Proxy:** `TRUST_PROXY_HOPS=1` (en la imagen) para leer la IP real del usuario detrás del proxy
  de Railway; con `NODE_ENV=production` la cookie de sesión es `Secure`, `HttpOnly` y
  `SameSite=Lax`. HTTPS lo da Railway (o Cloudflare).
- **Deploys:** cada push a `main` publica una versión nueva.

### Variables del servicio en Railway

| Variable                                 | Valor                                         | Notas                                                                                                      |
| ---------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `POSTGRES_HOST`                          | `${{Postgres.PGHOST}}`                        | Referencias al plugin de Postgres                                                                          |
| `POSTGRES_PORT`                          | `${{Postgres.PGPORT}}`                        |                                                                                                            |
| `POSTGRES_USER`                          | `${{Postgres.PGUSER}}`                        |                                                                                                            |
| `POSTGRES_PASSWORD`                      | `${{Postgres.PGPASSWORD}}`                    |                                                                                                            |
| `POSTGRES_DB`                            | `${{Postgres.PGDATABASE}}`                    |                                                                                                            |
| `AUTH_SECRET`                            | 64+ caracteres al azar                        | **Secreto**. Generalo con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `FRONTEND_ORIGIN`                        | `https://game-tracker.com.ar`                 | Sin barra final. Emails y login de Steam vuelven acá                                                       |
| `RESEND_API_KEY`                         | tu clave de Resend                            | **Secreto**                                                                                                |
| `EMAIL_FROM`                             | `Game Tracker <no-reply@game-tracker.com.ar>` | Dominio verificado en Resend                                                                               |
| `ADMIN_EMAIL`                            | `contacto@game-tracker.com.ar`                | Recibe las denuncias                                                                                       |
| `VITE_CONTACT_EMAIL`                     | `contacto@game-tracker.com.ar`                | Se usa al **construir**: aparece en Términos y Privacidad                                                  |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`   | tus credenciales de Twitch                    | **Secreto** el segundo                                                                                     |
| `ITAD_API_KEY`                           | tu clave de IsThereAnyDeal                    | **Secreto**. Opcional (Ofertas)                                                                            |
| `ITAD_COUNTRY`                           | `AR`                                          | País por defecto de los precios                                                                            |
| `STEAM_API_KEY`                          | tu clave de Steam                             | **Secreto**. Opcional (Steam)                                                                              |
| `NEWS_RSS_FEEDS_ES`, `NEWS_RSS_FEEDS_EN` | las URLs de los feeds                         | Opcional (Noticias)                                                                                        |

El resto toma valores por defecto (ver `.env.example`). La imagen ya define `NODE_ENV=production`,
`FRONTEND_DIST_DIR`, `DB_MIGRATIONS_RUN=true`, `ASSET_STORAGE_LOCAL_DIR=/data/storage` y
`TRUST_PROXY_HOPS=1`; Railway define `PORT`. Los secretos se cargan solo en Railway: nunca van al
repositorio.

### Probar la imagen localmente

```bash
docker build -t game-tracker .
docker run --env-file .env -e POSTGRES_HOST=host.docker.internal -e PORT=3200 \
  -e FRONTEND_ORIGIN=http://localhost:3200 -e TRUST_PROXY_HOPS=0 -p 3200:3200 game-tracker
```

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
- **Explorar** (decisiones #64–#67): Descubrir, Lanzamientos, Noticias, Ofertas y wishlist.
