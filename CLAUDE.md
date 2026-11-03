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
- Colores siempre desde `useThemeColors()` (`src/lib/theme.ts`), con modo claro y oscuro.
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
`Europe/Madrid`.

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
- Migraciones: se aplican pegándolas en el SQL Editor (no hay Docker ni CLI enlazada). Si se
  cambia una migración ya aplicada, crear una nueva en vez de editarla.
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
