# Bots de prueba

Cinco usuarios reales (`prueba1` … `prueba5`) que usan Cuéntalo como lo haría una persona, cada
uno a su manera, y apuntan los fallos e incoherencias que encuentran.

| Bot     | Cómo usa la app                                                                       |
| ------- | ------------------------------------------------------------------------------------- |
| prueba1 | Constante: pocos contadores, apunta cada día y cuida sus rachas.                      |
| prueba2 | Social: crea grupos, invita a sus amigos y administra contadores comunes.             |
| prueba3 | Caótico: muchos contadores, borra, fusiona, oculta, deshace y resta (hora de México). |
| prueba4 | Ocasional: entra poco, apunta cosas de días pasados y a veces se va (hora de Tokio).  |
| prueba5 | Competitivo: se une con el código, apunta mucho en grupo y mira la clasificación.     |

## Uso

```bash
npm run bots                               # 30 rondas
npm run bots -- --rondas 80 --semilla 7    # más largo y repetible
npm run bots:limpiar                       # borra las cuentas de los bots y todo lo suyo
```

La primera vez se registran (como en la app); después inician sesión y siguen con lo que
tenían, así que ejecutarlo varios días seguidos también prueba las rachas de uso.

Después de jugar, cada bot comprueba que lo que le enseña la app cuadra: totales de la
pantalla principal, que nada quede en negativo, clasificaciones, rachas de contadores en su
zona horaria, racha de uso, que solo ve rachas de amigos y registros que le tocan, que el código
de un grupo es el mismo para todos y que en los comunes todos llevan lo mismo.

## Resultados

- `informes/AAAA-MM-DD-HH-MM.md`: el informe de cada ejecución (hallazgos con lo que hizo el bot
  justo antes, para reproducirlo, y el registro de todas las acciones).
- `hallazgos.md`: la lista acumulada de todas las ejecuciones.

Gravedades: **CRÍTICO** (privacidad), **ERROR** (algo falla o no cuadra), **AVISO** (puede ser
correcto, hay que mirarlo) y **OBSERVACIÓN** (no es un fallo, pero chirría).
