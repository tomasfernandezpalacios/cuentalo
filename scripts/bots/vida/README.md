# Bots con vida

Las cinco cuentas de los bots (`prueba1` … `prueba5`, contraseñas en `scripts/bots/.bots.json`)
convertidas en cinco amigos que usan Cuéntalo desde el 14 de septiembre de 2026. A diferencia de
`bots.mjs` (pruebas al azar que buscan fallos), aquí todo es coherente y sigue un plan
(`mundo.mjs`). **No mezclar**: ejecutar `npm run bots` desordenaría este mundo.

| Cuenta  | Nombre        | Cómo usa la app                                                     |
| ------- | ------------- | ------------------------------------------------------------------- |
| prueba1 | Lucía Martín  | Constante: agua, meditación (racha) y páginas; lidera el club.      |
| prueba2 | Marcos Ruiz   | Cafés, días sin dulces (racha); lidera Gimnasio, entrena a diario.  |
| prueba3 | Sofía Navarro | Series, km corridos, conciertos; lidera el piso, cervezas y pizzas. |
| prueba4 | Daniel Gómez  | Ocasional: libros y paseos; llegó dos semanas después.              |
| prueba5 | Carla Ortega  | Competitiva: flexiones (racha) y entrenos; horas de estudio.        |

Grupos: **Gimnasio** (Entrenos, Flexiones con racha), **Piso Lavapiés** (Cervezas, Veces que
friego, común «Pizzas pedidas») y **Club de lectura** (Libros terminados).

Los cinco te envían solicitud de amistad (`HUMAN` en `mundo.mjs`). Cuando aceptas la de Marcos o
Lucía, en la siguiente ejecución te invitan a Gimnasio o al Club. Si les invitas a tus grupos,
aceptan y de vez en cuando suman en tus contadores.

## Uso

```bash
npm run bots:vida:sembrar   # solo una vez: crea el mundo y dos meses de historia
npm run bots:vida           # un rato de uso: se ponen al día desde la última vez
```

`dia.mjs` lo lanza cada noche la tarea de Windows «Cuentalo bots» (21:30; si el ordenador estaba
apagado, en cuanto se enciende). Su salida va a `registro.log`. El estado (hasta cuándo han
apuntado e invitaciones enviadas) está en `.estado.json` (ignorado por Git).

## Fechas de la siembra

Las funciones de la app ponen la fecha de hoy a lo que se crea y a la racha de uso. Tras sembrar
se retocaron con el conector de Supabase: `created_at` de perfiles, contadores, grupos,
amistades y carpetas, `joined_at` de los miembros, `user_activity_days` a partir de los días con
registros y se borraron los avisos de la siembra.

## Empezar de cero

Borrar `.estado.json`, borrar los datos de los bots en Supabase (contadores, grupos,
amistades, carpetas, registros, días de actividad y avisos de los cinco) y volver a sembrar.
