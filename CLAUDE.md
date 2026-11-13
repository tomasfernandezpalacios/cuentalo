# Cuéntalo — guía para Claude

La especificación completa está en `docs/cuentalo-prompt-claude-code.md`. Este archivo resume
convenciones y decisiones; anota aquí cualquier decisión menor nueva.

## Forma de trabajar

- Trabajo por fases (0–6). Al terminar cada una: `npm run lint`, `npm run typecheck`, tests,
  commit en español con mensaje claro, `git push`, y **parar** para que el usuario pruebe.
- El usuario estudia Ingeniería Informática y Matemáticas: explicar decisiones importantes
  brevemente. Preguntar antes de decisiones de diseño que cambien el resultado.
- Código simple y legible, funciones pequeñas, pocas dependencias.
- No cambiar el stack sin consultar. No ejecutar nada que cueste dinero ni crear cuentas.

## Stack

- Expo SDK 58, React Native, TypeScript estricto (`strict` + `noUncheckedIndexedAccess`).
- Expo Router; las rutas viven en `app/` en la raíz (no en `src/app/`, por decisión del prompt).
- Supabase (`@supabase/supabase-js`), sesión en `expo-secure-store`. TanStack Query.
- Instalar paquetes siempre con `npx expo install <paquete>` (versiones compatibles con el SDK).
- Expo cambia mucho entre SDK: consultar `https://docs.expo.dev/versions/v58.0.0/` antes de usar
  una API de Expo en vez de fiarse de la memoria.
- Todo debe funcionar en **Expo Go** (sin módulos nativos fuera de los que incluye).

## Convenciones

- Interfaz en español. Nombres de código (variables, funciones, tipos) en inglés; carpetas de
  `src/features` y rutas en español como pide la especificación.
- Alias de importación `@/` → `src/`.
- Colores siempre desde `useThemeColors()` (`src/lib/theme.ts`), con modo claro y oscuro; el
  modo (`useColorMode()`) y el color de acento salen de Configuración.
- Se probaron paletas cálidas (crema, marrón y verde; commits `71f637e`, `05ed122`, `5b3b42b`,
  `4253ffc`) y el usuario decidió volver a la morada original (etiqueta `diseno-morado`).
- Tipografías (petición del usuario): **Ubuntu Bold** (`fonts.title`) para títulos, nombres,
  cifras, botones, cabeceras y pestañas; **Redaction** (`fonts.detail`) para detalles y textos
  secundarios (fechas, notas, unidades, etiquetas, descripciones, errores). Los campos de texto
  usan `fonts.detail` (también el texto de ejemplo; antes la del sistema). No usar `fontWeight` con estas fuentes. Archivos en
  `assets/fonts/`, cargados con `useFonts` en `app/_layout.tsx`.
- Avisos: nunca `Alert.alert`; usar `appAlert(título, mensaje, botones, { warning })` de
  `src/components/AppDialog.tsx` (estilo de la app; `DialogHost` montado en `app/_layout.tsx`).
  Si hay un botón `destructive` o `{ warning: true }`, sale el icono de advertencia en un círculo
  rojo (acciones irreversibles).
- Formato con Prettier (comillas simples, comas finales, 100 columnas). ESLint con
  `eslint-config-expo` + `eslint-config-prettier`.

## Seguridad

- Nunca subir `.env` ni claves. La anon key solo en `.env` local (`EXPO_PUBLIC_*`).
- Nunca usar la `service_role` key en la app.
- RLS activado en todas las tablas; funciones auxiliares `SECURITY DEFINER` para evitar recursión.

## Modelo de datos (resumen)

`profiles`, `friendships`, `groups`, `group_members`, `counters` (group_id nulo = privado),
`entries` (cada miembro inserta sus propias filas). Las estadísticas personales suman mis
`entries` de todos los contadores, privados y compartidos: no hay datos duplicados.
Clasificación vía RPC `get_leaderboard(counter_id, period)` con semana ISO y mes/año naturales en
la zona horaria del móvil (ver «Hora del móvil» abajo).

## Decisiones tomadas

- Fase 0: plantilla `blank-typescript` + Expo Router añadido a mano (menos código de ejemplo que
  borrar que con la plantilla por defecto).
- Fase 0: `react-dom` instalado en la misma versión que `react` para resolver un conflicto de
  dependencias de `expo-router` (se usa solo para web).
- Repositorio: rama `main`, remoto `origin` en GitHub; `.gitattributes` fuerza finales de línea LF.
- Supabase usa las nuevas "publishable keys" (`sb_publishable_…`), equivalentes a la anon key;
  la variable se sigue llamando `EXPO_PUBLIC_SUPABASE_ANON_KEY` como pide la especificación.
- La confirmación de email está desactivada en Supabase durante el desarrollo. **Reactivarla en
  la Fase 6** (Authentication → Sign In / Providers → Confirm email).
- **Base de datos** (reordenada el 2026-11-05): `supabase/schema.sql` es el esquema completo
  (estado final de las 33 migraciones antiguas, generado desde la base de datos real y
  comprobado). Las antiguas están en `supabase/historial_migraciones/` solo como referencia.
  Los cambios nuevos van en `supabase/migrations/` (ver su README) y se aplican con el conector
  de Supabase (`apply_migration`, proyecto `uucmxpwevggzvdgnoxbh`) o en el SQL Editor; después
  se actualiza `schema.sql`. Nunca editar una migración ya aplicada. Ojo: varias migraciones
  se vaciaron al abrirlas para copiar; mejor copiarlas desde GitHub o aplicarlas con el
  conector.
- Fase 1: sesión en `expo-secure-store` troceada en bloques de 1800 bytes
  (`src/lib/secureStorage.ts`) porque SecureStore en Android limita los valores a ~2 KB. Evita
  depender de AsyncStorage + cifrado AES como en la guía oficial.
- Fase 1: `src/lib/database.types.ts` está escrito a mano (generarlo exige la CLI enlazada).
- Fase 1: los totales salen de la vista `counter_totals` (`security_invoker`), así la RLS de
  `entries` decide qué se suma; en la Fase 4 sumará también los registros visibles del grupo.
- Fase 1: `can_log_to_counter()` (SECURITY DEFINER) centraliza "¿puedo registrar aquí?"; en la
  Fase 4 se amplía a miembros activos del grupo sin tocar las políticas de `entries`.
- Fase 1: el username se comprueba antes del registro con la RPC `is_username_available`
  (accesible sin sesión) para dar un mensaje claro en vez de un error genérico del trigger.
- Fase 1: `typedRoutes` de Expo Router desactivado: en Windows genera las rutas dinámicas
  (`[id]`) como texto literal y rompe el typecheck.
- Fase 1: autenticación en `src/features/auth` (carpeta extra a las cuatro de la especificación).
- Tests con `jest-expo` (`npm test`), en carpetas `__tests__` junto al código.
- **Bots de prueba** (`scripts/bots/`, petición del usuario): `npm run bots` (opcional
  `-- --rondas 80 --semilla 7`). Cinco usuarios reales `prueba1`…`prueba5`
  (`pruebaN@cuentalo.test`, contraseñas en `scripts/bots/.bots.json`, ignorado por Git) con
  personalidades distintas (`personas.mjs`) hacen las mismas llamadas que la app
  (`acciones.mjs`) y luego comprueban totales, clasificaciones, rachas, privacidad, códigos y
  comunes (`comprobaciones.mjs`). Informe por ejecución en `scripts/bots/informes/` y lista
  acumulada en `hallazgos.md`. `npm run bots:limpiar` borra las cuentas (delete_my_account).
  Las cuentas las crea el usuario al ejecutarlo (Claude no crea cuentas en servicios reales).
- Petición del usuario (tras la Fase 2): la tarjeta de la lista es «nombre · +1 +5 −1 · total»
  (el +10 se quitó a petición del usuario), sin número de registros; mantener pulsado +1 abre otra cantidad. El detalle tiene los
  mismos botones más «Otra». Las actualizaciones optimistas tocan lista y detalle a la vez.
- **−1 = registro de −1** (decisión del usuario, que quiere verlo en el historial): la RPC
  `remove_one_from_counter` inserta −1 solo si _mi_ total en el contador es ≥ 1, así nunca baja
  de 0. Los −1 no cuentan en `entry_count`. **Fase 4:** en contadores compartidos `canRemove`
  debe usar _mi_ total, no el del grupo.
- Emoticono opcional por contador (`counters.emoji`), elegido de sugerencias o con el teclado.
  `CounterAvatar` lo muestra sobre fondo suave (`primarySoft`) o, si no hay, la inicial. La
  tarjeta es «emoticono · nombre · +1 +5 −1 · total». El usuario **no quiere** resumen de
  registros de hoy/semana en la pantalla de inicio (se quitó).
- La unidad del contador es **opcional** (`counters.unit` puede ser null); usar
  `formatWithUnit()` para mostrar cantidades.
- Fase 2: gráficas con `react-native-gifted-charts` (sencilla, funciona en Expo Go solo con
  `react-native-svg`; necesita también `expo-linear-gradient`). Victory Native XL exige Skia y
  Reanimated, demasiado para unas barras.
- Fase 2: los periodos de las estadísticas son **naturales** (esta semana ISO, este mes, este
  año), igual que la clasificación, no "últimos 7/30 días".
- Fase 2: la vista `entry_daily_totals` agrupa por día en Europe/Madrid y la app agrega días en
  semanas/meses/años con funciones puras (`src/features/estadisticas/periods.ts`, con tests).
  La consulta se pagina porque PostgREST devuelve como máximo 1000 filas.
- Fase 4 (resuelto): al salir de un grupo se sigue viendo el contador por la política
  `has_entries_in_counter`, así las estadísticas mantienen nombre y unidad.
- Fase 3: amistad única por pareja (índice único sobre least/greatest de los dos ids). Solo el
  destinatario cambia `status` (grant de columna). Cualquiera de los dos puede borrar la fila
  (cancelar solicitud o dejar de ser amigos). Una solicitud rechazada desaparece para quien la
  rechaza y sigue como "Enviada" para quien la envió, para no comunicar el rechazo.
- Fase 3: al crear un grupo, un trigger mete al creador como owner activo. El owner invita (solo
  a amigos aceptados, `are_friends`), retira invitaciones y expulsa; los miembros salen o
  rechazan borrando su fila. Ver más abajo cómo se cambia de administrador.
- Fase 3: funciones `is_group_member` (activo), `is_group_participant` (activo o invitado) e
  `is_group_owner`, todas SECURITY DEFINER para evitar recursión en la RLS de group_members.
- Unirse a grupos con **código de 8 caracteres** (`ABCD-EFGH`, alfabeto sin 0/O/1/I/L) o
  **enlace** `cuentalo://unirse/CODIGO` (en Expo Go `exp://…/--/unirse/CODIGO`). **Cualquier
  miembro activo** ve el código (`get_group_invite_code`; la columna no es legible
  directamente), y lo comparte (migración `20261129`, petición del usuario; antes solo el
  owner). El código es **fijo**: se genera único al crear el grupo y no se cambia (migración
  `20261130` quita `regenerate_group_invite_code`). Bajo el código, botón «Compartir». Con el código se entra aunque no seas amigo de nadie del grupo.
  Si se abre el enlace sin sesión, tras iniciar sesión hay que volver a abrirlo (V1).
- «Amigos y grupos» se abre en la pestaña Grupos (petición del usuario). Orden: invitaciones
  (si hay), «Tus grupos», y debajo «Crear grupo» y el código. Cada grupo de «Tus grupos» es el
  mismo bloque grande de la cabecera del grupo (`GroupHeaderCard` con `onPress`), con el código.
- En la pantalla del grupo, el + morado de la cabecera (como en inicio) crea un contador
  compartido; el botón «Nuevo contador compartido» de la lista solo sale si no hay ninguno.
- **Rendimiento** (migración `20261201`, más `20261202` y `20261203`: permisos de funciones de
  trigger y de la vista de rachas e índices de claves foráneas, según los asesores de Supabase): la lista de contadores llega en **una** petición
  (`get_my_home`: contadores, totales, grupos, participantes, alias, enlaces, ocultos, quitados
  y rachas) en vez de nueve. `my_visible_counter_ids()` y `my_counter_totals()` aplican las
  mismas reglas que la RLS con joins e índices (antes la RLS recorría todos los registros y
  contadores de la base de datos con una función por fila); `privacidad.sql` comprueba que
  coinciden. Sin la migración, la app hace las nueve consultas de antes (`PGRST202`). El
  detalle de un contador sale de la carga de la lista (`useCounter` → `fetchQuery`).
  `my_time_zone()` pasa a SQL sencilla (sin SECURITY DEFINER) para calcularse una vez por
  consulta. `refreshAll` refresca todo menos enlaces de fotos, avatares y códigos de grupo.
- **Cambios al instante** (petición del usuario): toda mutación (contadores, social, carpetas,
  perfil) refresca **todas** las consultas (`refreshAll`; solo se vuelven a
  pedir las que están en pantalla). Excepción: tras +N/−1 el refresco se agrupa
  (`entryMutationKey` en `hooks.ts`): solo lo programa el último toque en vuelo, 700 ms después,
  para que varios toques rápidos no pidan todo cada vez ni un refresco pise el número optimista.
  `ChartPlot` lleva `key` con series, valores y etiquetas:
  gifted-charts no redibujaba al cambiar de contador (solo al cambiar de tipo).
- Fase 3: los datos se refrescan al volver a la app (`focusManager` + `AppState`) y con
  "tirar para refrescar".
- Fase 4: contador compartido = `counters.group_id`. Lo ven los miembros activos; cualquiera
  lo crea en su grupo; lo editan/archivan el creador o el owner del grupo; **no se borran**
  (solo se archivan). `group_id` y `owner_id` no se pueden cambiar (grants de columna). Si se
  elimina el grupo, `group_id` pasa a null y queda privado de su creador.
- Fase 4: cada miembro ve los registros de los miembros **activos** (`can_view_group_entry`);
  quien sale conserva y ve solo los suyos y deja de contar en totales y clasificación.
- Fase 4: `counter_totals` añade `my_total` y `my_entry_count`. La tarjeta y el número grande
  del detalle muestran **lo mío**; el detalle muestra además el total del grupo. El historial
  del detalle muestra solo mis registros (los de los demás están en la clasificación).
- Fase 4: `get_leaderboard(counter_id, period)` es SECURITY INVOKER (respeta la RLS), usa
  `date_trunc` sobre la hora de Europe/Madrid (semana ISO = lunes) y `rank()` para empates.
  Devuelve también `display_name` y `entry_count`.
- Fase 4: las pruebas de privacidad están en `supabase/tests/privacidad.sql`: se pegan en el
  SQL Editor, crean usuarios de prueba, comprueban la RLS y hacen ROLLBACK.
- Pantalla del grupo: «Clasificación» con selector de contador; por defecto, el último contador
  del grupo en el que _el usuario que mira_ registró algo (petición del usuario).
- **Contador común** (petición del usuario): `counters.is_common` + `counter_participants`. Cada
  +N/−1 inserta una fila por participante activo (`add_to_common_counter`,
  `remove_one_from_common_counter`, SECURITY DEFINER). **Cualquier miembro activo** puede
  pulsar +1; el −1 resta a todos (sin bajar de 0). Los participantes se eligen al crear y se
  cambian al editar (creador u owner del grupo, `set_counter_participants`). `is_common` no se
  cambia tras crear. Editar/borrar una línea del historial solo toca la copia propia. La app
  elige la RPC según `is_common` del contador en caché. En la tarjeta, un no participante ve lo
  que lleva cada participante (`displayTotal`).
- La clasificación se refresca al registrar (misma caché), al volver a la app y al tirar para
  refrescar. Sin tiempo real (Supabase Realtime) en la V1.
- Fase 5: eliminar cuenta con la RPC `delete_my_account` (SECURITY DEFINER, sin service_role).
  Antes de borrar: los grupos que administra pasan al miembro activo más antiguo (o se borran
  si no queda nadie) y sus contadores compartidos pasan al owner del grupo, para no borrar los
  registros de los demás. Doble confirmación en la app; después `signOut({ scope: 'local' })`.
- Fase 5: perfil con nombre, @usuario, email (solo lo ve uno mismo), grupos, editar perfil,
  cerrar sesión y eliminar cuenta.
- Icono «+1» en Instrument Serif dorado (`#E9C46A`) sobre negro cálido (`#0B0A09`), estilo
  Cine; adaptativo de Android con fondo `#0B0A09` y la pantalla de carga en dorado medio sobre
  `#F3EEE4` (claro) o `#0B0A09` (oscuro). Se genera con `python scripts/generar-icono.py`
  (Pillow): rehacerlo si cambian colores o letra. (Antes: «+1» Ubuntu Bold sobre `#5B4BDB`.) Splash con `expo-splash-screen`: se mantiene hasta tener las
  fuentes y la sesión; fondo claro/oscuro según el sistema.
- Fase 5: un enlace de invitación abierto sin sesión se recuerda (`usePendingInvite`) y se abre
  tras iniciar sesión.
- Accesibilidad: roles y etiquetas en botones y cabeceras, áreas táctiles ≥ 44 pt (con
  `hitSlop`), texto escalable con tope en la fila compacta de la tarjeta, colores con contraste
  AA en ambos modos y el indicador de refresco con el color de la app.
- **Carpetas** (petición del usuario): `folders` + `folder_counters`, personales (solo las ve su
  dueño), un contador puede estar en varias. Se guardan de una vez con la RPC `save_folder`.
  Barra fina bajo la cabecera: «Todos» · carpetas · «+ Nueva carpeta» (se desliza). Mantener
  pulsada una carpeta → editar/eliminar. Crear/editar es una pantalla completa con nombre,
  buscador (ignora tildes) y contadores en orden alfabético con casillas; botón «Hecho».
- La lista siempre empieza en «Todos» y sin filtros. Botón de filtros (icono a la izquierda del
  +) abre un rectángulo con: carpeta, tipo (individuales/de grupo) y actividad reciente en
  ventanas móviles (24 h, 7, 30, 365 días, según `lastLoggedAt`). Lógica en
  `src/features/contadores/filters.ts` con tests.
- Todas las pantallas que se abren encima (crear, editar, filtros…) tienen la misma flecha de
  volver (`BackButton`, puesta en `headerLeft` de los Stack); nada de «Cancelar» (petición del
  usuario).
- Cabecera de «Mis contadores» y del grupo: el + es un círculo del color principal con el +
  del color del fondo (`colors.background`) (decisión del usuario).
- **Estadísticas** (rediseño pedido por el usuario): periodo arriba; debajo, barra con icono de
  filtros (pantalla completa `app/estadisticas/filtros.tsx`: buscador, carpetas enteras,
  casillas, Todos/Ninguno) y un botón por contador (de uso más reciente a menos,
  `sortByRecentUse`) que lo muestra u oculta en la gráfica. Sin
  filtro, la barra tiene todos los contadores y se dibuja el último usado
  (`useMyLastCounterId`); al aplicar un filtro se dibujan todos los elegidos. La selección vive
  en memoria (`selection.ts`, `useSyncExternalStore`) y se reinicia al abrir la app.
- Gráficas interactivas (petición del usuario): al tocar `StatsChart` (Estadísticas y grupo)
  se abre `ChartViewer` a pantalla completa (Modal): zoom **con botones** + / − / «ver entera»
  (el usuario probó el pellizco y prefiere botones), deslizar con el dedo por el eje
  X y **tocar un punto o barra** para ver su dato en un recuadro, que la app coloca siempre
  dentro de la gráfica (`bubbleAt`; también en barras, con `onPress` de la barra). Líneas: el toque se calcula a
  mano (`onTouchStart/End` + `measure` + desplazamiento de `onScroll`), porque las franjas de
  `focusEnabled` de gifted-charts no reciben toques en el móvil; barras: `renderTooltip`. El
  recuadro usa `bucketTitle` («mié 4 nov 2026»). Bajo la gráfica, «Toca la gráfica para
  ampliarla». El dibujo está en `ChartPlot`.
- Tarjeta de racha (`StreakCard`, igual en Estadísticas, perfil y pantalla de racha):
  «🔥 N días de racha» en una línea, debajo «Mejor racha: N días» alineada con el número y la
  semana actual (lunes → domingo, `weekProgress`) con una barra por día: color de la llama si
  se mantuvo, gris si no, más clara si no ha llegado y borde en hoy.
- **Resumen vital** (petición del usuario): botón en la cabecera de Estadísticas
  (`SummaryButton`, «Resumen vital» + libro hasta el primer uso; después solo el libro) →
  `app/resumen.tsx` (pantalla completa). Pide la fecha de nacimiento con el calendario de la
  app (`BirthDatePicker`: año → mes → día) y la guarda en la cuenta, en la tabla privada
  `profile_private` (migración `20261209`; los perfiles los lee cualquiera, por eso no va en
  profiles; `useBirthDate` sube una vez la antigua guardada en el móvil). Enseña la edad en
  tiempo real (años, meses, semanas, días, horas, minutos y segundos; cálculo
  de calendario en `age.ts`, con tests, inmune al cambio de hora), días/horas/minutos vividos y
  todos mis contadores de mayor a menor (`myTotal`), sin título, separados por un hueco.
- **Reordenar arrastrando** (petición del usuario; `useDragReorder` en `src/lib`, sin librerías
  de gestos, con `dropIndex`/`moveItem`/`applyOrder` en `reorder.ts` con tests): mantener
  pulsado levanta el elemento y al mover el dedo la capa de la lista se queda con el gesto; los
  demás se apartan animados. En **Estadísticas** los bloques ('chart', 'streak' y 'age', el
  bloque «Tienes» que se añade con el + del Resumen vital) y en **Mis contadores** las tarjetas
  visibles (mantener pulsado sigue entrando en el modo selección; si se arrastra, la selección
  vuelve a como estaba). Los órdenes van en `profile_private` (`stats_blocks`,
  `counter_order`, migración `20261210`). El botón «Resumen vital» va relleno del color de la app.
- Gráfica (`StatsChart`): líneas por defecto, una por contador con color de `chartColors.ts`
  (por posición en la barra); botón cuadrado abajo a la derecha para cambiar a barras
  agrupadas. Eje X por periodo (`chartBuckets`): semana = días lunes→hoy, mes = días 1→hoy,
  año = meses enero→actual, histórico = meses desde el primer registro (años si son > 24).
  Justo debajo, `ChartTotals`: el total por escrito de cada contador dibujado (mismo filtro y
  periodo). Debajo no hay nada más (el usuario pidió quitar los resúmenes de registros, más
  usados y por contador).
- **Fusionar contadores** (petición del usuario; botón junto a los filtros, pantalla completa
  `app/contadores/fusionar.tsx`, RPC `merge_counters`, SECURITY INVOKER). Solo individuales:
  todo pasa al primero elegido y los demás se borran. Individual(es) + uno de grupo: queda el de
  grupo y mis registros antiguos se mueven como `entries.personal_only = true`: cuentan en mi
  total (`my_total`) y mis estadísticas, pero no en `total`, la clasificación ni los ve nadie
  más. Máximo un contador de grupo; nunca comunes; irreversible. El −1 usa `my_group_total`.
- **Fusionar varios contadores de grupo** (petición del usuario): cada grupo conserva su propio
  contador; se **enlazan** solo para quien fusiona (`counter_links`, con un principal). Al
  registrar (`log_to_counter`, ahora la vía normal de +N en no comunes) se inserta una copia en
  cada enlazado con el mismo `batch_id`; solo la primera cuenta para mí, las demás son
  `group_only`. `my_total` y `entry_daily_totals` excluyen `group_only`; el total del grupo y la
  clasificación excluyen `personal_only`. Editar/borrar un registro actúa sobre todo su
  `batch_id`. No se pueden enlazar dos contadores del mismo grupo. En la app, `applyLinks`
  junta los enlazados en el principal (`linkedGroups`, `linkedCounterIds`) y marca los demás con
  `linkedInto` (no salen en listas; las estadísticas los suman al principal).
- Alias personales (`counter_aliases`): nombre/icono que solo ve uno (se crean al fusionar con
  un contador de grupo). `enrich` los aplica a `name`/`emoji`; editar usa
  `sharedName`/`sharedEmoji` para no guardar el alias como nombre del grupo.
- Imagen de grupo (petición del usuario): `groups.emoji` o `groups.photo_path`. Las fotos van a un
  bucket **privado** de Storage (`group-photos`, ruta `<group_id>/<timestamp>.<ext>`, máx. 2 MB):
  las leen miembros e invitados con enlaces firmados de 1 h (`useGroupPhotoUrl`) y solo el owner
  sube/cambia/borra. `expo-image-picker` recorta cuadrado y da base64 (`base64ToBytes`). El
  owner edita nombre e imagen en `app/grupos/[id]/editar.tsx`.
- **Rachas** (petición del usuario): días seguidos con algún registro. `user_activity_days`
  (RLS: cada uno los suyos) se rellena con un trigger al insertar en `entries`, con el día
  (Madrid) en que se pulsa y para `auth.uid()` (quien pulsa; en un común no cuenta para los
  demás participantes). Borrar un registro no quita el día. La racha de ayer sigue viva hasta
  que acabe hoy (`currentStreak` en `streaks.ts`, con tests). Fuego (`StreakBadge`, color
  `colors.flame`) junto al título «Mis contadores»; pantalla `app/racha.tsx` con `StreakCard` y
  calendario mensual; la misma tarjeta va al final de Estadísticas y lleva a esa pantalla.
- Rachas de amigos: en la pantalla de racha, clasificación de mí y mis amigos aceptados por
  racha actual (empates comparten puesto, `withPositions`). La RPC `get_friends_streaks`
  (SECURITY DEFINER, «huecos e islas») solo devuelve números; los días siguen siendo privados.
- **Administrador de contador** (petición del usuario): en un contador de grupo es quien lo creó
  (`owner_id`, `is_counter_admin`). Solo él edita y borra; en un común es el único que suma o
  resta y los demás le envían `counter_requests` (acepta o rechaza con
  `decide_counter_request`; al aceptar se suma sola). Si sale del grupo, sus contadores pasan
  al owner del grupo (trigger). El owner del grupo ya no edita contadores de otros.
- Borrar un contador de grupo (`delete_group_counter`) o el grupo entero (trigger) **solo lo
  saca del grupo** (`dissolve_group_counter`): cada miembro conserva sus registros, en el
  contador con el que lo tuviera fusionado (como `personal_only`) o en uno privado nuevo con el
  mismo nombre. Todos reciben un aviso.
- **Buzón** (`app/avisos.tsx`, icono de sobre en «Amigos y grupos»), en tres pestañas con una
  barra fina arriba: pendientes (solicitudes de
  contador, de amistad e invitaciones), avisos (`notifications`: amistad aceptada, solicitud
  aceptada/rechazada, contador o grupo borrado) e historial de solicitudes de amistad. Punto
  rojo en el icono y en la pestaña mientras haya algo pendiente o sin leer (`useInboxCount`);
  los avisos se marcan como leídos al abrir el buzón. Un rechazo de amistad no se avisa. Al
  aceptar una amistad avisan a los dos (migración `20261205`): `friend_accepted` a quien la
  envió y `friend_you_accepted` a quien la acepta.
- **Avisos de actividad en grupo** (petición del usuario; migración `20261207`): al sumar o
  restar en un contador de grupo (no común; sin `personal_only`), todos los miembros activos
  (también quien lo hace, migración `20261208`: «Has sumado +6…») reciben UN aviso con el neto
  («Ana ha sumado +6 en «Cafés» (Gimnasio)»). Trigger
  `on_entry_group_activity` → `group_activity_bump`: acumula en un aviso pendiente por
  miembro y lo retrasa (`notifications.visible_from` = ahora + 20 s); la RLS no enseña ni deja
  marcar como leídos los pendientes ni los que quedan en 0. Solo si quien registra es miembro
  activo (sin avisos al borrar cuentas o dejar grupos).
- **Modo selección** en «Mis contadores»: mantener pulsado un contador. La barra de carpetas
  pasa a seleccionar en masa (petición del usuario): «Todos» y cada carpeta añaden sus
  contadores a la selección o los quitan si ya estaban todos (`toggleMany`); sin «Nueva
  carpeta». Cabecera «N
  seleccionados» con borrar, añadir a carpeta (`FolderPicker` o carpeta nueva con los
  seleccionados), ocultar/mostrar, editar (solo con uno) y fusionar. Atrás de Android sale del
  modo. **Ocultos** personales (`hidden_counters`) al final de la lista, en un desplegable «Ocultos (N)»
  cerrado al abrir la app.
- **Perfil de otros** (`app/usuario/[id].tsx`, se abre tocando a cualquier persona en
  `PersonRow` y en las clasificaciones de contadores y de rachas, con `openProfile`): si no sois amigos, botón de solicitud; si lo sois, su racha y sus contadores
  visibles. Siempre, los contadores en común (los de grupos de los dos) con su total y el mío,
  **arriba**, y debajo la gráfica «Tú y X» (`CommonCountersChart`, petición del usuario):
  periodo, barra de contadores en común (por defecto el primero) y dos series por contador
  (tú y la otra persona) con `get_group_counter_daily`; después «Sus contadores».
  Datos por la RPC `get_user_counters` (SECURITY DEFINER, solo totales). Los individuales son
  visibles para amigos salvo `counters.hidden_from_friends`. En «¿Quién lo ve?» son dos
  opciones (petición del usuario): «Privado» (hidden_from_friends = true) y «Privado y
  amigos» (false, la marcada por defecto), entre ellas y los grupos; editables al editar.
  **Ocultar mis números a mis amigos** (Configuración → Privacidad, `profiles.hide_counter_totals`,
  migración `20261206`): `get_user_counters` devuelve `their_total = null` en sus contadores
  (`kind = 'public'`), nunca en los en común; el perfil enseña un candado en su lugar. Los de grupo los ven los miembros del grupo; al fusionar
  con uno de grupo se avisa de que pasa a ser visible para sus miembros.

- **Configuración** (petición del usuario; rueda arriba a la derecha en «Mi perfil»,
  `app/configuracion/`). Ajustes **del móvil** en `src/features/configuracion/settings.ts`
  (SecureStore, leídos de forma síncrona al arrancar, `useSettings`/`updateSettings`): tema
  automático/claro/oscuro, color de acento (`accents` en `theme.ts`: morado de serie, azul,
  verde, naranja, rosa; AA con el texto de los botones; y «Personalizado»: `ColorPickerDialog`
  con cuadro saturación/brillo, barra de tonos y #RRGGBB; `customAccent` en `src/lib/color.ts`
  lo oscurece o aclara en cada modo hasta tener contraste AA), botones rápidos (1–3 cantidades; las
  mismas en la tarjeta y el detalle, el primero se mantiene pulsado para «otra»), confirmar
  −1, vibración (`expo-haptics`), contador inicial de Estadísticas y recordatorio de la racha.
  Ajustes **de privacidad** en `profiles` (migración `20261118`): `hide_streak` (fuera de
  `get_friends_streaks`), `hide_counters_from_friends` (**quitado** de Configuración en la migración `20261127`:
  se pisaba con «Privado» / «Privado y amigos»; vale siempre false) y `group_invites` ('friends'/'nobody', comprobado en la política de invitar).
- Recordatorio con notificaciones **locales** (`expo-notifications`, funcionan en Expo Go; las
  push necesitarían build propia): se programan las de los próximos 14 días una a una para
  poder saltarse la de hoy si ya registraste (`reminder.ts`, `reminderDates.ts` con tests).
- «Cerrar sesión», «Eliminar cuenta» y «Exportar mis datos» (CSV con `Share`) están en
  Configuración → Cuenta; el perfil se queda con «Editar perfil» y los grupos. «Privacidad y
  datos» es un resumen; la política completa va en la Fase 6.

- **Imagen de perfil** (petición del usuario): `profiles.emoji` o `profiles.photo_path`
  (migración `20261119`). Fotos en el bucket **privado** `profile-photos`
  (`<user_id>/<timestamp>.<ext>`, máx. 2 MB): las ve cualquier usuario con sesión (como el
  nombre) con enlaces firmados de 1 h y cada uno solo toca su carpeta. Galería o cámara
  (`expo-image-picker`). `PersonAvatar` (círculo: foto, emoticono o inicial) en perfil,
  `PersonRow`, perfiles de otros y Configuración; `UserAvatar` busca la imagen por id en las
  clasificaciones. Al eliminar la cuenta se borran antes sus fotos desde la app (Storage no se
  borra desde SQL). Configuración empieza con un bloque «Perfil» que abre «Editar perfil».

- **Cambio de administrador de grupo** (petición del usuario; sigue habiendo **uno** por grupo,
  el usuario eligió traspasar y no varios). Migración `20261120`: `transfer_group_admin`
  (escudo junto a «expulsar» → pantalla de confirmación `app/grupos/[id]/administrador.tsx`),
  `resign_group_admin` (escudo en mi propia fila; aconseja designar antes porque si no se
  elige un miembro activo al azar) y `leave_group` («Abandonar el grupo» abajo para todos; el
  administrador sale tras pasar la administración al azar; el último miembro debe eliminar el
  grupo). El nuevo administrador recibe un aviso `group_admin` en el buzón.
- **Editar la imagen** (perfil y grupo, petición del usuario): `EditablePhoto` pone un botón
  «Editar» (o «Añadir foto») sobre la imagen que abre: cambiar foto (galería, y cámara en el
  perfil), editar foto y borrar foto. Con «Emoticono» elegido no sale el botón (`enabled`). `PhotoEditor` (Modal): arrastrar, pellizcar y girar 90°
  dentro del marco; recorta con `expo-image-manipulator` (512 px, JPEG) y la foto guardada se
  descarga antes con `expo-file-system` (`localCopy`). Cuentas en `src/lib/photoCrop.ts` (tests).
- Los campos de contraseña (`TextField` con `secureTextEntry`) llevan un ojo para verla.

- **Quitar de la pantalla principal** (petición del usuario): al borrar desde la selección un
  contador de grupo del que no soy administrador, el aviso explica que no se puede eliminar y
  que solo se quita de mi pantalla (sigo perteneciendo, cuento en la clasificación). Tabla
  personal `home_removed_counters` (migración `20261121`), campo `removedFromHome`. Se deshace
  con el botón de la casa en la cabecera del contador (se llega desde el grupo). Distinto de
  «ocultos», que siguen al final de la lista. Mezcla de borrables y no: un solo aviso.
- Cabecera nativa (Stack) en Android: con varios botones en `headerRight`, el contenedor lleva
  `collapsable={false}` y con uno solo va suelto; si no, los toques pueden no llegar.

- En «Miembros» del grupo, junto a cada miembro que no es mi amigo (lo ve todo el mundo):
  persona con + para enviarle solicitud; si me la envió él (o la rechacé), la acepta; si se la
  envié yo, un reloj.

- **Formato racha** en contadores (petición del usuario, p. ej. «días sin fumar»; individuales
  y de grupo): casilla «🔥 Formato racha» (`counters.streak_enabled`). El contador **no** vuelve
  a 0: cuenta como uno normal y además lleva una racha de **días** seguidos (Madrid) en los que
  lo sumado en el día es +1 o más; un día que no llega rompe la racha (no el contador). La de
  ayer sigue viva hasta que acabe hoy. Vista `my_counter_streaks` (current_days, best_days,
  today_done) y RPC `get_streak_leaderboard` en días (migraciones `20261122` y `20261125`). En
  la tarjeta: solo el primer botón rápido, el −1 y, donde estaba el −1, «🔥 días». En el
  detalle, «N días de racha · récord M». La clasificación es la normal (por periodo) con
  «🔥 N días» de cada uno.
- **Color de las rachas** (todas: uso de la app, contadores, amigos): la llama y el número van
  en color solo si **hoy** ya se ha mantenido; si no, en gris (`todayDone`, `activeToday` de
  `get_friends_streaks`). La racha de uso junto a «Mis contadores» va en un rectángulo, más
  grande.
- **Gráfica del contador** (petición del usuario): en el detalle de cualquier contador, encima
  del historial (y, en los de grupo, encima de la clasificación), «Evolución» (`CounterChart`): solo lo mío en ese contador (y sus enlazados),
  con periodo y el formato de siempre, sin filtros. Sale de `useMyDailyTotals` (ya en caché).
- **Gráfica del grupo** (petición del usuario): bajo la clasificación, «Evolución» del mismo
  contador y periodo (el periodo vive en `GroupLeaderboard`; en formato racha se elige encima
  de la gráfica). Una serie por miembro activo (`GroupMembersChart`, reutiliza
  `CounterChipsBar` y `StatsChart`); el icono de filtros ofrece Todos / Solo yo / Nadie. Datos
  por la RPC `get_group_counter_daily` (SECURITY INVOKER, sin `personal_only`, migración
  `20261123`).
- Filtros de inicio: con «De grupo» se puede elegir qué grupo (`filters.groupId`, cuenta
  también los enlazados).
- Crear/editar carpeta: botones «Todos», «Ninguno» y uno por grupo (marca o desmarca los de
  ese grupo) encima del buscador.
- Cabecera del grupo: arriba la imagen y, a su derecha y a la misma altura, el bloque del código
  (miembros activos); debajo, el nombre del grupo a la izquierda y a todo lo ancho.

- **Tutorial de bienvenida** (petición del usuario, `src/features/tutorial/`). Sale la primera
  vez que alguien entra si `profiles.tutorial_done = false` (migración `20261124`; sin la
  columna no sale nunca) y se marca al terminar o saltar. «Ver tutorial» en Configuración →
  Información. Pasos (`steps.ts`, puros con tests; rehechos a petición del usuario):
  bienvenida a pantalla completa (texto a la izquierda), «Esto es Cuéntalo» 2 s sobre la app
  (`banner`), **siempre** crear un contador sencillo aunque ya haya (+ → en el formulario, modo
  `simple`, se ilumina una idea y luego «Crear contador»; `screen: '/contadores/nuevo'` con
  `userNavigates`), sumar, restar 1, la pestaña Estadísticas y la de Amigos y grupos (desde
  inicio, todo oscurecido menos su botón), la racha y una pantalla final «Todo listo» / «Empieza a
  dejar huella de tu vida» con un círculo con huella: mantenerlo pulsado lo hace crecer hasta
  cubrir la pantalla (soltar antes lo devuelve con un rebote) y sale «"Me comprometo a
  registrar mi vida"» antes de terminar. La bienvenida no tiene «Saltar» (barra y «Seguir»
  abajo). Barra de progreso (`Progress`): lo hecho es barra, el paso actual una bolita llena y
  los pendientes bolitas huecas. Los pasos de tarea (crear, sumar, restar) se
  superan haciéndola, sin pausa ni «Siguiente»; Estadísticas, Amigos y grupos y la racha
  llevan «Siguiente». «Saltar», a la derecha de la barra. Sin confeti (el usuario lo quitó).
  Movimientos lentos y suaves (fluidez antes que velocidad, `MOVE_MS`). El bocadillo es el mismo de paso a paso: el foco se desliza al elemento nuevo
  (`useGlidingHole`, `lerpHole`), todo lo sigue, el texto entra con un fundido y la barra
  avanza. Si el elemento no aparece, sale «Siguiente». Al final, tras la promesa sale
  «Cuéntalo». Los de acción avanzan con `tutorialEvent` desde el código que ya existe
  (`useCounterActions.add`, `contadores/nuevo`; durante el tutorial crear vuelve a la lista y
  ofrece ideas de un toque) y solo dejan tocar el hueco. `TutorialHost` (montado en
  `app/_layout.tsx`, solo se ve en «Mis contadores»): oscurecido con hueco (SVG evenodd),
  anillo que late, flecha, bocadillo arriba o abajo (`layout.ts`, con tests), puntos de
  progreso. Los elementos se marcan con `TutorialTarget` (View con
  `collapsable={false}`) y se miden con `measureInWindow` cada 250 ms **restando la posición de
  la propia capa del tutorial** (medida igual): la ventana y la vista raíz no empiezan en el
  mismo sitio en Android y, sin restarla, el foco caía desplazado; si no aparece en 1,5 s,
  el paso sale sin foco y con «Siguiente». Pestañas: `tabBarButton` envuelve
  `PlatformPressable` (de `expo-router/react-navigation`).
- Valores de `Animated` en componentes: `useState(() => new Animated.Value(0))[0]`, no
  `useRef(...).current` (la regla react-hooks/refs lo marca como error).

- **Hora del móvil** (decisión del usuario; antes todo iba en Europe/Madrid): `profiles.time_zone`
  la guarda la app al abrirse (`useTimeZoneSync` → RPC `set_my_time_zone`, que solo acepta
  zonas de `pg_timezone_names`). `public.my_time_zone()` (Madrid si no hay) sustituye a
  'Europe/Madrid' en totales diarios, clasificaciones, rachas, gráfica del grupo y día de
  actividad (migración `20261126`). En la app, `localToday()` en vez de `todayInMadrid()`.
  Las menciones a Madrid en notas anteriores de este archivo se refieren a esto.
- **Líder y administrador** (decisión del usuario): el **líder** es quien crea y dirige el grupo
  (`groups.owner_id`, «Designar líder», «Dejar de ser líder»); el **administrador** es el
  responsable de cada contador (`counters.owner_id`). En código siguen llamándose owner/admin.
- **«Archivar» se juntó con «Ocultar»** (decisión del usuario): solo existe `hidden_counters`;
  la columna `counters.archived` se borró (migración `20261204`, junto con
  `profiles.avatar_url` y `profiles.hide_counters_from_friends`, que no se usaban).
- Textos: no dar por hecho que el primer botón rápido es +1 (se configura).
- El tutorial ilumina la primera tarjeta donde se puede sumar directamente (no un común de
  otro) y también avanza si se envía una solicitud al administrador.
- La racha de uso de la app se mantiene con cualquier registro, también un −1 (decisión del
  usuario: basta con interactuar).

- **Avisos al salir de un grupo** (migración `20261127`, `leave_group_as`): al abandonar un
  grupo o eliminar la cuenta, los demás reciben «X ha abandonado el grupo» (`member_left`). Si
  era el líder: el nuevo recibe «Eres el nuevo líder» (`you_are_leader`) y el resto «Y es el
  nuevo líder» (`new_leader`). Al abandonar, el nuevo líder es al azar; al eliminar la cuenta,
  el miembro más antiguo. `notifications.actor_name` guarda el nombre por si el perfil ya no
  existe. Expulsar a alguien no avisa.
- Errores: `getErrorMessage` traduce todos los códigos de nuestras funciones SQL y enseña tal
  cual los `raise exception` escritos en español (código P0001); nunca un código interno.
- «Exportar mis datos»: fechas en la hora del móvil (`localDateTime`).

- **Deshacer** (petición del usuario): tras un −1 sale abajo «−1 en «Cafés» · Deshacer» (tras +N
  ya no: el usuario lo quitó porque para eso está el −1)
  (`UndoToast`, montado en `app/_layout.tsx`, 4,5 s). La RPC `undo_last_entry` (migración
  `20261128`) borra mi último registro de hace ≤ 2 min con sus copias (`batch_id`) o, en un
  común que administro, la última tanda sumada a todos.
- −1 en un contador de racha: si hoy ya estaba mantenida y quedaría por debajo de +1
  (`streak.todayAmount`, nueva columna `today_amount` de `my_counter_streaks`), se avisa con
  «Perderías la racha» antes de restar.
- Mi racha de uso sale en mi perfil (`StreakCard`, lleva al calendario).
- Aviso «X te ha quitado del grupo» (`kicked`) por trigger al borrar el líder la fila de un
  miembro activo; no al salir uno mismo, al retirar una invitación ni al borrar el grupo.
- Recordatorio de contadores de racha (`reminder.counters`): uno por contador de racha que ese
  día aún no se ha mantenido, a la misma hora. Se reparten como mucho 60 avisos programados
  (límite de iOS: 64), con menos días por adelantado cuantos más contadores.
- Buscador en «Mis contadores» (ignora tildes, `src/lib/search.ts`) a partir de 6 contadores.

- **Estilo «Cine», el único de la app** (decisión del usuario, 2026-11-11): `isCinema = true`
  en `theme.ts`. El estilo clásico (morado) sigue en las ramas `isCinema ? … : …` y entero en
  las etiquetas de Git `diseno-clasico` (antes de Cine) y `estilos-elegibles` (con los dos
  estilos elegibles). En Configuración ya no hay «Estilo»; sí **Tema** (automático, claro,
  oscuro; de serie oscuro) y **Color** (seis colores sobrios, dorado de serie). Cine
  claro: papel cálido `#F3EEE4`, tarjetas `#FBF8F2`, tinta `#1A1714`, dorado oscuro `#8A6A1F`
  con texto blanco. `colors.elevated` (chips y botones secundarios) y `withAlpha` sustituyen a
  los colores fijos del oscuro. Quien tenía el morado y el tema del sistema de serie pasa una vez
  al dorado y al oscuro (`settings.cineDefaults`, con test). El engrosado de la serif usa el modo
  con el que arrancó la app; al cambiar el tema ya **no** se ofrece reiniciar (el usuario vio
  que no hacía falta y pidió quitarlo). Historia: antes era una
  prueba elegible (`settings.visualStyle`, que ya no se usa).
  Cine: siempre oscuro cálido (`cinemaPalette`: fondo `#0B0A09`, tarjetas `#141311`, chips
  `#1C1A17` = `CINEMA_ELEVATED_2`, texto `#F5F1E8`), un solo acento dorado `#E9C46A` con texto
  casi negro, Inter para la interfaz y **Instrument Serif** (`fonts.display`) para títulos de
  cabecera y cifras grandes, tarjetas de radio 24 y botones/chips en píldora (`shape`).
  Petición del usuario tras probarlo: **todos los títulos** con la serif (`titleFont(size)`,
  un 30 % más grande en Cine; los de cabecera de las pantallas, todos iguales a 34 con
  `screenTitleFont`), las **explicaciones largas y los avisos** con la misma serif en
  **itálica** (`proseFont(size, lineHeight)`, `fonts.prose`), y **nada de bloques blancos**
  (el texto blanco hueso sí): chip activo en dorado suave (`chipColors`: `primarySoft`, borde
  y texto dorados), recuadros destacados (deshacer, dato de la gráfica, mensajes del tutorial)
  con `inverseColors`. Cabeceras sin franja (`headerOptions`). Barra de pestañas en cápsula
  flotante sin textos con botón propio (`CinemaTabButton`: la librería pone el icono arriba y la
  activa rectangular), la activa en píldora dorada suave con icono dorado. Colores de gráfica
  apagados (`CINEMA_COLORS`). En clásico, Tema y Color siguen como siempre (en Cine se ocultan). El estilo
  anterior está guardado en la etiqueta de Git `diseno-clasico`. Fuentes de
  `@expo-google-fonts/instrument-serif` e `@expo-google-fonts/inter`.

- Cine, grosores (petición del usuario): Instrument Serif solo tiene un peso, así que se
  engorda con una sombra nítida del mismo color (`serifWeight`, ya incluida en `titleFont`,
  `displayFont` y `screenTitleFont`; con texto dorado se pasa el color). La sans de la interfaz
  pasa a Inter Medium (más fina).
- **Arrastrar en «Mis contadores»**: mantener pulsado levanta la tarjeta; si se mueve, cambia de
  sitio; si se suelta sin moverla, entra en el modo selección (`onHold` de `useDragReorder`).
  Antes el modo selección se activaba a mitad del gesto, la lista cambiaba de forma y las
  tarjetas «se rallaban». Al soltar, cada tarjeta se queda donde se ve hasta que llega el nuevo
  orden (`settle` + `useLayoutEffect`) y la lista no recorta vistas (`removeClippedSubviews`).
- **Ocultos** (petición del usuario): sin bloque; al final de la lista un texto «Ocultos (N)» con
  flecha que solo aparece (fundido) al bajar hasta el final y, al volver a subir, se esconde y
  se recoge el desplegable (`checkReveal` con las medidas del scroll).
- **Vista en bloques** (petición del usuario): botón cuadrado a la derecha de la barra de
  carpetas que cambia entre filas (de serie) y bloques cuadrados, dos por fila
  (`settings.counterLayout`, `CounterCard grid`: icono, nombre, total grande y solo el primer
  botón rápido y el −1). En bloques no se reordena arrastrando (el arrastre es vertical).
- **Contactos y sugerencias** (petición del usuario; migración `20261211`). Sincronizar el
  número es voluntario y sin SMS (costaría dinero): se guarda solo el SHA-256 de
  'cuentalo:' + sus 9 últimas cifras (`phone.ts`, con tests; `expo-crypto`) en
  `phone_directory` (RPC `set_my_phone`; se quita borrando la fila). La agenda se lee con
  `expo-contacts/legacy` (solo tras dar permiso) y se envían sus resúmenes a
  `get_friend_suggestions` (SECURITY DEFINER): contactos que sincronizaron su número y amigos
  de amigos (con cuántos en común), sin quien ya tiene relación conmigo. En «Amigos», bajo tus
  amigos: tarjeta para sincronizar (o «sincronizado · Quitar»), hasta 20 sugerencias y
  «Descubrir más» → `app/amigos/descubrir.tsx` (buscador de cualquier usuario y hasta 100
  sugerencias). El número no se verifica: alguien podría poner uno ajeno (V1).

- Cine, textos (petición del usuario): todo lo que no es título va en **Redaction 10**
  (`assets/fonts/Redaction10-Regular.otf` y `-Bold.otf`, del paquete oficial de redaction.us,
  licencia OFL; `fonts.title` = Bold, `fonts.detail` = Regular). Antes se probó Tinos (Times New
  Roman) y el usuario prefirió Redaction 10. Explicaciones, pistas, textos vacíos y avisos en la serif
  itálica (`proseFont`). Títulos de cabecera: todos del mismo tamaño, el mayor que cabe en
  «Mis contadores» sin solaparse con la racha ni con los botones (`src/lib/screenTitle.tsx`:
  `TitleMeasurer` mide el texto a tamaño 100, la racha avisa de su ancho, `fitTitleSize` con
  tests, entre 20 y 30).
- La vista de «Mis contadores» (filas o bloques) se guarda en el móvil y es la que sale al
  volver a abrir la app.

- Bloques de la cuadrícula (petición del usuario): arriba icono y total; debajo el nombre y, si
  es de grupo, sus grupos; abajo los botones de siempre repartidos a lo ancho
  (`QuickAddBar stretch`): las cantidades y el −1, o en racha el primero, el −1 y la racha.
- Cabeceras: solo los títulos de pantalla van con la letra de títulos. Textos de estado como
  «1 seleccionado» van con la letra normal a 18. En Cine, las pantallas que se abren encima
  usan `HeaderTitle` (mismo tamaño que las pestañas, `maxWidth` que deja sitio a la flecha y a
  los botones, y se reduce o corta con «…» si el nombre es largo): nunca pisa los botones.
- «Ocultos» se cerraba solo al tocarlo (se recalculaba su posición con medidas a medio
  actualizar): ahora la posición del título solo se mide con el desplegable cerrado.
- El total de cada tarjeta (filas y bloques) va dentro de un **rectángulo** redondeado del color
  de la app (`primarySoft` con borde) para que destaque (petición del usuario; no círculo): alto
  fijo, se alarga con las cifras y el número centrado en los dos ejes (`textAlign` y
  `textAlignVertical` centrados, `includeFontPadding: false` y `lineHeight` ajustada).
- **Arrastrar para reordenar** (`useDragReorder`, también en Estadísticas): lista o cuadrícula
  (`columns`; en «Mis contadores», 2 en la vista de bloques, con `gridDropIndex` y
  `slotPositions` en `reorder.ts`, con tests). Al levantar crece un poco; los demás se deslizan
  a su hueco nuevo (vibración suave al cambiar de hueco); al soltar, la tarjeta se desliza a su
  hueco y solo después se guarda el orden (antes saltaba de golpe y hacía un «glitch»). Las
  animaciones del arrastre van sin native driver a propósito: los `setValue` se aplican en el
  mismo fotograma que el nuevo orden.
- «Mis contadores» ya no usa FlatList sino un ScrollView con las tarjetas dentro, igual que
  los bloques de Estadísticas: así el arrastre para reordenar es igual de fluido (sin celdas
  virtualizadas, recortes ni capas por celda). Son pocos contadores, no hace falta virtualizar.

- Barra de pestañas de Cine: cápsula redondeada casi de borde a borde (`marginHorizontal: 6`).
- Botones de sumar y restar: números más grandes (17 en la tarjeta, 22 en el detalle).

- **Colores de destaque** (petición del usuario): seis clásicos y sobrios, sin personalizado:
  Dorado (de serie), Burdeos, Verde inglés, Azul tinta, Terracota y Plata (`accents` en
  `theme.ts`; un test comprueba contraste AA con el texto de los botones y sobre el fondo, en
  claro y oscuro). Un color guardado que ya no existe vuelve al dorado. Se quitó
  `ColorPickerDialog` (en Git si hiciera falta).

- El dorado sale como «Dorado (recomendado)» en Configuración (petición del usuario). El dorado
  claro es `#7E611B` (con `#8A6A1F` no llegaba a AA sobre el papel).
- **Foto como icono del contador** (petición del usuario; migración `20261212`):
  `counters.photo_path` y bucket privado `counter-photos` (`<counter_id>/<ts>.<ext>`, 2 MB). La
  sube quien edita el contador (`can_edit_counter_photo`: dueño de un individual o
  administrador de uno de grupo) y la ve quien ve el contador o, en individuales visibles para
  amigos, sus amigos (`can_see_counter_photo`). En el formulario (no en el modo sencillo del
  tutorial): Emoticono / Foto como en los grupos, con `EditablePhoto`. `CounterAvatar` enseña
  foto > emoticono > inicial (`photoPath`, enlaces firmados de 1 h en `useCounterPhotoUrl`,
  fuera de `refreshAll`). El perfil de otros (RPC `get_user_counters`) aún no trae la foto.
- **Barras de «Mis contadores» escondidas** (petición del usuario): la de carpetas (con el botón
  de vista) y el buscador van **dentro de la lista**, encima del primer contador. Al abrir, la
  lista empieza justo debajo de ellas (`hideBarsInitially`, un `scrollTo` sin animar) y salen al
  subir más allá del primer contador, al ritmo del dedo, sin recargar; al bajar se van con la
  lista. Si se suelta a medias, terminan de salir o de esconderse (`settleBars`). El contenido
  tiene `minHeight` = pantalla + barras para que siempre se puedan esconder. En el modo selección
  la de carpetas va fija arriba (selección en masa). Se probaron antes un panel que se abría al
  tirar (con la recarga o siguiendo el dedo) y no funcionaba bien: Android cancela los toques
  de JS en cuanto la lista o la recarga toman el gesto.
- Editar contador: «Guardar» va arriba a la derecha en la cabecera (`CounterForm
  submitInHeader`), no abajo (petición del usuario). Crear sigue con el botón abajo.
- Bloques de la cuadrícula: icono más grande (52); si hay línea de grupos, el nombre va en una
  sola línea para que todo quepa en el cuadrado.

- **Entrar con email o nombre de usuario** (petición del usuario; migración `20261213`): si lo
  escrito no lleva @ es un nombre de usuario y la RPC `login_email_for_username` (SECURITY
  DEFINER, la puede llamar `anon`) da el email **solo si la contraseña es la buena**
  (`extensions.crypt` contra `auth.users.encrypted_password`), así nadie saca emails ajenos;
  después se entra con email y contraseña como siempre. Fallos en `login_attempts`: con 10 en
  15 minutos para un usuario, se bloquea un rato. Los nombres de usuario son únicos
  (`profiles_username_key`) y en el registro se comprueba mientras se escribe
  (`is_username_available`, «Ese nombre de usuario ya está en uso») y no deja crear la cuenta.
- **¿Olvidaste tu contraseña?** (`app/(auth)/recuperar.tsx`): pide el email y
  `resetPasswordForEmail` manda un correo con un **enlace** (con el correo integrado, Supabase no
  deja editar la plantilla para poner un código: haría falta un SMTP propio). El enlace vuelve a
  la app (`redirectTo` = `Linking.createURL('/restablecer')`: `cuentalo://restablecer`, o
  `exp://…/--/restablecer` en Expo Go) con la sesión en el fragmento; `app/restablecer.tsx`
  (fuera de las zonas con y sin sesión) la lee (`parseRecoveryUrl`, con tests), hace
  `setSession` y lleva a `app/nueva-contrasena.tsx` (`updateUser({ password })`). **Requiere**
  en Supabase → Authentication → URL Configuration → Redirect URLs: `cuentalo://**` y
  `exp://**`; si no, Supabase manda al Site URL y el enlace «no funciona». Para publicar hará
  falta un SMTP propio (el integrado manda pocos correos por hora; Fase 6).

- Calendario de rachas: además de las flechas, se cambia de mes **deslizando** los días con el
  dedo (`useMonthSwipe` en `StreakCalendar`, PanResponder solo para gestos claramente
  horizontales): siguen al dedo, salen por ese lado y entra el mes nuevo por el otro; hacia el
  futuro desde el mes actual se frena. Los días con actividad son círculos con fondo y borde
  siempre puestos (transparentes si no) y clave por fecha: en Android salían cuadrados al
  volver de otro mes.

- **Fusionar en dos pasos** (petición del usuario): 1) elegir los contadores («Siguiente»);
  2) «Contador resultante»: nombre e imagen ya rellenos con los del que se queda y editables
  antes de fusionar (nombre obligatorio). Si queda un individual, emoticono o foto (como al
  editar; la foto se aplica tras `merge_counters` con `applyCounterPhoto` en
  `useMergeCounters`). Si queda uno de grupo, solo nombre y emoticono, personales (alias): la
  foto cambiaría la de todo el grupo.

- **Tutorial fluido** (iba a trompicones): el foco ya no pasa por React en cada fotograma.
  `useGlide` (en `TutorialHost`) mueve anillo, flecha y bocadillo con valores animados y
  redibuja el oscurecido (Path de SVG) con `setNativeProps` una vez por fotograma
  (`requestAnimationFrame`). Antes `useGlidingHole` hacía `setState` en cada fotograma y se
  volvía a pintar todo el tutorial. Un cambio pequeño de posición (las medidas cada 250 ms)
  hace un retoque corto en vez de reiniciar el deslizamiento largo. Latidos de anillo y flecha
  siguen en el hilo nativo, en una vista interior (no se mezclan con los valores del hilo JS).

- Campos de texto (TextField, buscadores, emoticono propio) con `fonts.detail`, también el
  texto de ejemplo (petición del usuario). Unidad: «ej. cervezas, libros, km» (sin «déjalo
  vacío…»). En crear/editar contador, la explicación de «🔥 Formato racha» va en un ⓘ a la derecha
  de la fila, del color de la app, igual que el de «Contador común» (`InfoButton` en
  `CommonCounterInfo.tsx`: botón y ventana comunes; `StreakFormatInfo` y `CommonCounterInfo`).

- **Podio** (petición del usuario, con una imagen de ejemplo): en todas las clasificaciones
  (la de cada contador de grupo, en su detalle y en el grupo, y la de rachas con amigos) los
  tres primeros van en un podio encima de la lista (`src/components/Podium.tsx`): 2.º a la
  izquierda, 1.º en el centro más alto y con una corona lisa amarilla (`MaterialCommunityIcons` «crown»,
  `#F2C230`, del estilo de la llama; no emoticono), 3.º a la derecha; foto o icono de cada
  uno sobre su escalón con el puesto en una insignia, nombre («Tú» si soy yo) y valor. Solo
  entran quienes tienen algo (total o racha > 0). Debajo, la clasificación **entera** en filas
  como siempre, también los tres primeros (petición del usuario). Tocar a
  otro abre su perfil.

- **Total de un contador común = cada suma una vez** (petición del usuario; migración
  `20261214`): un +N en un común sigue guardando una fila por participante (a cada uno le cuenta
  en lo suyo), pero todas llevan la misma `entries.common_batch` y en el total del grupo («entre
  todos») y en `entry_count` solo cuenta una fila por tanda (`my_counter_totals` y la vista
  `counter_totals`, con `row_number()`). Antes +1 con dos participantes daba +2. Las sumas ya
  guardadas se marcaron por `created_at`. En la app, la suma optimista es +N (no × participantes)
  y quien no participa ve el total del grupo tal cual. Los bots comprueban la misma regla.

- **Todo al instante** (petición del usuario: «primero que se vea, luego se guarda por
  detrás»):
  - `refreshAll` ya **no devuelve la promesa**: antes los `onSuccess` la devolvían y TanStack
    Query esperaba a volver a pedir todas las consultas antes de dar el cambio por hecho
    (botones girando, pantallas que no se cerraban). Igual en `useUpdateProfile`.
  - Cambios **optimistas** con `optimistic` / `optimisticHandlers` (`src/lib/queryClient.ts`:
    aplicar ya, deshacer si falla, refrescar por detrás al acabar): ocultar/mostrar, quitar de
    inicio, borrar contadores, editar contador (`patchCounters`, lista y detalle; respeta los
    alias), carpetas (crear, editar, añadir, borrar), amistades (aceptar/rechazar, borrar,
    enviar solicitud quita de sugerencias) y avisos leídos. Editar contador, ocultar, guardar
    carpeta y «Otra cantidad» cierran al instante; si falla, aviso y vuelta atrás.
  - `placeholderData: keepPreviousData` en consultas que cambian con un filtro (clasificación
    por periodo, gráfica del grupo, historial, último usado, búsqueda de usuarios, sugerencias):
    se sigue viendo lo anterior hasta que llega lo nuevo, sin parpadeo ni «cargando».
  - `usePrefetchMain` (`src/lib/prefetch.ts`, en `app/_layout.tsx`): al entrar se cargan por
    detrás las pestañas principales; cambiar de pestaña es instantáneo.
  - «Tirar para refrescar» con `usePullRefresh`: el círculo solo sale al tirar el usuario
    (antes iba con `isRefetching` y salía tras cada cambio, como si recargara la pantalla).

- **«Amigos y grupos» más rápida** (petición del usuario):
  - Cabecera: llave (unirse con código → `app/grupos/unirse.tsx`, reutiliza `JoinByCode`),
    buzón y + (crear grupo, el mismo + que en «Mis contadores»). «Crear grupo» y el campo del
    código ya no están abajo.
  - Grupos y Amigos son **dos páginas** una al lado de otra en un ScrollView horizontal con
    `pagingEnabled` (desplazamiento nativo: sigue al dedo y se asienta solo; cada página con su
    propio scroll vertical y «tirar para refrescar»). El selector desliza a la página y cambia en
    cuanto se pasa la mitad. Antes era un gesto hecho a mano que movía el contenido y lo
    cambiaba de golpe (el usuario lo veía poco fluido).
  - «Tus grupos» ordenados por **mi** actividad (último día con algún registro mío en sus
    contadores, de `useMyDailyTotals` + la lista de contadores; cada usuario ve su orden) y
    cada grupo se precarga por detrás (`prefetchQuery` de su detalle): se abre al instante.
  - Junto al nombre de cada amigo, su racha (🔥 N, en color si hoy la ha mantenido;
    `useFriendsStreaks`, `PersonRow badge`).
  - Mantener pulsado: un amigo → ver perfil, invitar a un grupo que lidero, eliminar; un grupo
    → abrir, nuevo contador del grupo, compartir invitación (`shareInvite`).
  - Los menús de mantener pulsado llevan arriba la foto o icono del amigo / del grupo en vez de
    la advertencia roja: `appAlert(…, { image })` (con `image`, nunca sale la advertencia;
    eliminar amigo ya pide confirmación aparte).
  - Pendiente de hablar con el usuario: recordar la última pestaña y contadores en el selector.

- Selector Grupos / Amigos: la píldora iluminada **se desliza** siguiendo el desplazamiento de
  las páginas (`SegmentedControl position`, una `Animated` del desplazamiento horizontal con
  native driver), en vez de saltar al cambiar.
- Fotos de contador en el perfil de otros (migración `20261215`): `get_user_counters` devuelve
  `photo_path` y `can_see_counter_photo` deja ver también las de los contadores de grupos con
  algún amigo dentro (los que enseña su perfil).

- **Sin conexión** (petición del usuario; `src/lib/offline.ts`): `onlineManager` de TanStack
  Query con `@react-native-community/netinfo`. Sin internet, los +N y −1 no fallan: quedan en
  pausa (ya se ven sumados, optimistas) y se envían solos al volver. Los pendientes se guardan
  en el móvil (`PersistQueryClientProvider` + `@react-native-async-storage/async-storage`, solo
  las mutaciones en pausa, nunca datos ni la sesión) y se reanudan al abrir la app
  (`resumePausedMutations`); por eso cada tipo tiene su clave y su función registrada
  (`setMutationDefaults`: `entryAddKey` / `entryRemoveKey`, `sendAddEntry` / `sendRemoveOne`).
  La hora del registro es la del toque (la fecha vuelve como texto de AsyncStorage y se
  convierte; test). El −1 y el día de la racha usan la hora del envío. En «Mis contadores» sale
  «Sin conexión: lo que sumes se enviará al volver» (`useIsOnline`). Tras cerrar la app sin
  conexión, el número optimista no se ve hasta que se envía.

- **Paletas de prueba 60-30-10** (petición del usuario, desde unas imágenes; prueba, el estilo de
  siempre está en la etiqueta de Git `estilo-cine-dorado`): `src/lib/palettes.ts` con Grafito
  (#2B2D31 / #D9DADC / #FFC93C), Marino (#0F1B3D / #FFFFFF / #FF3D8B), Salvia (#9CAF88 /
  #F7F5EF / #E8412C), Avena (#E9E5D6 / #2589D8 / #FF783D) y Mantequilla (#F5E8CC / #F34E3D /
  #55263D). 60 % = fondo (y cabeceras); 30 % = el color de las letras (Grafito, Marino, Avena y
  Mantequilla, oscurecido lo justo para leerse) o el de las tarjetas (Salvia); 10 % = destaque
  (botones, totales, pestaña activa, iconos). Algunos tonos van un poco oscurecidos para el
  contraste (tomate `#B52A15`, mandarina `#BE4A14`; test de contraste por paleta). Se elige en
  Configuración → Apariencia → «Paleta (prueba)» (`settings.palette`, 'cine' = el de siempre;
  `PalettePicker` con las muestras 60/30/10). Con una paleta, `useThemeColors` y
  `useColorMode` salen de ella y se ocultan Tema y Color. Al cambiarla se ofrece reiniciar: el
  engrosado de la serif (`startText`) y la primera serie de las gráficas (`startAccent`) se
  fijan al arrancar.

- **Tipografías de prueba** (petición del usuario: modernas, cercanas, que cuenten historias;
  títulos llamativos y elegantes, el resto que encaje pero contraste): `src/lib/typography.ts`
  con Editorial (Fraunces **ExtraBold** con interletrado −0,4 en los títulos grandes, más
  gruesos y con más vida a petición del usuario, + Plus Jakarta Sans, cursiva Fraunces; **de serie**), Con
  carácter (Bricolage Grotesque + Newsreader, al revés: títulos sans y texto serif), Clásica
  (DM Serif Display + DM Sans) y «La de ahora» (Instrument Serif + Redaction 10). Se elige en
  Configuración → Apariencia → «Tipografía (prueba)» (`settings.typography`,
  `TypographyPicker` con cada opción escrita en sus letras); se fija al arrancar (`typography`
  en `theme.ts`) y al cambiarla se ofrece reiniciar. `displayFactor` y `proseScale` corrigen
  los tamaños (pensados para Instrument Serif, más pequeña); el engrosado con sombra
  (`serifWeight`) solo se usa con Instrument Serif (`fakeBold`). El título de cabecera se mide a
  tamaño 100 real con la letra elegida.

- **Textos que se cortaban** (con las letras nuevas): sin interletrado negativo en los títulos
  (Android mide el texto corto y corta la última letra); las cursivas llevan `paddingRight: 3`
  (la última letra se sale de su caja); los botones rápidos tienen ancho **mínimo** 36 (no fijo)
  y su número se ajusta al botón (`adjustsFontSizeToFit`), y el selector y las carpetas reducen
  un poco la letra antes de cortar.
- La pestaña se llamó un tiempo «Contadores» y **volvió a «Mis contadores»** al pasar la racha
  a la derecha (petición del usuario): la racha va ahora **pequeña** (`StreakBadge compact`) en
  `headerRight`, junto a filtros y +, y el título queda solo. El tamaño común de los títulos se
  mide con «Mis contadores» y el ancho de la racha (`reportBadgeWidth`) igual que antes.

- La pestaña «Amigos y grupos» se llama **«Social»** (petición del usuario), también en los
  textos que la mencionan y en el paso del tutorial. (Las notas anteriores de este archivo que
  dicen «Amigos y grupos» se refieren a ella.)

- Cabecera de «Contadores»: el + más grande (46) con un «+» de grosor medio (`MaterialCommunityIcons`
  «plus», 32; «plus-thick» resultó demasiado grueso); fusionar y filtros, más pegados a él (hueco 12). En el modo selección, «N
  seleccionados» a 15, con ancho máximo y reduciéndose si hace falta: se superponía con los
  botones.

- El botón de fusionar ya no está en la cabecera de «Contadores» (petición del usuario): solo en
  el modo selección (mantener pulsado un contador). `HEADER_RIGHT_WIDTH` sigue en 139 para no
  cambiar el tamaño de los títulos.

## Cambios estéticos pendientes

- (ninguno por ahora)
