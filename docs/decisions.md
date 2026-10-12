# Decisiones funcionales

Registro de las decisiones tomadas sobre puntos que la especificación original no definía.
Ante una contradicción entre este documento y el código, este documento manda (y se corrige el
código o se actualiza la decisión explícitamente).

## Fase 0 (2026-10-04)

1. **Autenticación:** sesiones persistidas en PostgreSQL + cookie HttpOnly. No JWT. El logout
   invalida la sesión en el servidor.
2. **Registro:** abierto a cualquiera. Solo email + password (sin username). Verificación de
   email, recuperación de contraseña y OAuth quedan fuera de V1.
3. **Dificultades de partida:** cada `UserGame` tiene su propia lista (aunque compartan `Game`).
   Se eliminan junto con el `UserGame`.
4. **Dificultades de platino:** lista propia e independiente por `UserGame`. Se inicializa con
   Muy fácil, Fácil, Normal, Difícil, Muy difícil. Editable, ampliable y reordenable; una
   dificultad en uso no puede eliminarse.
5. **Fechas del `UserGame`:** no se almacenan; se calculan desde los Playthroughs.
   Inicio = fecha de inicio más antigua. Finalización = primera fecha en que se completó un
   Playthrough.
6. **Horas del `UserGame`:** suma de los tiempos de todos sus Playthroughs.
7. **Plataformas:** tabla global `Platform` precargada por la aplicación. IGDB informa las
   plataformas de cada juego (`GamePlatform`); al agregar un juego solo se pueden elegir esas.
   El usuario no crea plataformas.
8. **Juegos fuera de IGDB:** se pueden agregar manualmente. Mínimo: nombre + plataforma; el
   resto de datos de catálogo puede quedar vacío.
9. **Cambio de modo de tiempo:** permitido. _Reemplazada por #61 (ya no hay modos)._
   - MANUAL → SESSIONS: ofrecer crear una sesión inicial con el tiempo manual existente.
   - SESSIONS → MANUAL: el total actual pasa a ser el tiempo manual; las sesiones se conservan
     pero no cuentan mientras el modo sea MANUAL.
   - La primera partida usa MANUAL por defecto.
10. **Estado y fechas de partida:** PENDING e IN_PROGRESS no pueden tener fecha de
    finalización; COMPLETED la requiere. Cambiar de estado no borra datos históricos
    innecesariamente.
11. **Última partida:** no se puede eliminar; todo `UserGame` tiene al menos un Playthrough.
12. **Sesiones:** no se permiten sesiones futuras. Al registrar una sesión desde el detalle se
    elige el Playthrough; solo se ofrecen los que están en modo SESSIONS.
13. **Tiempo del platino:** carga manual en minutos; no se calcula.
14. **Catálogo:** las búsquedas consultan DB/cache y el proveedor cuando haga falta. No se
    persisten todos los resultados; el juego se importa al registrarlo en la biblioteca. Sin
    sincronización automática posterior en V1.
15. **Portadas:** se descargan y se almacenan localmente mediante una abstracción de
    almacenamiento de assets (local en desarrollo, preparada para S3 u otro).
16. **Idioma:** V1 solo en español, sin i18n completo, pero con los textos centralizados para
    facilitar internacionalización futura.
17. **Notas:** texto plano, máximo 5.000 caracteres. Sin Markdown.

## Fase 2 — Autenticación (2026-10-04)

18. **Contraseñas:** mínimo 8, máximo 128 caracteres, sin reglas de composición (NIST 800-63B).
19. **Registro:** deja al usuario logueado automáticamente. _Reemplazada por #45._
20. **Expiración de sesión:** deslizante. Duración `AUTH_SESSION_TTL_DAYS` (30 días por
    defecto); el uso renueva la expiración, como máximo una vez por día.
21. **Alcance de la Fase 2:** backend + frontend (login, registro, logout, rutas protegidas).

## Fase 3 — Catálogo base (2026-10-04)

22. **Plataformas precargadas:** lista amplia, incluye retro (PlayStation, Xbox, Nintendo, PC,
    móviles y Sega). Si IGDB informa una plataforma que no está en la tabla, no se puede elegir.
23. **PC:** una sola plataforma "PC"; las plataformas Windows, Mac y Linux de IGDB se mapean a ella.
24. **Juegos manuales:** privados del usuario que los creó (no aparecen para otros usuarios). Para
    un juego manual se puede elegir cualquier plataforma.
25. **Géneros:** se guardan con nombre en español para la lista fija de géneros de IGDB. Un género
    desconocido usará el nombre de IGDB hasta traducirlo.
26. **IDs de IGDB provisionales:** los IDs externos de plataformas y géneros cargados en la Fase 3
    no fueron verificados contra la API y son provisionales hasta validarlos en la Fase 4. Nunca se
    cargan IDs no verificados; los faltantes o incorrectos se corrigen con una migración nueva.

## Fase 4 — Catálogo externo (2026-10-04)

27. **Tipos de entrada de IGDB:** se buscan e importan juego principal, remake, remaster, port,
    versión expandida y expansión independiente. Se excluyen DLC, expansiones, bundles, mods,
    episodios, temporadas, packs y updates.
28. **Búsqueda:** consulta IGDB y combina con los juegos ya importados y con los juegos manuales
    del propio usuario, marcando los ya importados. Si IGDB falla, devuelve solo los resultados
    locales e indica que el catálogo externo no está disponible.
29. **Resumen:** se guarda y se muestra en inglés, tal como lo provee IGDB.
30. **Miniaturas de búsqueda:** el backend hace de proxy hacia el CDN de imágenes de IGDB, sin
    almacenarlas. La portada se descarga y se almacena al importar el juego (#15).
31. **IDs de IGDB verificados (2026-10-06):** `catalog:verify-igdb` contra la API real confirmó
    los 33 mapeos de plataformas, los 23 de géneros y los 6 tipos de juego permitidos. Se agregó
    Nintendo Switch 2 = **508** (migración `MapSwitch2ToIgdb`). Los IDs dejan de ser
    provisionales (#26).

## V1 — Fases 5 a 12 (2026-10-06)

Decisiones definidas en el prompt de cierre de V1; aquí solo las interpretaciones y las
decisiones técnicas que afectan el comportamiento.

32. **Valores derivados:** el estado del `UserGame`, su fecha de inicio (inicio más antiguo), su
    fecha de finalización (la **primera** finalización) y su tiempo total se calculan en vistas
    de PostgreSQL (`playthrough_times`, `user_game_summaries`); nunca se almacenan.
33. **Juegos manuales:** eliminar un `UserGame` no elimina el juego manual; sigue siendo privado
    de su creador y puede volver a agregarse.
34. **Salir de COMPLETED:** cuando una partida deja de estar completada se borra solo su fecha de
    finalización (PENDING e IN_PROGRESS no pueden tenerla); nombre, inicio, dificultad, tiempo,
    sesiones y notas se conservan.
35. **Fechas futuras:** las fechas son días de calendario sin zona horaria. El backend acepta
    como máximo "hoy" en la zona horaria más adelantada (UTC+14), para no rechazar el "hoy" local
    de ningún usuario; el frontend valida contra el "hoy" local. Los timestamps (sesiones)
    toleran 5 minutos de desfase de reloj.
36. **Dificultades:** los nombres son únicos dentro de cada lista (sin distinguir mayúsculas),
    para que la elección no sea ambigua. Una dificultad en uso se puede renombrar pero no
    eliminar (protegido también por la base). No se implementa "restaurar valores
    predeterminados": no existía en el modelo.
37. _(Reemplazada por #61.)_ **MANUAL → SESSIONS:** la creación de la sesión inicial con el tiempo manual se ofrece
    (preseleccionada en la UI); si el usuario la rechaza, el tiempo manual queda guardado pero
    no cuenta mientras la partida esté en modo sesiones. Las sesiones se pueden editar y eliminar
    en cualquier modo; solo se pueden **agregar** en modo SESSIONS.
38. **Platino:** con `platinumAchieved=false` se borran fecha, tiempo y dificultad (la base
    garantiza que no existan). Con `true`, fecha y tiempo (≥ 1 minuto) son obligatorios y la
    dificultad es opcional. La regla "fecha de platino ≥ inicio del juego" se protege en ambos
    sentidos: tampoco se permite cambiar el inicio de una partida si eso dejaría el platino antes
    del inicio del juego.
39. **Orden de la biblioteca:** los juegos sin valor en el campo de orden (sin valoración, sin
    inicio, sin finalización) van siempre al final, en ambas direcciones; los empates se
    resuelven por nombre. Dirección por defecto: nombre A-Z; el resto, del mayor/más reciente al
    menor. El orden por defecto es "fecha de agregado", más reciente primero.
40. **Filtros de la biblioteca:** se guardan en la URL (compartible y compatible con "atrás").
    La lista se devuelve completa (sin paginación): es una biblioteca personal.

## Navegación y catálogo (2026-10-07)

41. **Inicio propio:** `/` es una Home de presentación (sin estadísticas ni contenido de V2/V3);
    Mis juegos pasa a `/games`. La Home sigue requiriendo sesión, como antes `/`.
42. **Página del catálogo por proveedor + ID externo** (`/catalog/igdb/:externalId`): los
    resultados de búsqueda no importados no tienen ID local y no se persisten al verlos (#14).
    Los juegos manuales no tienen ID externo: no tienen página de catálogo ni aparecen en el
    buscador global.
43. **Agregar con configuración:** el modal define plataforma (solo las del catálogo; las ya
    registradas aparecen deshabilitadas), estado inicial, fechas (finalización obligatoria si se
    elige "Completado"), dificultad (de la lista por defecto; "Normal" preseleccionada) y
    valoración opcional. Todo se crea en una sola transacción.
44. **Juegos de catálogo desde Mis juegos:** elegir un resultado abre su página del catálogo
    (un único camino para agregarlos). Los juegos manuales se agregan con el mismo modal.

## Username y verificación de email (2026-10-06)

45. **Registro sin sesión:** el registro pide username, email, contraseña y la aceptación de
    Términos de uso y Política de privacidad (un checkbox, links separados), crea la cuenta **no
    verificada** y envía un código de 6 dígitos. No abre sesión; tras verificar, el usuario
    vuelve al login. El login de una cuenta no verificada responde `403 EMAIL_NOT_VERIFIED`
    (solo después de validar la contraseña, para no revelar qué emails existen).
46. **Bloqueo total de no verificados:** el guard global rechaza cualquier endpoint autenticado
    de un usuario no verificado y revoca esa sesión. Excepciones: verificación y reenvío, que
    son públicos.
47. **Códigos:** CSPRNG, 10 minutos, un solo uso, guardados como HMAC-SHA256 con `AUTH_SECRET`.
    Máximo 5 intentos fallidos por código. Reenvío con cooldown de 60 s por cuenta, rate limit
    por IP y respuesta idéntica exista o no la cuenta. Si el email de registro no se puede
    enviar, la cuenta no se crea.
48. **Username:** 3–30 caracteres `[a-z0-9_]`, se guarda en minúsculas (único sin distinguir
    mayúsculas). El login sigue siendo con email.
49. **Usuarios existentes:** se eliminaron antes de la migración (decisión del usuario: base
    limpia). La migración se niega a correr si quedan usuarios, en lugar de inventarles username
    o aceptación de términos.
50. **Términos y privacidad:** se guarda fecha y versión aceptada de cada documento (versión
    `2026-10-06`). Las páginas `/terms` y `/privacy` tienen un texto provisional marcado como
    borrador, a reemplazar por el definitivo.
51. **Emails con Resend** detrás de la abstracción `EmailService` (`ResendEmailService`; tests con
    `MockEmailService`). `RESEND_API_KEY` y `EMAIL_FROM` son obligatorias para arrancar; no hay
    modo que imprima códigos en consola.
52. **CAPTCHA:** no se implementa ahora; los endpoints públicos quedan listos para sumar un guard
    (p. ej. Cloudflare Turnstile).

## Home con contenido del catálogo (2026-10-07)

53. **Destacados de la Home:** dos filas con datos reales de IGDB: lanzamientos recientes (los
    más esperados, por "hypes", salidos en los últimos 180 días) y próximos lanzamientos (por
    "hypes"). Solo tipos permitidos (#27), con portada y sin contenido adulto. Caché de una hora;
    no se persiste nada. El fondo del hero es el artwork (o una captura) de uno de esos juegos,
    elegido al azar en cada visita.

## Idiomas (2026-10-07)

54. **Español e inglés:** selector con bandera en el header. La elección se guarda en el navegador
    (sin migración; también funciona sin sesión). Por defecto, español. Se traducen la interfaz,
    los formatos de fecha y los nombres de los géneros precargados. No se traducen los resúmenes
    de IGDB, los nombres de plataformas ni los datos del usuario (por ejemplo, los nombres de sus
    dificultades, que se crean en español). Banderas en SVG porque Windows no muestra los emojis
    de banderas.

## Identidad visual en toda la app (2026-10-07)

55. **Artwork de fondo:** la Home, la ficha del juego y el modal de agregar usan una imagen
    ancha de IGDB: el artwork apaisado más grande (de al menos 1280 px de ancho; los más chicos
    suelen ser logos) o, si no hay, una captura. No se guarda al importar: para juegos ya
    importados se pide al proveedor (con caché) y, si no responde, la ficha se muestra sin él.
56. **Avatar:** un avatar predeterminado (12 ilustraciones propias en SVG, sin personajes con
    copyright) o una foto propia JPG/PNG/WebP de hasta 2 MB, validada por contenido. La foto es
    privada: se sirve solo a su dueño por `/api/profile/avatar/image`, nunca por la ruta pública
    de assets (que solo sirve portadas). Sin editor de recorte: se muestra recortada en círculo.
57. **Estadísticas del perfil:** con los datos reales del usuario. Juegos registrados = entradas
    de Mis juegos (un juego en dos plataformas cuenta dos veces). Horas jugadas = suma del tiempo de
    las partidas. Valoración media con un decimal, solo de juegos valorados. Se suman partidas y
    plataforma principal (la de más juegos).
58. **Ficha del juego ampliada:** columna principal con el resumen (con altura máxima y scroll
    propio si es muy largo), "Tu juego" (estado, horas, valoración y platino por plataforma, si
    está en la biblioteca) y una galería de capturas de IGDB con visor; la información del juego
    queda como columna lateral. Debajo, "Juegos relacionados": los `similar_games` de IGDB (tipos
    permitidos, con portada, sin contenido adulto). Capturas y relacionados no se guardan: se
    piden al proveedor con caché y, si no responde, esas secciones no aparecen.
59. **"Mi juego" con la nueva identidad:** encabezado con el artwork del catálogo (portada
    desenfocada para juegos manuales), indicadores de estado, tiempo, valoración y platino, y
    acciones; "Mi juego" a todo el ancho; partidas, sesiones y notas en la columna principal y
    platino y dificultades al costado. Para pedir el artwork, el detalle de un juego de la
    biblioteca expone su `provider` y `externalId` (null en juegos manuales). Sin cambios de datos
    ni de lógica. El modal "Agregar juego" ya no repite la portada (se ve en la página de atrás).
60. **Modales unificados:** todos comparten superficie (`dialogPaperSx`), encabezado con ícono,
    contexto y título, pie de acciones y botón principal en degradé (`DialogChrome`, `FormDialog`).
    Las confirmaciones destructivas usan la variante de peligro (rojo). Se agregó un botón "Cerrar"
    en el encabezado, equivalente a "Cancelar". Sin cambios de campos, validaciones ni lógica.

## Partidas y sesiones, sin modos (2026-10-07)

61. **Tiempo previo + sesiones:** desaparecen los modos MANUAL/SESSIONS. Cada sesión pertenece a
    una partida y siempre suma: tiempo de la partida = tiempo previo (opcional, se edita en la
    partida) + todas sus sesiones. Las sesiones se registran en cualquier partida y se muestran
    dentro de ella. Migración `UnifyPlaythroughTime`: el tiempo manual pasa a ser el tiempo
    previo; en modo SESSIONS se descarta (se ignoraba); en modo MANUAL con sesiones se le restan
    esas sesiones (venían de un período en sesiones y su suma ya estaba copiada), así ningún total
    cambia. El `down` restaura los modos conservando los totales. Se quitan los endpoints
    `manual-time` y `time-mode`; el tiempo previo se envía como `previousMinutes` al crear o
    editar la partida.

## Home y catálogo públicos (2026-10-07)

62. **Home y catálogo sin sesión:** `/` es siempre la Home y no redirige al login. La Home, la
    búsqueda del catálogo, la ficha `/catalog/...` y el proxy de imágenes son públicos
    (`@OptionalAuth`): con sesión se suman los juegos manuales propios y "Tu juego"; sin
    sesión, nunca datos de nadie. Cada endpoint del catálogo tiene límite por IP (búsqueda y
    ficha 60/min, destacados 30/min, imágenes 600/min) para cuidar la cuota de IGDB. Sin sesión,
    "Tu actividad" se reemplaza por una invitación a crear cuenta, el header y el hero ofrecen
    Iniciar sesión y Crear cuenta, y "Agregar juego" lleva al login y vuelve a la ficha. Mis
    juegos, Mi juego y el perfil siguen exigiendo sesión. Se quita el indicador "API: conectada"
    del header.

## Destacados del perfil y favoritos (2026-10-08)

63. **Destacados del jugador:** el perfil suma una columna derecha con favoritos, juego más
    jugado (más tiempo total del UserGame), pasado más rápido (la partida COMPLETED con menos
    tiempo, ignorando las que no tienen tiempo) y mayor/menor puntuación (la menor solo si hay al
    menos dos juegos valorados, para no repetir el mismo). Empates: por nombre. **Favoritos:**
    hasta 5 por usuario (`FAVORITES_MAX`), en el orden en que se marcaron
    (`user_games.favorite_at`); se marcan con `PATCH /api/library/:id { favorite }` desde la
    tarjeta de Mis juegos o el encabezado de Mi juego. El sexto devuelve `409
FAVORITES_LIMIT_REACHED`; volver a marcar uno ya favorito no cambia su lugar. Migración
    `AddFavoriteGames` (solo agrega una columna).

## Explorar: Descubrir, Lanzamientos, Noticias y Ofertas (2026-10-10)

64. **Explorar y Descubrir:** las secciones nuevas se agrupan en un único botón "Explorar" del
    header (menú con Descubrir, Lanzamientos, Noticias, Ofertas y, con sesión, Mi wishlist; en
    móvil, una sección del menú lateral), visible también sin cuenta. Son públicas; agregar a Mis
    juegos o a la wishlist pide iniciar sesión y vuelve a la página. **Descubrir** reutiliza los
    carruseles de la Home (recientes y próximos) y suma recomendaciones y el catálogo con filtros
    por plataforma, género, lanzamiento (próximamente, últimos 90 días o un año) y orden (más
    populares, mejor valorados, más nuevos, más esperados). Todo sale de IGDB sin importar nada;
    las tarjetas abren la ficha existente `/catalog/...`. Cada tarjeta indica si el juego ya está
    en la biblioteca del usuario (y en qué plataformas) y si está en su wishlist. Los filtros
    usan los slugs de nuestras plataformas y géneros (`GET /api/platforms` y `/api/genres` pasan
    a ser públicos: son datos de referencia). **Recomendaciones:** con al menos 3 juegos del
    catálogo en la biblioteca, juegos similares (según IGDB) a los favoritos y mejor valorados
    (≥ 80) más los mejor valorados de los 3 géneros con más peso (favorito 3, valoración ≥ 80 2,
    ≥ 60 1, sin valorar 0,5, < 50 −1), nunca juegos que ya tiene. Si no, y sin sesión,
    descubrimiento general: los más populares de los últimos dos años.

65. **Lanzamientos:** calendario con vistas "Recién salidos" (últimos 30 días), "Próximos 7 días",
    "Por mes" (con selector de mes) y "Próximos meses" (3 meses), navegables por período, y
    filtros de plataforma y género (`GET /api/catalog/releases?from&to`, rango máximo 93 días).
    Usa las `release_dates` de IGDB agrupadas por juego (su primera fecha en el rango y las
    plataformas de esa fecha). Se distinguen las fechas **confirmadas** (día exacto) de las
    **estimadas** (mes, trimestre o año, según `date_format`), que se agrupan por período. Solo
    juegos con portada y con interés en IGDB (`hypes > 0`): la lista completa tiene miles de
    lanzamientos desconocidos por mes. Cada fecha muestra primero 12 juegos (los más esperados)
    y el resto bajo "Mostrar más". Los juegos anunciados sin fecha van en su propia sección
    (`/releases/undated`). Reutiliza la "hoja de calendario" de la Home (`CalendarBadge`), y el
    panel Descubrí de la Home enlaza al calendario completo.

66. **Ofertas y wishlist:** precios de **IsThereAnyDeal** (proveedor desacoplado
    `PRICE_PROVIDER=itad`), siempre desde el backend con la clave en `ITAD_API_KEY` (va en un
    header, nunca en URLs ni logs) y caché (ofertas 10 min, precios 30 min, historial 6 h,
    tiendas 24 h). País configurable `ITAD_COUNTRY` (por defecto `AR`): los precios se muestran
    en la moneda que devuelve la fuente, sin convertir; en español se muestra el código cuando
    hace falta ("US$") para no confundir dólares con pesos. El **descuento se calcula** de los
    precios reales (redondeado hacia abajo); el mínimo histórico, el mínimo de la tienda y el
    vencimiento solo se muestran si la fuente los informa. Cobertura: tiendas de PC (la fuente no
    tiene consolas). Filtros: tienda, sistema (Windows/Mac/Linux), descuento mínimo y precio
    máximo; orden por relevancia (el de la fuente), mayor descuento o menor precio. Se da
    crédito a IsThereAnyDeal como piden sus condiciones. Sin clave, la página explica qué
    configurar y no muestra nada inventado. **Wishlist:** tabla nueva `wishlist_items` (usuario
    - juego, única por par; hasta 200 juegos), separada de Mis juegos. El juego se importa como al
      agregarlo a la biblioteca: el catálogo sigue siendo la única fuente de juegos. Se agrega o
      quita desde las tarjetas de Descubrir/Lanzamientos y la ficha del catálogo. El cruce con la
      fuente de precios usa el id de Steam que informa IGDB y, si no hay, el título exacto.
      **Precio objetivo** opcional, guardado con la moneda del precio actual (solo se puede fijar
      si la fuente tiene un precio para comparar: `409 PRICE_NOT_AVAILABLE`); el juego se marca
      "Alcanzó tu precio objetivo" cuando el mejor precio actual, en la misma moneda, es menor o
      igual. **Avisos:** solo ese indicador en la app; no hay tareas programadas ni emails.
      **Historial:** solo los cambios reales registrados por la fuente en el último año. Migración
      `AddWishlist` (solo crea la tabla).

67. **Noticias:** feeds RSS/Atom configurables (`NEWS_PROVIDER=rss`, `NEWS_RSS_FEEDS` separados
    por comas, hasta 20); vacío por defecto, con ejemplos en `.env.example`: quien administra
    elige los medios y revisa sus condiciones. Se guarda solo en memoria y solo título, resumen
    corto (280 caracteres, texto plano), imagen (solo https), medio, fecha y enlace al original;
    nunca el artículo completo. Caché de 15 minutos; si todos los feeds fallan se sigue mostrando
    el último resultado por hasta 6 h. Sin duplicados (mismo enlace o mismo título). Categorías
    PlayStation, Xbox, Nintendo y PC por las categorías del feed y palabras del título (una
    noticia puede tener varias); "Gaming general" = ninguna. Búsqueda sin acentos ni
    mayúsculas y carga progresiva de a 12. Se rechazan documentos que declaran entidades XML.
    **Home:** suma, sin quitar nada, juegos recomendados (con "Ver todo" a Descubrir), noticias
    destacadas y ofertas recomendadas (primero las de la wishlist y de juegos pendientes con
    descuento real, después generales), además de "Ver todo" en los carruseles existentes. Los
    módulos de noticias y ofertas se ocultan si la fuente no está configurada o no responde.

68. **Noticias por idioma y precios por país.** Las noticias de videojuegos son globales: lo que
    cambia para cada persona es el idioma, no el país. Cada idioma de la interfaz tiene sus
    propios medios (`NEWS_RSS_FEEDS_ES`, `NEWS_RSS_FEEDS_EN`, reemplazan a `NEWS_RSS_FEEDS`, que
    ya no se lee y solo genera un aviso en el log) con caché separada; `GET /api/news?lang=`. Si
    el idioma pedido no tiene feeds se muestran los del otro, avisándolo. No se detecta el país
    por IP. Los **precios** sí dependen del país (precios regionales, moneda, tiendas), así que
    cada usuario ve los de su país: columna nueva `users.country` (ISO 3166-1 alfa-2, opcional;
    migración `AddUserCountry`), editable en el perfil (`PUT /api/profile/country`) y desde el
    selector de Ofertas y de la wishlist. Sin sesión, la elección se recuerda en el navegador
    (`localStorage`). Si no hay elección se usa la región del idioma del navegador
    (`en-AU` → AU) y, si tampoco hay, `ITAD_COUNTRY`. El frontend manda `?country=` a todos los
    endpoints de precios; las cachés del backend son por país. Se aceptan los 249 códigos ISO
    (IsThereAnyDeal los acepta todos; para algunos, como México o Chile, informa precios en
    dólares). El precio
    objetivo guarda su moneda: si el usuario cambia a un país con otra moneda, "Alcanzó tu
    precio objetivo" no se calcula hasta que lo vuelva a fijar.

69. **Precio en la ficha del juego:** la ficha de un juego del catálogo muestra un panel "Precio
    en PC" con el mejor precio actual en el país del usuario (#68), el descuento calculado, el
    enlace a la tienda, hasta 4 tiendas más y el mínimo histórico si la fuente lo informa
    (`GET /api/deals/games/:provider/:externalId`, público). El nombre del juego para buscarlo
    en la fuente lo resuelve el backend (nunca se toma del cliente, para no contaminar la caché
    de búsquedas). Si la fuente no tiene el juego (por ejemplo, exclusivos de consola), no está
    configurada o falla, el panel no se muestra. Las consolas no tienen precios: no hay una
    fuente gratuita y sostenible (se evaluaron PlatPrices, PSprices y los endpoints internos de
    las tiendas) y por ahora el proyecto solo usa servicios gratuitos.

70. **Completar sin fecha y horas al agregar:** la fecha de finalización de una partida completada
    pasa a ser opcional en todos lados (al agregar el juego y al crear o editar una partida);
    solo las partidas completadas pueden tenerla. Migración `OptionalCompletionDate`: reemplaza el
    CHECK `CHK_playthroughs_completion_matches_status` por
    `CHK_playthroughs_completion_only_completed`; su `down` les pone a las completadas sin fecha
    la de su última modificación (nunca anterior al inicio). La finalización del juego sigue
    siendo la primera fecha de finalización informada; si ninguna partida tiene fecha queda vacía
    y el juego va al final al ordenar por finalización. Al agregar un juego En progreso o
    Completado se pueden cargar las horas dedicadas (opcional), que se guardan como tiempo previo
    de la partida #1 (#61).

71. **Edición rápida en la tarjeta de la partida:** el tiempo y la dificultad de una partida se
    editan directamente en su tarjeta, con un lápiz propio (el resto, como estado, fechas, nombre
    y notas, sigue en el modal de edición). El tiempo se edita como total: el tiempo previo pasa a
    ser total − sesiones, así que el total no puede ser menor que la suma de sus sesiones (para
    bajarlo más hay que editar o borrar sesiones). La dificultad se elige de la lista de la
    partida del juego y se guarda al elegirla.

72. **Dificultad en "Mis juegos" y colores por nivel:** la card de cada juego muestra la dificultad
    **más difícil** entre sus partidas en progreso o completadas (las pendientes y las partidas sin
    dificultad no cuentan; si no hay ninguna, no se muestra nada). La API la informa en
    `difficulty: { name, level, levels }` (lugar 0-based en la lista de dificultades de partida
    del juego y largo de esa lista). Cada dificultad tiene un color según su lugar en su propia
    lista: del verde claro (la primera, la más fácil) pasando por amarillo y naranja hasta un rojo
    muy oscuro (la última), repartido parejo sea cual sea el largo de la lista; si la lista tiene
    un solo elemento, es verde. Además se muestra un medidor con un segmento por nivel (o un punto
    si la lista tiene más de 8). Se ve en la card, en las partidas, en el platino y en las listas
    de dificultades del juego; reordenar la lista cambia los colores.

73. **"Relevancia" en Ofertas = popularidad:** el orden "Relevancia" (y las ofertas recomendadas
    del inicio, que lo usan) pide a IsThereAnyDeal su ranking de popularidad (`sort=rank`). Antes
    no se mandaba ningún orden y la fuente devolvía las ofertas sin un orden útil (sobre todo DLC,
    bandas sonoras y juegos desconocidos), aunque hubiera juegos muy conocidos en oferta.

74. **Filtro "Tipo" en Ofertas:** Todo (por defecto, no se oculta nada), Juegos, DLC y Otros,
    según la clasificación de IsThereAnyDeal: Juegos incluye juegos y paquetes o ediciones; DLC,
    las expansiones, season passes y la mayoría de las bandas sonoras; Otros, lo que la fuente no
    clasifica (algunas bandas sonoras, software, cursos, demos). No hay un tipo "soundtrack"
    confiable, así que no se ofrece. La fuente no filtra por tipo: el backend recorre sus ofertas
    en orden en bloques de 200 (hasta 4 consultas por página) y se queda con las del tipo
    elegido; el `nextOffset` apunta justo después de la última mostrada. Si en esas 4 consultas no
    junta una página completa, devuelve las que encontró y permite seguir cargando. Por eso el
    `offset` máximo de `GET /api/deals` sube a 10.000.

75. **País al registrarse y en la ficha del juego:** el registro pide el país (obligatorio,
    `country` en `POST /api/auth/register`) y lo guarda en el perfil. Viene preseleccionado con el
    país elegido antes en ese navegador o, si no, con la región del idioma del navegador; si no se
    conoce ninguno queda vacío y hay que elegirlo: la app es global y no asume ningún país. Los
    usuarios anteriores sin país siguen con la detección de #68. El panel "Precio en PC" de la
    ficha del juego tiene el mismo selector de país que Ofertas (con sesión lo guarda en el
    perfil). Una vez que el panel se mostró para un juego, si en otro país no hay precios sigue
    visible con un aviso, para poder volver a cambiar el país.

76. **Login con username y usernames con mayúsculas:** el login es con username y contraseña
    (ya no con email); el username se busca sin distinguir mayúsculas. Los usernames se guardan
    tal como se escriben (pueden tener mayúsculas) y siguen siendo únicos sin distinguirlas
    ("Garchi" y "garchi" no pueden coexistir): índice único sobre `lower("username")`. Si la
    cuenta no está verificada, el login (solo después de la contraseña correcta) devuelve el
    email para poder ir a verificarlo. Reemplaza "el login sigue siendo con email" de #48.
    Migración `CaseSensitiveUsernames`; su `down` vuelve a pasar los usernames a minúsculas.

77. **Estado "Jugado" (PLAYED):** cuarto estado de partida, para juegos sin un final que alcanzar
    (por ejemplo online sin historia, como League of Legends). Puede tener fecha de inicio y
    tiempo, pero no fecha de finalización (solo las completadas la tienen). En el estado del juego
    va entre Completado y Pendiente: En progreso > Completado > Jugado > Pendiente. Aparece en
    los filtros de Mis juegos, al agregar un juego, en el modal de la partida y en el perfil
    ("Jugados"; el porcentaje completado sigue siendo completados / total). Su color es el
    violeta de la marca. Las partidas jugadas cuentan para la dificultad de la card (#72).
    Migración `AddPlayedStatus`; su `down` pasa las partidas jugadas a En progreso.

78. **Steam y logros:** Mis juegos permite vincular una cuenta de Steam con el login oficial de
    Steam (OpenID 2.0; una cuenta de Steam por usuario). Se importan los juegos con **1 hora o
    más** (los de menos aparecen cuando la superen), en PC y con estado **Jugado**; los que están en
    IGDB se cruzan por su ID de Steam, los que no entran como manuales con la portada de Steam y la
    card muestra "Manual: no está en el catálogo". Si el juego ya estaba en PC se vincula (sus
    partidas, notas, valoración y horas se conservan). **Horas:** el tiempo de Steam es la base de
    la partida #1 (`steam_minutes`); lo que el usuario suma o resta queda como tiempo previo (que en
    juegos de Steam puede ser negativo, nunca por debajo de cero en total) y cada cambio se guarda
    en `playthrough_time_adjustments`; en cada sincronización se actualiza Steam y los cambios del
    usuario se mantienen encima. **Logros:** de Steam (en inglés y español latinoamericano, según el
    idioma de la app, con fecha de desbloqueo y los ocultos sin descripción hasta mostrarlos) y
    propios del usuario en cualquier juego. Todos se pueden tildar o destildar; la sincronización
    solo tilda los recién desbloqueados en Steam, nunca deshace lo del usuario. Los textos de los de
    Steam no se editan ni se borran. La card muestra el progreso (por ejemplo 12/33).
    **Sincronización:** automática al abrir Mis juegos si la última tiene 6 h o más, y manual con un
    mínimo de 5 minutos; en segundo plano, con progreso visible; los logros se piden solo de los
    juegos jugados desde la última vez. Un juego de Steam borrado de la biblioteca no vuelve hasta
    que el usuario lo restaura. Al desvincular, juegos, horas y logros quedan. Perfil de Steam
    privado: se explica cómo hacerlo público. Migración `AddSteamAndAchievements`; su `down` pasa el
    tiempo de Steam a tiempo previo, así ningún total cambia.

79. **Platino y logros; desvincular Steam:** marcar el platino tilda todos los logros pendientes
    del juego (de Steam y propios) con la fecha del platino; los ya tildados conservan su fecha.
    Quitar el platino no destilda nada. Al desvincular Steam el usuario elige: **dejar los juegos**
    (quedan con sus horas y logros) o **borrar los que trajo Steam** (con sus partidas, notas y
    logros); los juegos que ya tenía en PC y Steam solo vinculó quedan, sin las horas ni los logros
    de Steam (su tiempo propio no baja de cero). En los dos casos se olvida la lista de juegos
    quitados. El origen se guarda en `user_games.steam_imported` (migración `SteamImportedGames`;
    los juegos vinculados antes de ella cuentan como traídos por Steam).

80. **Elegir los juegos de Steam:** la sincronización ya no agrega los juegos sola: los juegos
    nuevos con 1 hora o más (no vinculados ni quitados) quedan en `steam_pending_apps` y Mis juegos
    los ofrece en un modal, con portada, horas y avisos ("Manual: no está en el catálogo", "Ya está
    en tu biblioteca"), **todos tildados**. Los elegidos se agregan en segundo plano, con su progreso;
    los destildados pasan a juegos quitados (se restauran desde el panel de Steam, y restaurar uno lo
    agrega directamente). Pasa al vincular y en cada sincronización que encuentre juegos nuevos. Si
    el usuario cierra el modal, no se agrega nada: el panel ofrece "Revisar" y el modal vuelve a
    abrirse en la próxima visita. Mientras corre una sincronización no se puede confirmar (`409
STEAM_SYNC_RUNNING`). Al desvincular se olvidan los juegos pendientes. Migración
    `AddSteamPendingApps`.

81. **Platino automático de Steam:** cuando todos los logros de Steam de un juego vinculado
    pasan a estar desbloqueados **en Steam** (lo tildado a mano y los logros propios no cuentan),
    la sincronización le pone el platino si no lo tiene: fecha del último logro desbloqueado (nunca
    antes del inicio del juego ni en el futuro), tiempo = tiempo total del juego en ese momento (Steam
    no informa las horas de ese día), sin dificultad; como todo platino, tilda los logros pendientes.
    Solo cuenta el paso a "todo desbloqueado" (`user_games.steam_all_achieved` guarda el estado de
    la última revisión): si el usuario quita el platino no se vuelve a poner, salvo que el juego sume
    logros nuevos (por ejemplo, un DLC) y se completen. La primera sincronización después de la
    migración `SteamAllAchieved` les pone el platino a los juegos que ya estaban completos.

82. **Términos, privacidad y eliminar la cuenta:** los Términos de uso y la Política de privacidad
    dejan de ser un borrador (versión `2026-10-11`). Cubren: servicio gratuito "tal cual", sin
    garantías ni responsabilidad por datos de terceros; sin afiliación con Valve, IGDB, Twitch,
    IsThereAnyDeal, tiendas ni medios; precios orientativos; noticias con titular, extracto y
    enlace; Steam opcional y sin recibir su contraseña; qué datos se guardan y con qué servicios se
    comparten (Resend, Steam, el hosting); una sola cookie de sesión; derechos del usuario y la
    autoridad argentina de la Ley 25.326. **Edad mínima: 13 años**, declarada al aceptar los
    documentos en el registro. El email de contacto se configura con `VITE_CONTACT_EMAIL`
    (obligatorio antes de publicar). El perfil permite **eliminar la cuenta** confirmando la
    contraseña: se borra al instante y para siempre todo lo del usuario (en cascada) y las imágenes
    subidas que nadie más usa.

83. **Modo claro:** la app tiene tema claro y oscuro. Selector en el encabezado (al lado del
    idioma) con "Según el sistema" (por defecto), "Claro" y "Oscuro"; la elección se guarda en el
    navegador (`gt.theme`). Los bordes y superficies sutiles usan `ink(theme)` (blanco en oscuro,
    negro en claro); lo que va encima de portadas e imágenes con velo oscuro (cards de Mis juegos,
    noticia destacada, próximos lanzamientos, el destacado de la Home) sigue oscuro en los dos modos
    (`DarkSurface`). En celulares sin sesión, "Iniciar sesión" pasa a ser un ícono para que el
    encabezado entre en pantalla.

84. **Amigos, bloqueos y visibilidad:** amistad mutua con solicitud (`friendships`, una fila por
    par de usuarios, en cualquier dirección); si los dos se mandan solicitud, quedan amigos. Los
    otros usuarios se nombran siempre por username. Búsqueda por parte del username (3+ letras,
    20 resultados, solo usuarios verificados; devuelve username, foto y relación, nunca el email).
    Cada usuario elige quién ve su perfil y actividad: "Mis amigos" (por defecto) o "Solo yo"
    (`users.profile_visibility`). Bloquear (`user_blocks`) borra la amistad y las solicitudes,
    oculta a cada uno en la búsqueda del otro, impide solicitudes y ver la foto o el perfil; para el
    bloqueado, el otro "no existe" (`404 USER_NOT_FOUND`); no se avisa. Avisos de solicitudes solo
    en la app: contador en el menú Comunidad del encabezado. Migración `AddFriendsAndBlocks`.
85. **Perfil de un amigo (solo lectura):** `/u/:username` muestra ficha, estadísticas, destacados,
    actividad, biblioteca y lista de deseos; `/u/:username/games/:id` un juego con partidas, notas
    (también las de cada partida) y logros. Lo ven el dueño y sus amigos si su perfil es "Mis
    amigos"; un amigo con "Solo yo" responde `403 PROFILE_PRIVATE`; cualquier otro, 404. Las rutas
    propias (`/api/library`...) siguen siendo solo del dueño. El encabezado agrupa Actividad y
    Amigos en el menú **Comunidad** y pasa al menú lateral por debajo de 1400 px de ancho.
86. **Actividad:** `activities` registra juegos agregados (con su estado), cambios de estado de
    partidas (en progreso, completada, jugada), platinos (manuales y automáticos), logros
    desbloqueados (a mano o por Steam), valoraciones, favoritos y lista de deseos. Lo mismo en el
    mismo juego dentro de una hora se agrupa (logros suman, valoración y estado se reemplazan); una
    importación de Steam es un solo evento ("Agregó N juegos desde Steam") y sus logros ya
    desbloqueados no cuentan. Solo lectura, sin "me gusta" ni comentarios. Arranca vacía (sin
    reconstruir el pasado). El feed muestra lo propio y lo de los amigos visibles, 30 por página.
    Registrar un evento nunca hace fallar la acción. Migración `AddActivities`.
87. **Denuncias:** desde el perfil de un jugador o la lista de amigos se puede denunciar foto o
    username ofensivo (u otro motivo, con detalle opcional). Se guarda en `user_reports` y se
    envía por email a `ADMIN_EMAIL` (username denunciado, motivo, detalle y quién denuncia; nunca
    emails). Sin `ADMIN_EMAIL` solo queda en la base. El administrador actúa a mano. Migración
    `AddUserReports`.
88. **Reaceptar los documentos legales:** los Términos y la Política suman amigos, actividad,
    búsqueda, bloqueos y denuncias. Si un usuario aceptó otra versión, `/auth/me` lo informa y la
    API responde `403 LEGAL_ACCEPTANCE_REQUIRED` (salvo leer la sesión, aceptar y eliminar la
    cuenta); la app muestra un aviso que solo se cierra aceptando (`POST /api/auth/accept-legal`)
    o cerrando sesión.

89. **Producción en Railway:** un único servicio. El `Dockerfile` (raíz) construye frontend y
    backend con Node 24; la API sirve el frontend compilado (`FRONTEND_DIST_DIR`: los `/assets` con
    caché de un año, el resto de las rutas que no son `/api` devuelven `index.html`), así frontend
    y API comparten origen. Al arrancar aplica las migraciones compiladas (`DB_MIGRATIONS_RUN=true`).
    Detrás del proxy de Railway, `TRUST_PROXY_HOPS=1` (IP real para los límites de intentos); la
    cookie es `Secure` en producción. La CSP de helmet permite imágenes HTTPS externas (IGDB,
    Steam, noticias). Postgres es el plugin de Railway; portadas y avatares van a un volumen en
    `/data`. `railway.json`: chequeo de salud en `/api/health` y una sola réplica (estado de Steam
    y cachés en memoria). Variables en el README ("Producción (Railway)").
