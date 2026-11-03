# Cuéntalo — Prompt para Claude Code

## Antes de pegar el prompt (lo haces tú, 10 minutos)

1. Instala **Node.js (LTS)** y **Git**.
2. Crea un repositorio vacío en GitHub llamado `cuentalo` y clónalo: `git clone <url> && cd cuentalo`.
3. Crea un proyecto gratis en **supabase.com** (región Europa). Apunta dos datos en Ajustes > API: la **Project URL** y la **anon public key**.
4. Instala la app **Expo Go** en tu móvil.
5. Abre Claude Code dentro de la carpeta `cuentalo` y pega todo lo que hay debajo de la línea.

---

## PROMPT (pega desde aquí)

Vas a construir desde cero una app móvil llamada **Cuéntalo**, para Android e iOS, en este repositorio. Trabaja por fases, haz un commit al terminar cada una y detente al final de cada fase para que yo pruebe antes de seguir. Yo soy estudiante de Ingeniería Informática y Matemáticas: explícame brevemente las decisiones importantes, pero no me abrumes.

### 1. Concepto

Una app para contabilizar cualquier actividad de la vida cotidiana (cervezas, libros leídos, kilómetros, idas al gimnasio, películas, viajes...) y consultar estadísticas. Lo más importante es la parte social: los usuarios añaden amigos, crean grupos privados y tienen **contadores compartidos** con clasificación entre los miembros.

- Cada usuario crea sus propios contadores con nombre y unidad de medida (sin categorías fijas).
- Registrar es muy rápido: botones **+1, +5, +10** y cantidad personalizada. Cada registro lleva fecha.
- Se pueden ver, editar y borrar registros anteriores.
- Contador **privado**: solo lo ve su dueño. Contador **compartido**: pertenece a un grupo, cada miembro registra sus propias cantidades y la app calcula el total de cada miembro, el total del grupo y la clasificación.
- Un registro en un contador compartido cuenta automáticamente en las estadísticas personales y en las del grupo, sin introducirlo dos veces.
- Si un usuario sale de un grupo, conserva sus estadísticas personales.

### 2. Stack (no lo cambies sin consultarme)

- **React Native + Expo** (SDK estable más reciente), **TypeScript** estricto, **Expo Router**.
- **Supabase** (Auth con email y contraseña + Postgres + Row Level Security) como backend. Usa `@supabase/supabase-js` y guarda la sesión con `expo-secure-store`.
- **TanStack Query** para el estado del servidor.
- Gráficas: elige una librería sencilla y compatible con Expo (por ejemplo `react-native-gifted-charts` o `victory-native`) y justifica la elección en una línea.
- Interfaz en **español**. Diseño limpio, moderno, con modo claro y oscuro.
- Estructura de carpetas ordenada: `app/` (rutas), `src/components`, `src/lib` (cliente Supabase, utilidades), `src/features/<contadores|estadisticas|social|perfil>`, `supabase/migrations`.

### 3. Modelo de datos (Postgres)

Crea las migraciones SQL en `supabase/migrations/` y aplícalas con la CLI de Supabase (o dame el SQL para pegarlo en el SQL Editor si es más sencillo).

- `profiles`: id (= auth.users.id), username único, display_name, avatar_url, created_at. Se crea automáticamente con un trigger al registrarse un usuario.
- `friendships`: id, requester_id, addressee_id, status (`pending` | `accepted` | `rejected`), created_at. Restricción para que no haya duplicados ni auto-amistad.
- `groups`: id, name, owner_id, created_at.
- `group_members`: group_id, user_id, role (`owner` | `member`), status (`invited` | `active`), joined_at.
- `counters`: id, owner_id, name, unit, group_id (nulo = privado; con valor = compartido con ese grupo), streak_enabled (bool, por defecto false), archived (bool), created_at.
- `entries`: id, counter_id, user_id, amount (numeric > 0), logged_at (timestamptz, por defecto now), note (opcional), created_at.

Reglas de diseño:
- Un contador compartido es **un único contador** del grupo; cada miembro inserta sus propias filas en `entries` con su `user_id`. Las estadísticas personales se calculan sumando mis `entries` en todos los contadores, privados y compartidos. Así no hay duplicación de datos.
- Índices en `entries (counter_id, logged_at)` y `entries (user_id, logged_at)`.

### 4. Seguridad y privacidad (crítico)

Activa **Row Level Security en todas las tablas** y escribe las políticas. Usa funciones `SECURITY DEFINER` auxiliares (por ejemplo `is_group_member(group_id)`) para evitar recursión en las políticas. Reglas:

- `profiles`: cualquier usuario autenticado puede buscar perfiles por username (solo campos públicos); solo yo edito el mío.
- `friendships`: solo veo las que me implican; solo el destinatario puede aceptar o rechazar.
- `groups` y `group_members`: solo los miembros activos (o invitados, para ver la invitación) ven el grupo; solo el owner invita y elimina miembros; un miembro puede salirse. Solo se puede invitar a **amigos aceptados**.
- `counters`: veo los míos y los compartidos con grupos donde soy miembro activo. Solo el dueño de un contador privado lo edita; en los compartidos, cualquier miembro puede crearlos en su grupo y solo el creador o el owner del grupo los edita o archiva.
- `entries`: veo las mías y, en contadores compartidos, las de los miembros del mismo grupo. **Solo puedo insertar, editar y borrar las mías**, y solo en contadores que me pertenezcan o de grupos donde soy miembro activo.
- Escribe pruebas SQL o un script que verifiquen que un usuario ajeno **no** puede leer contadores privados ni escribir registros ajenos.

Clasificaciones: crea una función RPC `get_leaderboard(counter_id uuid, period text)` con `period` en (`week`, `month`, `year`, `all`) que devuelva por miembro: user_id, username, total y posición. Debe respetar la RLS y usar la semana ISO y el mes/año naturales en zona horaria `Europe/Madrid`.

### 5. Pantallas de la V1

Navegación con 4 pestañas inferiores:

1. **Mis contadores**: lista de contadores con su total; crear contador (nombre, unidad, privado o compartido con un grupo); pantalla de detalle con botones +1, +5, +10, cantidad personalizada, historial (editar y borrar registros) y total.
2. **Mis estadísticas**: total por contador, número de registros, contadores más usados, resumen de última semana, último mes, año e histórico, y evolución temporal por semana, mes y año (gráfica de barras) de cada contador.
3. **Amigos y grupos**: buscar usuarios por username, enviar, aceptar y rechazar solicitudes, lista de amigos; crear grupo, invitar amigos, ver miembros; contadores compartidos del grupo; **clasificación** con selector de periodo (semana, mes, año, histórico) que se actualiza al registrar.
4. **Mi perfil**: datos del usuario, editar nombre y username, grupos a los que pertenece, cerrar sesión y **eliminar cuenta** (obligatorio para Apple; implementa una función segura que borre los datos del usuario).

Además: pantallas de registro e inicio de sesión, estados de carga, vacíos y error, y comprobaciones de validación (cantidades > 0, nombres no vacíos).

**Fuera de la V1** (no lo hagas todavía, pero deja el código preparado): rachas avanzadas, notificaciones push, compartir un contador privado existente con un grupo, estadísticas elaboradas.

### 6. Fases de trabajo

- **Fase 0 – Base:** inicializa Expo + TypeScript + Expo Router, configura ESLint y Prettier, `.gitignore`, `.env.example` (con `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`), un `README.md` con cómo ejecutar el proyecto y un `CLAUDE.md` con las convenciones y decisiones de este prompt. Pídeme la URL y la anon key de Supabase para crear el `.env` local.
- **Fase 1 – Cuenta y contadores:** migraciones de `profiles`, `counters` y `entries` con RLS; registro, login y sesión persistente; CRUD de contadores y registros con +1, +5, +10 y personalizado.
- **Fase 2 – Estadísticas personales:** totales, periodos y gráficas de evolución. Escribe tests unitarios para las funciones de agregación por periodo.
- **Fase 3 – Amigos y grupos:** `friendships`, `groups`, `group_members` con RLS, búsqueda, solicitudes, invitaciones.
- **Fase 4 – Contadores compartidos y clasificación:** `group_id` en contadores, la función `get_leaderboard`, pantallas de grupo y clasificación, y las pruebas de privacidad.
- **Fase 5 – Perfil y pulido:** perfil, eliminar cuenta, modo oscuro, iconos, pantalla de carga, revisión de accesibilidad y textos.
- **Fase 6 – Preparar publicación:** configura `app.json` (nombre, `slug`, `bundleIdentifier` y `package` como `com.<mi-usuario>.cuentalo`, versión, icono y splash), `eas.json` con perfiles `development`, `preview` y `production`, y redacta una plantilla de **política de privacidad** y una lista de lo que debo preparar para las fichas de Play Store y App Store (capturas, descripción, formulario de datos). No ejecutes nada que cueste dinero ni crees cuentas por mí.

### 7. Reglas de trabajo

- Nunca subas claves ni el `.env` a Git. La anon key va solo en `.env` local; nunca uses la `service_role` key en el código de la app.
- Al terminar cada fase: ejecuta el linter y los tests, haz commit con un mensaje claro en español, y dime **exactamente qué comando ejecutar y qué probar** (por ejemplo `npx expo start` y escanear el QR con Expo Go).
- Si algo requiere una acción mía (crear algo en el panel de Supabase, aceptar un permiso, ejecutar un SQL), dímelo con pasos concretos.
- Si tienes dudas de diseño que cambien el resultado, pregúntame antes de decidir; si son menores, decide y anótalo en `CLAUDE.md`.
- Mantén el código simple y legible: prefiero menos dependencias y funciones pequeñas.

**Empieza ahora por la Fase 0 y para al terminarla.**
