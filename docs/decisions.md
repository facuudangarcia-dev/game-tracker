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
9. **Cambio de modo de tiempo:** permitido.
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
19. **Registro:** deja al usuario logueado automáticamente.
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
