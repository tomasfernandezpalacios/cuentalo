# Cuéntalo

App móvil (Android e iOS) para contabilizar cualquier actividad de la vida cotidiana —cervezas,
libros, kilómetros, idas al gimnasio…— con estadísticas personales y contadores compartidos en
grupos de amigos con clasificación.

Stack: React Native + Expo (SDK 58) · TypeScript · Expo Router · Supabase · TanStack Query.

## Requisitos

- Node.js LTS (≥ 20) y npm
- La app **Expo Go** en el móvil (misma red Wi‑Fi que el ordenador)
- Un proyecto de [Supabase](https://supabase.com)

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellena la URL y la anon key de Supabase
npx expo start
```

Escanea el QR con la cámara (iOS) o con Expo Go (Android). Si la red no deja conectar,
prueba `npx expo start --tunnel`.

## Scripts

| Comando             | Qué hace                          |
| ------------------- | --------------------------------- |
| `npm start`         | Arranca el servidor de desarrollo |
| `npm run lint`      | ESLint (config de Expo)           |
| `npm run typecheck` | Comprobación de tipos con `tsc`   |
| `npm run format`    | Formatea el código con Prettier   |

## Estructura

```
app/                  Rutas (Expo Router): cada archivo es una pantalla
src/components/       Componentes reutilizables
src/lib/              Cliente de Supabase, tema y utilidades
src/features/<x>/     Lógica por funcionalidad: contadores, estadisticas, social, perfil
supabase/migrations/  Migraciones SQL (esquema, RLS, funciones)
docs/                 Prompt original y documentación
```

## Base de datos

Las migraciones están en `supabase/migrations/`. Se aplican con la CLI de Supabase
(`npx supabase link` + `npx supabase db push`) o pegando el SQL en el SQL Editor del panel.
