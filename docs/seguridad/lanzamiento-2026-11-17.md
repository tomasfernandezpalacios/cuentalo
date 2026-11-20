# Seguridad y privacidad para el lanzamiento — 2026-11-17

Análisis hecho sobre la **base de datos real** (proyecto `uucmxpwevggzvdgnoxbh`, región
`eu-west-1`, Irlanda), los asesores de seguridad de Supabase, las políticas de Storage, el código
de la app y la auditoría anterior (`docs/auditoria/2026-11-14.md`). Cada punto dice si está
**comprobado** (lo he visto en la BD o en el código) o es una **recomendación**.

Leyenda: 🔴 bloquea el lanzamiento · 🟠 arreglar antes o justo después · 🟢 recomendable.

---

## 1. Lo que ya está bien (comprobado)

No hace falta tocarlo, pero conviene saber por qué es seguro:

- **RLS activada en todas las tablas** de `public` (ninguna sin RLS).
- **`anon` (sin sesión) no puede leer ni escribir ninguna tabla.** Solo puede llamar a 5
  funciones: `is_username_available`, `login_email_for_username`, `my_time_zone`,
  `normalize_invite_code` y `group_id_from_path` (las tres últimas no devuelven datos).
- **Todas las funciones SECURITY DEFINER fijan `search_path`** (evita que alguien las engañe
  creando objetos con el mismo nombre). Solo `my_time_zone` (INVOKER) no lo fija.
- **`entries` está cerrada**: la app solo puede cambiar `amount`, `logged_at` y `note` de lo suyo,
  y el resto pasa por funciones (A-003 corregido).
- **Storage**: los tres buckets son **privados**, con límite de 2 MB y solo JPEG/PNG/WebP; todas
  las políticas son para `authenticated` y comprueban la carpeta (`<id>/…`).
- **Recuperar contraseña con PKCE** (A-002 corregido): un enlace fabricado ya no mete a nadie en
  otra cuenta.
- **Sesión en SecureStore** (Keychain / Keystore cifrados), `detectSessionInUrl: false`.
- **Ningún secreto en Git**: solo `.env.example`; no aparece `service_role` ni `sb_secret_` en
  el código ni en el historial. Las contraseñas de los bots están en un archivo ignorado.
- **Sin `console.log`** en `src/` ni `app/` (no se filtran tokens a los registros del móvil).
- **Eliminar cuenta** borra `auth.users` en cascada y antes las fotos de Storage.
- **Región UE** (Irlanda): los datos no salen de la UE, lo que simplifica mucho el RGPD.
- `npm audit`: 24 avisos *moderados*, todos en `node-forge` dentro de `@expo/cli` (herramienta de
  compilación, **no va dentro de la app**). No afecta a los usuarios.

---

## 2. 🔴 Bloqueantes antes de publicar

### 2.1 Cuentas: confirmación de email, contraseñas y correo

- **Confirmación de email desactivada** (comprobado en CLAUDE.md). Sin ella, cualquiera crea una
  cuenta con el email de otra persona, y con el nombre de usuario puede suplantarla.
  → Supabase → Authentication → Sign In / Providers → *Confirm email*: **activar**.
- **Contraseña mínima de 6 caracteres** (`src/lib/validation.ts:12`). Hoy es poco.
  → Subir a **8** en la app y en Supabase (Authentication → Policies → *Minimum password
  length*), y exigir letras y números.
- **Protección de contraseñas filtradas desactivada** (lo marca el asesor). Comprueba la contraseña
  contra HaveIBeenPwned. Ojo: en Supabase solo está en el **plan Pro** (cuesta dinero; decides tú).
- **Correo integrado de Supabase**: manda muy pocos correos por hora y desde un remitente
  genérico (acaba en spam). Con la confirmación activada, si se registran 10 personas a la vez
  la mayoría no recibe el correo. → **SMTP propio** (Resend, Brevo, Amazon SES…; muchos tienen
  plan gratis) con un dominio tuyo y SPF/DKIM configurados.

### 2.2 Entrar con nombre de usuario (`login_email_for_username`) — A-014, sigue abierto

Comprobado en la definición actual:

- La puede llamar **cualquiera sin sesión** y comprueba la contraseña con bcrypt **dentro de la
  base de datos**. Eso se salta el límite de intentos por IP de Supabase Auth.
- El bloqueo es **por nombre de usuario** (10 fallos en 15 min). Un atacante saca la lista de
  nombres con `is_username_available` (también abierta) y prueba «123456» contra todos: nunca
  llega al límite (*password spraying*).
- Cada intento contra un usuario que existe gasta CPU de bcrypt en tu BD (posible DoS en el plan
  gratuito).
- Cualquiera puede bloquear a otra persona su entrada por nombre de usuario haciendo 10 fallos.
- Inserta en `login_attempts` lo que se escriba, sin validar formato ni longitud.

Opciones (de más a menos segura):
1. **Quitar el inicio de sesión con nombre de usuario** y dejar solo email (lo más simple y
   seguro; muchas apps lo hacen).
2. Moverlo a una **Edge Function** con límite por IP + límite global, que use
   `signInWithPassword` de Supabase (así cuentan los límites de Auth) en vez de bcrypt en SQL.
3. Mínimo: validar `^[a-z0-9_]{3,20}$` antes de insertar, tope **global** de fallos por minuto y
   no insertar si el usuario no existe.

### 2.3 Política de privacidad, términos y el texto de la app

- **No hay política de privacidad** y las dos tiendas la exigen (URL pública).
- El texto de Configuración → «Privacidad y datos» (`app/configuracion/privacidad.tsx`) es
  **incorrecto**: dice que del móvil «no se envía nada a ningún sitio», pero se envían los
  resúmenes de la agenda; y no menciona fecha de nacimiento, teléfono, fotos de perfil y de
  contadores, zona horaria ni que tu nombre queda en los avisos de otros (`actor_name`).
- Faltan **términos de uso** (normas de conducta, edad mínima, que puedes cerrar cuentas). Apple
  los pide para apps con contenido de usuarios (ver 2.5).

Lo que debe decir la política (RGPD + LOPDGDD):
- **Responsable**: tú (nombre y un email de contacto; mejor un email solo para esto).
- **Qué datos**: email, nombre, @usuario, foto/emoticono, fecha de nacimiento (opcional),
  resumen del teléfono (opcional), resúmenes de la agenda (opcional, ver 2.4), contadores,
  registros, notas, amistades, grupos, zona horaria, avisos.
- **Para qué y base legal**: prestar el servicio (contrato, art. 6.1.b); agenda y teléfono por
  **consentimiento** (6.1.a), que se puede retirar.
- **Datos que pueden ser sensibles**: los usuarios ponen el nombre que quieren a los contadores
  («días sin fumar», «pastillas», «copas»…). Eso puede revelar datos de **salud** (art. 9).
  Dilo: que son privados por defecto, que tú no los miras ni los usas para nada más, sin
  publicidad ni venta de datos.
- **Encargados**: Supabase (base de datos y Storage, UE). Firma el **DPA de Supabase** (se
  descarga desde el panel: Organization → Legal Documents). Si añades SMTP, también ese
  proveedor.
- **Conservación**: mientras exista la cuenta; avisos máx. 50; intentos de acceso 1 día;
  copias de seguridad de Supabase (dilo: se borran solas en X días).
- **Derechos**: acceso, rectificación, supresión, portabilidad, oposición; cómo pedirlos; y que
  pueden reclamar ante la **AEPD**.
- **Edad mínima**: en España, **14 años** para consentir solo (art. 7 LOPDGDD). Ponlo en los
  términos y una casilla «Tengo 14 años o más y acepto los términos y la política» en el
  registro (guardar fecha de aceptación y versión).

### 2.4 Contactos y teléfono

Comprobado: el teléfono se guarda como `SHA-256('cuentalo:' + 9 cifras)` y la agenda se envía
como resúmenes iguales; `contact_lookups` guarda **qué resúmenes consultó cada usuario y qué día**.

- **El resumen no anonimiza**: solo hay ~10⁹ números de 9 cifras y la sal está en la app; un
  ordenador normal los calcula todos en segundos. Para el RGPD son **datos personales**
  (seudonimizados), también los de **contactos que no usan la app** (terceros que no han dado
  permiso). No digas «anónimo» en ningún texto.
- El cupo de 3000 al día ya existe (A-001 corregido), bien.
- **Google Play exige una «divulgación destacada»** propia (una pantalla tuya, antes del permiso
  del sistema) que explique qué se lee de la agenda, para qué y que se envía al servidor, con
  botón de aceptar. Si no, rechazan la app. Apple pide algo parecido (guía 5.1.1).
- Recomendado:
  - **Borrar `contact_lookups` a diario** (solo hace falta el recuento del día, no los
    resúmenes): guarda `(user_id, day, n)` en vez de cada resumen.
  - Valorar **coincidencia mutua** (solo sugerir si los dos se tienen en la agenda).
  - El número no se verifica (alguien puede poner el de otro). Dilo en la política o no
    enseñes el teléfono como motivo de la sugerencia.

### 2.5 Requisitos de las tiendas sobre contenido de usuarios

Hay contenido que pone un usuario y ven otros: nombres, @usuario, fotos de perfil (las ve
**cualquier usuario con sesión**), nombres y fotos de grupos y contadores, notas.

- **Apple, guía 1.2** (obligatorio con contenido de usuarios): mecanismo para **denunciar**
  contenido o usuarios, para **bloquear** a un usuario, un método para filtrar lo inapropiado y
  respuesta a denuncias en 24 h. Hoy **no hay ni denunciar ni bloquear** → rechazo casi seguro.
  - Mínimo viable: tabla `reports` (quién, a quién, motivo) + botón «Denunciar» en el perfil de
    otro y en el grupo; tabla `blocks` que impida solicitudes de amistad, invitaciones y
    sugerencias entre los dos; y te llega un aviso (un email) para revisarlas.
- **Google Play**: formulario **Data safety** (declarar cada dato, que va cifrado en tránsito y que
  se puede borrar) y **URL web para pedir el borrado de la cuenta** (además del botón de la
  app). Basta una página sencilla con instrucciones y un email.
- **Apple**: etiquetas de privacidad («App Privacy») coherentes con la política; borrado de
  cuenta dentro de la app (✅ ya está); en `app.json`, `ios.config.usesNonExemptEncryption: false`
  (solo usas HTTPS) para no tener que contestarlo en cada envío.

### 2.6 Separar pruebas y producción

- Los **bots** (`prueba1…5`, Lucía, Marcos…) viven en la **misma base de datos** que usarán tus
  usuarios, y la tarea de Windows «Cuentalo bots» los ejecuta cada noche. En producción
  aparecerían en búsquedas y sugerencias de amigos de gente real.
- → Antes de lanzar: o un **segundo proyecto de Supabase** para pruebas (el plan gratis permite 2)
  con su propio `.env`, o desactivar la tarea y `npm run bots:limpiar`.

---

## 3. 🟠 Importantes (antes o justo después del lanzamiento)

| # | Qué | Estado | Arreglo |
|---|-----|--------|---------|
| 3.1 | **`are_friends(a, b)`**: cualquiera con sesión puede preguntar si dos personas cualesquiera son amigas (A-018). | Comprobado: existe, es DEFINER y la usa la política de invitar de `group_members`. | Sustituirla por `is_my_friend(p_other)` con `auth.uid()` y revocar EXECUTE de la vieja. |
| 3.2 | **Todos los perfiles se pueden descargar**: la política de `profiles` es `true` y deja leer `time_zone` (ubicación aproximada), `hide_streak`, `hide_counter_totals`, `group_invites`, `tutorial_done` (A-043). Con una cuenta, un script baja todos los usuarios y fotos. | Comprobado. | Quitar el SELECT de `time_zone` y ajustes (moverlos a `profile_private`). Mejor aún: buscar usuarios solo por una RPC con límite de resultados, sin SELECT libre de la tabla. |
| 3.3 | **Fechas futuras en `entries.logged_at`** (A-029): sirven para inflar rachas y clasificaciones. | Comprobado: no hay CHECK. | `CHECK (logged_at <= now() + interval '1 day')` o comprobarlo en las funciones. Topes también para arrays de `profile_private` y `counter_requests` pendientes. |
| 3.4 | **Privilegios por defecto**: cada tabla nueva da a `anon` *todos* los permisos y cada función nueva EXECUTE a `anon` (A-039). Un olvido en una migración futura = tabla abierta. | Comprobado en `pg_default_acl`. | `alter default privileges in schema public revoke all on tables/functions from anon, authenticated;` y apuntarlo en el README de `migrations/`. Fijar `search_path` de `my_time_zone`. |
| 3.5 | **Exportar mis datos**: solo exporta registros (el RGPD pide *todos* los datos: perfil, amistades, grupos, carpetas, fecha de nacimiento…); se comparte como texto (falla con historiales grandes); y **no neutraliza fórmulas**: un contador de grupo llamado `=HYPERLINK(...)` por otro miembro se ejecuta al abrir el CSV en Excel. | Comprobado en `src/lib/csv.ts`. | Exportar un **JSON** (o ZIP con CSV) a archivo con `expo-file-system`; en CSV, anteponer `'` a celdas que empiecen por `= + - @`. |
| 3.6 | **Spam y acoso**: cualquiera puede mandar solicitudes de amistad sin límite a cualquiera (la política solo exige ser el remitente); las solicitudes de contador tampoco tienen tope. | Comprobado. | Tope de solicitudes pendientes por usuario (p. ej. 50) y por día; junto con el **bloqueo** de 2.5. |
| 3.7 | **Metadatos de las fotos (EXIF/GPS)**: las fotos del selector se suben tal cual las da `expo-image-picker` (recortadas y con calidad 0,6). Casi siempre eso quita el EXIF, pero no está garantizado en todos los Android. Una foto con GPS revelaría dónde vive alguien. | Probable, sin comprobar. | Pasar **siempre** la imagen por `ImageManipulator` (512 px, JPEG) antes de subir, como ya hace el editor. Y probar: subir una foto con GPS y mirarla. |
| 3.8 | **Copias de seguridad**: en el plan gratis no hay copias que puedas restaurar tú, y el proyecto **se pausa** tras 7 días sin uso. Un `DELETE` equivocado = datos perdidos. | Recomendación. | Plan Pro al lanzar (copias diarias 7 días), o como mínimo un `pg_dump` programado. Cuesta dinero: decides tú. |

---

## 4. 🟢 Recomendables

- **2FA en todo lo que controla la app**: cuenta de Supabase, GitHub, Expo/EAS, Apple Developer,
  Google Play Console y el email de todas ellas. Quien entra ahí lo controla todo.
- **Repositorio privado** mientras haya fallos abiertos: `docs/auditoria/` y este informe
  explican cómo atacar la app. (No he podido comprobar si el repositorio es público.)
- **CAPTCHA en registro y login** (Supabase → Auth → Bot and Abuse Protection, con Cloudflare
  Turnstile, gratis). En React Native necesita un WebView; útil si empiezan a crear cuentas
  falsas.
- **Límite de peticiones** en general: PostgREST no limita por usuario. Vigila el uso en el panel
  y, si alguien abusa, limita en las funciones más caras (`get_friend_suggestions`,
  `log_to_counter`, clasificaciones).
- **Cerrar sesión** usa `scope: 'local'`: el token de refresco sigue valiendo en el servidor.
  Para «cerrar sesión en todos los dispositivos» (útil si te roban el móvil) añade un botón con
  `scope: 'global'`.
- **Códigos de grupo**: 8 caracteres de 31 símbolos (~8,5·10¹¹): adivinarlos por fuerza bruta no
  es realista, pero `join_group_by_code` no tiene límite de intentos. Un tope de 20 fallos por
  hora por usuario lo cierra del todo.
- **Si añades `expo-updates`** (actualizaciones OTA): activa la **firma de código** de EAS
  Update, si no, quien consiga tus credenciales de Expo podría mandar código a todos los móviles.
- **`privacidad.sql`**: ampliarlo con lo nuevo (contactos, fotos de contador, login por usuario,
  bloqueos y denuncias cuando existan) y pasarlo antes de cada lanzamiento (A-033).
- **Asesores de Supabase**: repasarlos tras cada migración. Hoy los avisos «authenticated puede
  ejecutar función DEFINER» (40) son **esperados** (son tu API) y los «RLS sin políticas» de
  `contact_lookups` y `login_attempts` también (son tablas solo para funciones).
- **Clave publicable**: es pública por diseño (va dentro de la app); la seguridad está en la RLS,
  no en ocultarla. Lo que nunca debe salir es la `sb_secret_…` / `service_role`.
- **Registro de actividades de tratamiento** (RGPD art. 30): una hoja sencilla con qué datos,
  para qué, cuánto tiempo y quién los trata. Al ser pocos usuarios no es estrictamente
  obligatorio, pero con datos posiblemente de salud es buena idea tenerlo.
- **Plan ante una brecha**: si se filtran datos, hay **72 h** para avisar a la AEPD. Apúntate
  qué harías: rotar claves en Supabase, cerrar sesiones (`auth.sessions`), avisar a usuarios.

---

## 5. Lista para el día del lanzamiento

Cuentas y Supabase
- [ ] Confirmación de email activada
- [ ] Contraseña mínima 8 (app y Supabase)
- [ ] SMTP propio con dominio, SPF y DKIM
- [ ] Redirect URLs solo `cuentalo://**` (quitar `exp://**` en producción)
- [ ] Login por nombre de usuario quitado o protegido (2.2)
- [ ] Bots fuera de la BD de producción y tarea de Windows desactivada
- [ ] DPA de Supabase firmado
- [ ] Decidido: plan Pro (copias + contraseñas filtradas) o `pg_dump` propio
- [ ] 2FA en Supabase, GitHub, Expo, Apple y Google

Base de datos
- [ ] `are_friends` sustituida (3.1)
- [ ] `profiles` sin zona horaria ni ajustes visibles (3.2)
- [ ] CHECK de fechas futuras y topes (3.3)
- [ ] Privilegios por defecto revocados (3.4)
- [ ] Tablas y funciones de bloqueo y denuncia (2.5)
- [ ] `contact_lookups` sin guardar resúmenes (2.4)
- [ ] `privacidad.sql` ampliado y pasado

App
- [ ] Pantalla de divulgación antes de pedir los contactos
- [ ] Casilla de términos, política y edad ≥ 14 en el registro
- [ ] «Denunciar» y «Bloquear» en perfil de otros y grupos
- [ ] Texto de «Privacidad y datos» corregido y enlace a la política
- [ ] Exportar todos los datos a archivo, sin fórmulas (3.5)
- [ ] Fotos siempre por `ImageManipulator` antes de subir (3.7)
- [ ] `usesNonExemptEncryption: false` en `app.json`
- [ ] Quitar el botón temporal «Probar animación de racha»

Documentos y tiendas
- [ ] Política de privacidad publicada (URL)
- [ ] Términos de uso publicados
- [ ] Página web para pedir el borrado de la cuenta (Google Play)
- [ ] Data safety (Google) y App Privacy (Apple) rellenados igual que la política
- [ ] Email de contacto para privacidad y denuncias
