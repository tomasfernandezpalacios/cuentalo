# Cuéntalo — análisis legal para el lanzamiento (2026-11-17)

> No soy abogado y esto no es asesoramiento jurídico. Es un mapa, hecho sobre el código real de la
> app, de qué normas te afectan, qué riesgo real hay y qué hacer. Antes de publicar conviene que
> alguien con colegiación (o el servicio jurídico gratuito de tu universidad, si lo tiene) revise
> la política de privacidad y las condiciones. Comprueba también el estado de las normas marcadas
> con ⚠️, que estaban cambiando.

## 0. Primero, sobre el miedo a las multas

Lo que se oye («multas de 20 millones») son los **máximos** del RGPD, pensados para empresas
grandes. La realidad para un proyecto como el tuyo:

- **Las multas tienen que ser proporcionadas** (art. 83 RGPD): se mira el tamaño, la intención,
  el daño, si cooperas y si corriges. A una persona física sin ánimo de lucro que actúa de buena
  fe, la AEPD a menudo le impone un **apercibimiento** (un aviso, sin dinero) o una multa
  pequeña.
- **Casi todo empieza por una reclamación** de un usuario. Antes de abrir un procedimiento, la
  AEPD suele **trasladarte la reclamación** y darte un mes para responder y arreglarlo
  (art. 65.4 LOPDGDD). Si lo arreglas y lo explicas bien, muchas se archivan ahí.
- Si llega una multa, pagar voluntariamente y reconocer la responsabilidad la reduce un 20 % + 20 %
  (art. 85 Ley 39/2015).
- Lo que de verdad multa la AEPD a pequeños son cosas concretas y evitables: **no tener política
  de privacidad o que mienta**, no atender una petición de borrado/acceso, **publicar datos de
  otros**, mandar publicidad sin permiso, cookies/anuncios sin consentimiento y **brechas de
  seguridad por descuido**.

Tu app ya tiene a favor cosas que muchas apps grandes no tenían al lanzar: datos en la UE,
RLS en todas las tablas, borrado de cuenta dentro de la app, exportación, una auditoría de
seguridad hecha y sin anuncios ni analítica de terceros. El riesgo es **gestionable** si cierras
la lista de la sección 9 antes de publicar.

---

## 1. Qué datos trata Cuéntalo (según el código)

| Dato | Dónde | Quién lo ve |
| --- | --- | --- |
| Email y contraseña (hash) | Supabase Auth | Solo tú |
| Nombre, @usuario, emoticono o foto de perfil | `profiles`, bucket `profile-photos` | **Cualquier usuario con sesión** (y buscable) |
| Fecha de nacimiento | `profile_private` | Solo tú |
| Zona horaria | `profiles.time_zone` | Servidor |
| Contadores, registros, notas, carpetas, rachas | `counters`, `entries`, `user_activity_days`… | Tú; amigos (totales, por defecto); miembros del grupo (registros) |
| Amistades, grupos, avisos | `friendships`, `group_members`, `notifications` | Las partes implicadas |
| Fotos de grupo y de contador | buckets privados | Miembros / amigos según el caso |
| Resumen (hash) de **tu** teléfono | `phone_directory` | Servidor (para sugerencias) |
| Resúmenes de los teléfonos **de tu agenda** | `contact_lookups` | Servidor (cupo diario) |
| Intentos de inicio de sesión | `login_attempts` | Servidor |

Alojamiento: Supabase, región **eu-west-1 (Irlanda)**. Sin anuncios, sin analítica, sin
notificaciones push (solo locales).

---

## 2. RGPD y LOPDGDD (protección de datos) — lo más importante

### 2.1 Quién eres legalmente

Eres el **responsable del tratamiento** como persona física. Supabase (y el proveedor de correo
que uses) son **encargados del tratamiento**. Tu nombre y un email de contacto tienen que
aparecer en la política de privacidad. No necesitas Delegado de Protección de Datos (no tratas a
gran escala como actividad principal).

### 2.2 Bases legales (art. 6)

- **Ejecución del contrato** (6.1.b): cuenta, contadores, amigos, grupos, clasificaciones. Es lo
  que el usuario pide al registrarse; no hace falta pedir «consentimiento» para cada cosa.
- **Consentimiento** (6.1.a): sincronizar el teléfono y leer la agenda, fecha de nacimiento
  (Resumen vital), foto. Ya son voluntarios; la clave es explicarlo justo antes (ya pides permiso
  de contactos) y que se pueda retirar (ya hay «Quitar»).
- **Interés legítimo** (6.1.f): `login_attempts` (seguridad), límites de uso.

### 2.3 Transparencia: la política de privacidad (arts. 13 y 14) — **obligatoria**

Hoy no existe (auditoría A-031). Es el fallo más fácil de denunciar y el más fácil de arreglar.
Debe decir, en lenguaje claro: quién eres y cómo contactarte, qué datos, para qué, base legal,
quién los ve, encargados (Supabase, Irlanda; correo), transferencias fuera de la UE (Supabase
Inc. es de EE. UU.: cubierto por su DPA con cláusulas contractuales tipo / Data Privacy
Framework), **cuánto tiempo** se guardan, derechos y cómo ejercerlos, derecho a reclamar ante la
AEPD, edad mínima y lo de los contactos. Tiene que estar en una **URL pública** (las tiendas la
piden) y enlazada en el registro y en Configuración.

### 2.4 Los contactos de la agenda — **el punto más delicado**

- Un SHA-256 de 9 cifras con un prefijo fijo que va dentro de la app **no es anónimo**: solo hay
  10⁹ números posibles y un ordenador los prueba todos en minutos. Legalmente es un **dato
  personal seudonimizado** de **terceros que no usan tu app** y no te han dado permiso
  (art. 14). WhatsApp y otros han recibido sanciones precisamente por esto.
- Lo que tienes ya está bien encaminado (solo con permiso, sin guardar la agenda en claro). Pero
  hay un **fallo concreto**: `contact_lookups` guarda los resúmenes de la agenda con tu
  `user_id` y solo se borran **la próxima vez que ese usuario busca sugerencias**
  (`schema.sql:3204`). Si no vuelve a buscar, se quedan para siempre: una lista de «a quién
  conoce cada usuario», incluidos no usuarios.
- **Arreglo recomendado:** borrar a diario todo lo de días anteriores (tarea programada con
  `pg_cron`) o no guardar los resúmenes, solo un contador de cuántos se han consultado hoy; y no
  guardar nunca resúmenes que no coincidan con nadie. Explicarlo en la política («los números de
  tu agenda se comparan en el servidor y no se guardan»).
- Mantener lo de que el **número no se verifica** en la política (alguien podría poner uno
  ajeno), o quitar la sincronización en la V1 si quieres el riesgo mínimo.

### 2.5 Datos de salud (art. 9) ⚠️

Los contadores son libres: «cigarros», «días sin fumar», «cervezas», «pastillas»… Eso puede
revelar datos de salud, que son **categoría especial**. La app no los busca ni los clasifica, lo
que rebaja mucho el riesgo, pero conviene:

- No anunciar la app como herramienta de salud (ni en la ficha ni en TikTok: «deja de fumar con
  Cuéntalo» sí te mete en ese terreno).
- No proponer plantillas o sugerencias de contadores de salud.
- Decir en la política que el usuario decide qué registra y que lo que ponga como «Privado» no lo
  ve nadie.

### 2.6 Privacidad por defecto (art. 25)

Por defecto: contadores en «Privado y amigos» (`hidden_from_friends = false`), racha visible a
amigos, totales visibles y perfil (nombre, foto) visible y buscable por cualquier usuario. Es
defendible (los amigos los eliges tú y es la esencia social de la app), pero la AEPD mira esto.
Recomendación barata: que el formulario deje claro quién lo verá antes de crear el contador (ya
lo hace) y explicarlo en el tutorial o la política. Si quieres ir sobre seguro: «Privado» por
defecto.

### 2.7 Menores — **obligatorio decidir**

- En España, la edad para consentir el tratamiento de datos es **14 años** (art. 7 LOPDGDD).
  ⚠️ Hay un proyecto de ley orgánica de protección de menores en entornos digitales que la sube a
  **16**; comprueba si ya está aprobado antes de publicar.
- Hoy el registro **no pregunta la edad ni pide aceptar condiciones**. Hay que añadir al menos
  una casilla «Tengo 14 años o más (o la edad que toque) y acepto las Condiciones y la Política
  de privacidad». Pedir la fecha de nacimiento es mejor, y ya tienes `BirthDatePicker`.
- Con funciones sociales con desconocidos (buscador de usuarios, solicitudes de amistad), la
  edad mínima es también lo que te pedirán las tiendas en el cuestionario de clasificación.

### 2.8 Derechos de los usuarios

Ya tienes **supresión** (Eliminar cuenta) y parte de **portabilidad** (Exportar, solo
registros; A-019). Para el resto (acceso completo, rectificación, oposición) basta con un email
de contacto y **contestar en menos de un mes**. No contestar es de las causas más típicas de
sanción.

### 2.9 Documentación interna

- **Registro de actividades de tratamiento** (art. 30): la excepción para pequeños no se aplica
  si el tratamiento es habitual, así que haz uno sencillo (una tabla: tratamiento, datos,
  finalidad, base, plazo, encargados, medidas). Media página.
- **Evaluación de impacto (EIPD, art. 35)** ⚠️: la AEPD la exige cuando se juntan dos o más
  criterios de su lista (por ejemplo, posibles menores, cruce de datos de contactos, datos
  posiblemente sensibles). Es probable que te toque una **sencilla**. Las herramientas gratuitas
  de la AEPD («Gestiona EIPD», «Facilita») ayudan. Es papeleo, no cuesta dinero.
- **Contrato de encargado con Supabase** (art. 28): Supabase ofrece un DPA que se firma desde el
  panel. Hazlo y guarda la copia. Lo mismo con el SMTP que elijas.
- **Plazos de conservación**: decide y escríbelos (p. ej., cuentas borradas: al momento;
  `login_attempts`: 30 días; avisos: ya limitados a 50; `contact_lookups`: 24 h).

### 2.10 Seguridad y brechas (arts. 32–34)

Tu nivel es bueno (RLS, funciones `SECURITY DEFINER` revisadas, PKCE, buckets privados). Lo que
falta: un procedimiento mínimo de brechas. Si se filtran datos, tienes **72 horas** para
notificarlo a la AEPD (formulario en su sede electrónica) y, si el riesgo es alto, avisar a los
usuarios. Ten una nota con los pasos, y nunca la `service_role` en la app (ya cumplido).

---

## 3. LSSI-CE (Ley 34/2002)

- **Aviso legal** (art. 10): nombre, un domicilio o forma de contacto, email y NIF. Si la app es
  gratis y sin ingresos, es discutible que seas «prestador» a efectos de la LSSI, pero cuesta
  cero ponerlo en la misma web que la política. ⚠️ Ojo: publica un domicilio solo si quieres;
  ver lo de «comerciante» en la sección 5.
- **Cookies / almacenamiento en el dispositivo** (art. 22.2): SecureStore y AsyncStorage solo
  guardan lo técnicamente necesario (sesión, ajustes, cola sin conexión) → **exentos**, no hace
  falta banner. Cambia en cuanto metas analítica o anuncios.
- **Comunicaciones comerciales** (art. 21): no mandes emails de novedades sin consentimiento
  expreso. Los de recuperar contraseña o confirmar cuenta son transaccionales y no cuentan.

---

## 4. Ley de Servicios Digitales (DSA, Reglamento UE 2022/2065)

Los usuarios suben contenido que ven otros (nombres, fotos de perfil, de grupo y de contador,
nombres de contadores). Eso te convierte en **servicio de alojamiento**; como el perfil es
visible para cualquiera, probablemente en **plataforma en línea**. Las obligaciones pesadas de
plataformas **no se aplican a microempresas**, pero sí las básicas:

- Un **punto de contacto** electrónico para usuarios y autoridades (un email basta).
- **Condiciones de uso** que digan qué contenido no se permite y cómo moderas.
- **Mecanismo de notificación**: que cualquiera pueda denunciar contenido ilegal (botón o email).
- Si quitas contenido o cierras una cuenta, decirle al afectado por qué.

---

## 5. Requisitos de las tiendas (lo que de verdad bloquea la publicación)

**Apple App Store**

- URL de política de privacidad y «etiquetas de privacidad» (qué datos recoges).
- **Contenido generado por usuarios (guía 1.2):** exige poder **denunciar** contenido, **bloquear**
  a usuarios abusivos, filtrar lo ofensivo y un contacto publicado. Hoy no hay bloquear ni
  denunciar: **es casi seguro que te lo rechacen sin ello**.
- Borrado de cuenta dentro de la app (5.1.1(v)): ✅ ya lo tienes.
- **Estado de comerciante (DSA):** Apple te pregunta si eres «trader». Si dices que sí, publica
  tu dirección y teléfono en la ficha. Si la app es gratis y sin ánimo de lucro puedes declararte
  no comerciante; si luego monetizas, cambia.
- Cuenta de desarrollador: 99 $/año.

**Google Play**

- Política de privacidad, formulario de **Seguridad de los datos** y **URL web para pedir el
  borrado de cuenta** (además del botón en la app).
- Cuentas personales nuevas: prueba cerrada con al menos 12 probadores durante 14 días antes de
  poder publicar en producción.
- Permiso de contactos: Google revisa que se justifique y que haya aviso destacado antes de
  pedirlo.
- Cuenta de desarrollador: 25 $ una vez. Si monetizas, Google muestra tu dirección.

---

## 6. Condiciones de uso (contrato con el usuario)

No son estrictamente obligatorias para una app gratuita, pero las necesitas para lo anterior
(DSA, tiendas, edad mínima) y para protegerte:

- Edad mínima, normas de conducta, qué pasa con el contenido que suben (te dan licencia para
  mostrarlo, ellos siguen siendo los dueños), que puedes suspender cuentas, que el servicio se da
  «tal cual» y puede cambiar o cerrar con aviso.
- Con consumidores **no puedes excluir toda tu responsabilidad** (Ley General de Consumidores):
  limítala a lo razonable, sin cláusulas abusivas.
- Ley aplicable: española; los consumidores pueden demandar en su domicilio.

---

## 7. Propiedad intelectual y marca

- **Nombre «Cuéntalo»:** es una palabra común y puede haber marcas registradas parecidas en
  apps o software (clases 9 y 42). Busca en el Localizador de la OEPM y en TMview (EUIPO)
  **antes** de invertir en marca y TikTok (@kuentio). Registrar una marca española cuesta del
  orden de 125–150 € por clase; no es obligatorio, pero protege.
- **Fuentes:** Instrument Serif, Fraunces, Plus Jakarta Sans, Bricolage, Newsreader, DM Serif/Sans
  y Redaction son **OFL** → se pueden incluir en apps comerciales. ✅
- **Librerías de código abierto** (MIT, Apache…): piden incluir sus avisos de licencia. Una
  pantalla «Licencias» en Configuración → Información lo resuelve.
- **Vídeos de TikTok:** no enseñes datos reales de usuarios; música con licencia de la propia
  plataforma; si pagas a creadores, la publicidad debe identificarse como tal.

---

## 8. Impuestos, autónomos y responsabilidad

- **Gratis y sin ingresos:** no tienes que darte de alta en nada.
- **Si algún día cobras** (compras dentro de la app, anuncios, suscripción): alta en Hacienda
  (modelo 036/037) y, con habitualidad, en autónomos (RETA). «No hace falta si ganas menos del
  salario mínimo» es una idea muy extendida pero **no es una regla legal segura**; consúltalo
  entonces. El IVA de las ventas en tiendas lo gestionan Apple y Google en la UE.
- **Anuncios = el mayor foco de multas en apps** (consentimiento de cookies/identificadores con
  una plataforma TCF). Recomendación: lanzar **sin anuncios**.
- Como persona física respondes con tu patrimonio. Para una app gratuita sin ingresos el riesgo
  económico real es bajo; si crece o monetizas, valora una SL.
- **Accesibilidad (Ley 11/2023):** las apps de este tipo y las microempresas quedan fuera en lo
  obligatorio. Lo que ya tienes (etiquetas, contraste AA) es buena práctica.

---

## 9. Lista para lanzar

### Bloqueantes (antes de publicar)

> Hecho el 2026-11-17: 1–5 (falta rellenar los datos del titular en `web/` y activar GitHub
> Pages). Pendientes: 6 (DPA), 7 (web de borrado), 8 y 9 (el usuario los hará más tarde).

1. **Política de privacidad** pública (web) y enlazada en el registro y en Configuración.
2. **Condiciones de uso** + **aviso legal** en la misma web.
3. **Registro:** edad mínima (14 o 16 ⚠️) y casilla de aceptar condiciones y política.
4. **Denunciar y bloquear** usuarios y contenido (exigencia de Apple y de la DSA) + email de
   contacto.
5. **`contact_lookups`:** borrado diario automático o no guardar resúmenes de terceros.
6. **DPA con Supabase** firmado (y con el SMTP).
7. **URL web de borrado de cuenta** (Google Play).
8. Reactivar la **confirmación de email** y configurar un **SMTP propio** (ya anotado para la
   Fase 6).
9. **Borrar las cuentas de prueba** (bots Lucía, Marcos…) de la base de datos de producción o
   usar un proyecto aparte: no deben aparecer como personas reales a usuarios reales.

### Muy recomendables

10. Registro de actividades de tratamiento y EIPD sencilla (herramientas gratuitas de la AEPD).
11. Plazos de conservación definidos y limpieza de `login_attempts`.
12. Procedimiento de brechas (una nota de 72 h).
13. Pantalla de licencias de código abierto.
14. Búsqueda de marca «Cuéntalo» en OEPM / EUIPO.
15. No presentar la app como herramienta de salud.

### Solo si cambias el modelo

16. Ingresos → Hacienda, quizá autónomos, estado de comerciante en Apple.
17. Anuncios o analítica → consentimiento (CMP) y actualizar política y fichas.
18. Push remotas → nuevo encargado (Expo/Apple/Google) en la política.
