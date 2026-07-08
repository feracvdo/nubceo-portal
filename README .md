# Portal de Implementaciones Nubceo — versión con base de datos

> **Novedades:** el panel del equipo pasó a tener **menú lateral con módulos** — Clientes (alta con razón social/CUITs/comercial de la cuenta/logo/contactos con rol, listado con búsqueda y filtro por implementador/desarrollador), Tablero (Kanban, ahora con **Go-live e Hypercare como columnas separadas**, la fase avanza sola a medida que se completan pasos, pantalla completa para reuniones, y un panel lateral rápido al hacer clic en una tarjeta con comercial/tenant/implementador/desarrollador/fee/estado de pago), Equipo (implementación/desarrollo/finanzas separados) y Mi perfil (foto, nombre, mail, código, calendario personal, API key de Redmine). Nuevo **rol Superadministrador/a** (⭐): es el único que puede eliminar clientes y personas del equipo; el resto crea y edita todo, pero no borra. De rondas anteriores: versión visible en login/nav; relevamiento con validación de campos faltantes resaltados; plazos con 9 hitos reales del proceso; rol Desarrollador y Finanzas; logo real de Nubceo; contacto directo al implementador; sincronización real con Google Calendar; preview tipo planilla para el CSV de ventas; y mails automáticos de plazos. Ver las secciones correspondientes más abajo para la puesta en marcha de cada una.

Portal para acompañar a los clientes durante la implementación del Conciliador, en 8 pasos guiados y secuenciales:

1. **Procesadoras** — el cliente marca cuáles tiene (lista oficial de conectores por país) y el estado de cada una: no conectado / en espera de doc-credenciales / conectado.
2. **Introducción** — explica todos los pasos de la implementación y qué incluye cada uno.
3. **Relevamiento** — obligatorio para avanzar; incluye la carga de involucrados (nombre, cargo, mail, teléfono opcional, con al menos un sponsor y un key user). Al enviarlo, el servidor genera automáticamente el **diagrama de flujo del proceso del cliente** (Mermaid) y lo invita a **agendar el workshop** con la disponibilidad del implementador (mínimo 3 días después del envío, invitando a todos los involucrados).
4. **Sucursales** — el cliente sube su archivo interno (nº de comercio, procesadora, ID de PDV, nombre, empresa/CUIT) y el portal lo convierte al template oficial con `platform_external_code`, validando celdas vacías, PDV repetidos y duplicados; los comercios no identificados van a una sucursal "No identificada". Al terminar, instruye cargar el archivo en Nubceo → Mi negocio → Sucursales cabecera → Crear masivamente. Es el único paso omitible, con alerta persistente.
5. **Conexión API / CSV** — API: credenciales sandbox, documentación oficial y agendador de reunión técnica (Eduardo André / Santiago Suarez). CSV: validador completo del formato Nubceo (35 columnas, CUIT, fechas, montos, multipago, Smart Fix) adaptado de la app del equipo, con exportación lista para cargar.
6. **Capacitación** — manuales oficiales + solicitud de capacitación de Conciliador o Nubceo Cash con el calendario de Mariana Macri.
7. **Pruebas sandbox** — el equipo carga el status; cuando está "listo para mostrar", el cliente agenda la reunión de resultados y queda la minuta.
8. **Go-live** — mismo circuito de status, reunión de resultados y minuta.

Incluye detección de casos borde en el relevamiento, alta automática en Redmine al primer login, y panel del equipo con superadmins, diagrama, eventos con minutas y status de pruebas.

**Stack:** Next.js (Vercel) + Supabase (PostgreSQL). Todo el acceso a datos pasa por `/api/portal` en el servidor — el navegador nunca toca la base ni ve secretos.

---

## Puesta en marcha (en orden)

### 1. Crear el proyecto en Supabase (~5 min)
1. Entrá a [supabase.com](https://supabase.com) → New project (el plan Free alcanza).
2. En **SQL Editor → New query**, pegá el contenido completo de `supabase/schema.sql` y ejecutalo. Eso crea las tablas, índices, RLS y un cliente demo (`DEMO123`) y una implementadora (`FER-IMPL`).
3. En **Settings → API** copiá dos valores: la **Project URL** y la **service_role key** (la secreta, no la anon).

> **¿Ya tenías el portal andando?** No hace falta recrear la base: corré, en orden, `supabase/migracion-v4.sql`, `migracion-v5.sql`, `migracion-v6.sql`, `migracion-v7.sql` y `migracion-v8.sql` sobre tu proyecto existente (o pedime el script combinado si preferís correr todo de una vez). El v4 agrega el mail de `equipo`, la tabla `calendar_conexiones` y las columnas del evento real de Google en `eventos`. El v5 agrega `plazos_cliente`. El v6 agrega roles de equipo (implementador/desarrollador) y foto, razón social/CUITs/logo/desarrollador asignado del cliente, el evento "workshop_cierre", y libera el check constraint de `plazos_cliente.paso` para los nuevos hitos. El v7 suma el rol Finanzas y los campos financieros del cliente (fee, moneda, costo de implementación, estado de pago, fecha de deuda, notas). El v8 suma `es_superadmin`, el campo "comercial de la cuenta", la API key personal de Redmine, y separa Go-live de Hypercare (el rango de `fase` pasa de 0-6 a 0-7).

### 2. Subir el proyecto a GitHub
```bash
git init && git add . && git commit -m "Portal de implementaciones"
# crear el repo en GitHub y pushear
```

### 3. Sincronización real de Google Calendar (opcional pero recomendado)
1. En [Google Cloud Console](https://console.cloud.google.com) → creá (o reusá) un proyecto → **APIs & Services → Library** → habilitá **Google Calendar API**.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID** → tipo **Web application**.
3. En **Authorized redirect URIs** agregá `https://tu-portal.vercel.app/api/calendar-callback` (con tu dominio real de Vercel).
4. Copiá el **Client ID** y **Client secret** a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`; cargá también `GOOGLE_REDIRECT_URI` con la misma URL del paso anterior.
5. Si el proyecto de Google está en modo "Testing" (OAuth consent screen), agregá como **Test user** el mail de cada responsable que vaya a conectar su calendario (Implementaciones, Eduardo André, Santiago Suarez, Mariana Macri) — o publicá la app si preferís no tener esa limitación.
6. Ya en el portal: entrá como equipo → **Sincronización de calendario** → **Conectar con Google Calendar** para cada responsable. Sin esto, el portal sigue funcionando igual que antes (disponibilidad según la tabla `config` y sin invitaciones reales) — es un upgrade, no un requisito.

### 4. Mails automáticos de plazos (recordatorio + incumplimiento)
1. Creá una cuenta gratis en [resend.com](https://resend.com) (hasta 3.000 mails/mes, sin tarjeta).
2. **API Keys → Create API Key** → copiá el valor a `RESEND_API_KEY`.
3. Remitente (`MAIL_FROM`): mientras no verifiques un dominio propio, usá `Nubceo <onboarding@resend.dev>` (remitente de prueba de Resend, funciona igual). Para que los clientes vean `@nubceo.com`, andá a **resend.com/domains**, agregá el dominio y cargá los registros DNS que te pide — una vez verificado, cambiá `MAIL_FROM` a `Nubceo <notificaciones@nubceo.com>`.
4. `PORTAL_URL`: la URL pública de tu portal (`https://tu-portal.vercel.app`) — se linkea en los mails.
5. `CRON_SECRET`: inventá un string largo cualquiera (por ejemplo, generalo con `openssl rand -hex 32`) y cargalo tal cual en Vercel. Así nadie más puede disparar el envío de mails pegando la URL del cron a mano.
6. El cron ya viene configurado en `vercel.json` para correr todos los días a las 10:00 de Argentina — no hay que tocar nada más; Vercel lo activa solo al detectar ese archivo en el deploy.
7. Ya en el portal: entrá al detalle de un cliente como equipo → **Plazos y recordatorios** → ponele fecha límite a los pasos que quieras controlar. El botón **"Enviar aviso ahora"** sirve para probar sin esperar al cron del día siguiente.

> **Límite del plan gratis de Vercel:** el cron corre 1 vez por día (no se puede programar cada hora). Está pensado así a propósito — si un día no llega a correr por algún motivo, al día siguiente igual manda el aviso que corresponda, no se pierde.

### 5. Desplegar en Vercel (~5 min)
1. En Vercel → **Add New → Project** → importá el repo.
2. En **Environment Variables** cargá (ver `.env.example`):
   - `SUPABASE_URL` — la Project URL de Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY` — la service_role key.
   - `ADMIN_CODE` — el código maestro del equipo (cambiá el default).
   - `REDMINE_URL` y `REDMINE_API_KEY` — cuando devs entregue la key. Sin estos, los tickets quedan en cola con el payload listo (todo lo demás funciona igual).
   - `NUBCEO_KEYGEN_URL` y `NUBCEO_KEYGEN_TOKEN` — opcionales, para consumir el generador real de credenciales de API de Nubceo cuando exista.
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — opcionales, para la sincronización real de calendario (paso 3).
   - `RESEND_API_KEY`, `MAIL_FROM`, `PORTAL_URL`, `CRON_SECRET` — opcionales, para los mails automáticos de plazos (paso 4).
3. Deploy. Listo: `https://tu-portal.vercel.app`.

### 6. Primer uso
1. Entrá con `ADMIN_CODE` → módulo **Equipo** → creá tu usuario personal (con tu nombre, mail y foto).
2. Con `ADMIN_CODE` todavía conectada, en la fila de tu usuario nuevo tocá **"Hacer superadmin"** — así de ahí en más entrás con tu propio código y ya tenés la estrella ⭐ (podés eliminar clientes y personas). El código maestro (`ADMIN_CODE`) queda como acceso de emergencia.
3. Dá de alta un cliente desde el módulo **Clientes**, con su código y su tenant productivo.
4. Al primer login del cliente, el servidor crea en Redmine la Feature de alta + la US de tenant sandbox, y genera sus credenciales de API sandbox.

---

## Decisiones de arquitectura

- **El navegador nunca toca Supabase.** RLS está habilitado sin políticas (deniega todo para la anon key); solo el service role del servidor opera. Cada request a `/api/portal` valida el código de sesión: un cliente solo accede a sus datos; el equipo, a todo.
- **La API key de Redmine vive solo en el servidor** (variable de entorno). Los payloads de los tickets se guardan en `redmine_altas` como cola: si el envío falla, se reintenta desde el detalle del cliente.
- **Relevamiento en JSONB**: agregar o quitar preguntas del formulario no requiere migrar el esquema.
- **Archivos (v1)**: el template de sucursales y el CSV de ventas se guardan en base64 en la tabla `archivos` (límite práctico ~2 MB por el body de la API). **Upgrade recomendado**: mover a Supabase Storage con URLs firmadas — la tabla ya está pensada para eso (el campo `contenido` pasa a guardar el path del bucket).
- **Credenciales de API**: si devs expone un endpoint generador, se configura en `NUBCEO_KEYGEN_URL` (+ `NUBCEO_KEYGEN_TOKEN`) y el portal lo consume; mientras tanto genera placeholders sandbox que se regeneran desde el panel.
- **Agenda de reuniones**: la disponibilidad de cada responsable (implementadores, Eduardo André, Santiago Suarez, Mariana Macri) vive en la tabla `config` (clave `disponibilidad`, franjas por día de semana, editable por SQL) — esa sigue siendo la base cuando el responsable no conectó su calendario. El agendador excluye horarios ya ocupados y para el workshop exige fecha ≥ 3 días después del envío del relevamiento. **Con Google Calendar conectado** (panel del equipo → Sincronización de calendario): los horarios que ve el cliente ya descartan lo que el responsable tiene ocupado en su calendario real, y al confirmar se crea el evento real e invita a cada persona de la lista (editable por el cliente antes de confirmar) — Google les manda la invitación por mail. Sin conectar, el portal sigue funcionando como antes: registra la reunión en el historial, sin invitación real.
- **Contacto con el implementador**: si el implementador/a asignado tiene mail cargado (`equipo.email`), el cliente ve un botón "Contactar a…" en la barra superior que abre un mailto con asunto prellenado.
- **Mails automáticos de plazos**: el equipo le pone fecha límite a cualquiera de los 8 pasos desde el detalle del cliente (`plazos_cliente`, una fila por cliente+paso). Un cron diario (`/api/cron-recordatorios`, ver `vercel.json`) revisa todos los plazos y manda, vía Resend, **un solo recordatorio** el día antes del vencimiento y **un solo aviso de incumplimiento** si se pasó la fecha y el paso sigue sin completar — a todos los involucrados con mail cargado. Los flags `recordatorio_enviado_at`/`incumplimiento_enviado_at` evitan mandarlo dos veces; si el equipo redefine la fecha límite, se resetean para que el plazo nuevo tenga su propio aviso. El botón "Enviar aviso ahora" del panel usa la misma lógica (`lib/avisosPlazos.js`) para poder probar sin esperar al cron.
- **Hitos del calendario (`lib/hitos.js`)**: son más granulares que los 8 pasos del portal del cliente (separan workshop de reunión técnica, suman fin de desarrollo de API y workshop de cierre) y cambian según si el cliente eligió API o CSV en el relevamiento (`hitosPara(respuestas)`). La vinculación de procesadora se da por cumplida con que **una sola** esté en estado "conectado", sin importar cómo estén las demás. El fin del desarrollo de API no tiene una señal automática en la base — se marca a mano desde el panel ("Marcar completo"), guardado en `clientes.api_desarrollo_completo`.
- **Roles del equipo**: `equipo.rol` distingue `implementador`, `desarrollador` y `finanzas`. Un cliente puede tener asignado un implementador y un desarrollador (`clientes.implementador_id` / `clientes.desarrollador_id`) — Finanzas no se asigna por cliente, cualquier persona con ese rol puede cargar los datos financieros de cualquier cliente. **Importante:** no hay control de acceso por rol todavía — cualquier login de equipo (implementador, dev o finanzas) ve y puede editar todo el portal, el rol hoy es solo informativo/organizativo. Restringir el acceso de Finanzas a únicamente los datos financieros (y no al resto de la implementación) es una mejora natural pendiente si hace falta.
- **Datos financieros** (`clientes.fee`, `moneda`, `costo_implementacion`, `estado_pago`, `deuda_desde`, `finanzas_notas`): se cargan y editan desde la card "Información financiera" en el detalle de cada cliente. El estado "Con deuda" se ve como badge rojo en el detalle, en la lista y en el tablero Kanban, con los días transcurridos desde `deuda_desde`.
- **Versión visible**: `APP_VERSION` en `components/PortalApp.jsx` (arriba de `FASES`) se muestra en el login y en la barra superior — conviene subirla a mano en cada deploy que valga la pena que el equipo note (ej. "1.6.0" → "1.7.0"), junto con `APP_VERSION_FECHA`.
- **Permisos**: hoy hay dos niveles nada más. `team` (cualquier código de equipo, cualquier rol) puede ver y editar todo — crear/asignar/editar clientes y personas. `superadmin` (⭐, el código maestro `ADMIN_CODE` siempre lo es; además cualquier fila de `equipo` puede tener `es_superadmin=true`) es el único que puede **eliminar** clientes o personas del equipo, y el único que puede otorgar/quitar la estrella a otra persona. No hay más granularidad que esa — Finanzas, por ejemplo, ve y puede editar todo el portal, no solo lo financiero.
- **Auto-avance de fase**: `faseSugerida()` (`lib/pasos.js`) mira la *racha* de pasos completos desde el principio (no un conteo suelto, para no dar saltos raros si algo se completa fuera de orden) y empuja la fase del cliente hacia adelante cuando corresponde — nunca la hace retroceder sola. El equipo siempre puede pisarla a mano arrastrando la tarjeta en el tablero o desde el selector del detalle.
- **Calendario y Redmine personales (Mi perfil)**: cualquier persona puede conectar su propio Google Calendar (mismo mecanismo que "Sincronización de calendario", pero con su propio nombre como responsable) y guardar su API key personal de Redmine. La key de Redmine queda guardada pero **todavía no está conectada** a la creación de tickets (que sigue usando la key global del servidor) — es un lugar preparado para cuando se sume esa lógica. Lo mismo con Gmail personal: no hay conexión propia todavía, los mails automáticos siguen saliendo por Resend con el remitente general.
- **Validador de CSV**: lógica portada de la app interna de validación del equipo (crédito: Federico Ciccarone) — columnas oficiales, formato AR de montos, multipago con control de descuadre y Smart Fix contable.

## Roadmap de autenticación

v1 usa códigos de acceso (mismo UX que el prototipo, validado en servidor). Upgrade natural con **Supabase Auth**:
1. Magic link por mail: tabla `clientes` suma `email`, y el login manda el link en lugar de pedir código.
2. SSO con Nubceo: cuando devs exponga OAuth, se agrega como provider en Supabase Auth — sin tocar el modelo de datos.
3. Con Auth activo, se agregan políticas RLS por usuario y se puede pasar a acceso directo desde el navegador si se quisiera.

## Estructura

```
├── components/PortalApp.jsx        # Toda la UI (cliente + panel del equipo)
├── pages/index.js                  # Entrada (render solo en cliente)
├── pages/api/portal.js             # API principal: valida sesión y traduce a tablas
├── pages/api/calendar-callback.js  # Callback de OAuth de Google Calendar
├── pages/api/cron-recordatorios.js # Cron diario: recordatorios e incumplimientos de plazo
├── lib/supabaseAdmin.js            # Cliente service-role (solo servidor)
├── lib/redmine.js                  # Armado y envío de tickets (solo servidor)
├── lib/googleCalendar.js           # OAuth + freeBusy + creación de eventos reales (solo servidor)
├── lib/pasos.js                    # Definición de los 8 pasos + cálculo de completitud (compartido)
├── lib/hitos.js                    # Hitos del calendario de plazos (más granular, depende de vía API/CSV)
├── lib/email.js                    # Envío de mail vía Resend (solo servidor)
├── lib/plantillasMail.js           # Plantillas de mail (tono formal argentino)
├── lib/avisosPlazos.js             # Arma y envía el aviso de un plazo puntual (lo usan el cron y el botón manual)
├── public/logo-nubceo.png          # Logo real de Nubceo
├── vercel.json                     # Configuración del cron diario
├── supabase/schema.sql             # Esquema completo: tablas + RLS + seed (proyecto nuevo)
├── supabase/migracion-v4.sql       # Migración incremental — mail de equipo, Google Calendar
├── supabase/migracion-v5.sql       # Migración incremental — plazos y mails automáticos
├── supabase/migracion-v6.sql       # Migración incremental — roles, razón social/CUITs/logo, hitos nuevos
├── supabase/migracion-v7.sql       # Migración incremental — rol Finanzas + datos financieros del cliente
└── supabase/migracion-v8.sql       # Migración incremental — superadmin, comercial de cuenta, Redmine personal, fases 0-7
```

## Correr local

```bash
npm install
cp .env.example .env.local   # completar valores
npm run dev                  # http://localhost:3000
```
