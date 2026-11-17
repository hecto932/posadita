# Posadita 🎁

Amigo secreto para posadas e intercambios: **invitaciones por correo**, **un enlace** por evento para entrar con tu correo, **listas de deseos** con texto, enlaces e imágenes, **monto máximo en MXN** por evento y un **sorteo secreto** que ni el organizador puede ver. Avisos por **correo** y **WhatsApp**. **Costo: $0 MXN.**

## Stack (todo gratis)

| Pieza | Servicio | Límite que importa |
|---|---|---|
| App + funciones + cron | Next.js 16 en **Vercel Hobby** | Cron 1 vez al día; uso personal / no comercial |
| Postgres + imágenes | **Supabase Free** | 500 MB BD · 1 GB archivos · se pausa tras 7 días sin actividad (el cron diario lo evita) |
| Correo | **Gmail SMTP** (Nodemailer) | ~500 correos/día |
| WhatsApp | Enlaces **wa.me** | Los envía una persona con un toque |

> ¿Por qué no Resend? Sin dominio verificado solo envía al correo del dueño de la cuenta. El adaptador ya está: pon `RESEND_API_KEY` el día que tengas dominio.

## Cómo funciona

| Ruta | Quién | Qué hace |
|---|---|---|
| `/` | Organizador | Crea el evento (monto, fecha, lugar, cupo, fecha límite). Por defecto también participa. |
| `/admin/[token]` | Organizador | Invita por correo o comparte el enlace para unirse (lo puede desactivar o cambiar), ve quién aceptó/rechazó, exclusiones, **decide cuándo sortear**, avisa por WhatsApp. **No ve asignaciones.** |
| `/i/[token]` | Invitado | Su invitación: **Aceptar** (pone nombre y WhatsApp y confirma con un **código que llega al correo invitado**) o **Rechazar**. Solo quien acepta entra al evento. |
| `/u/[token]` | Cualquiera con el enlace | Enlace genérico para unirse sin invitación directa: pone nombre, WhatsApp y correo, y confirma con un **código que llega a ese correo**. Si ese correo ya estaba dentro, solo entra. |
| `/e/[slug]` | Participantes | Enlace del evento: entras con **tu correo + un código de 4 dígitos** y ahí mismo ves tu lista, quiénes van y, tras el sorteo, a quién te tocó. Sin sesión solo se ve cuántas personas van, no sus nombres. |
| `/p/[token]` | Cada participante | Acceso directo (desde los correos) a la misma vista. Se puede **generar uno nuevo** (el anterior deja de servir y se cierran todas las sesiones); el organizador también puede regenerarlo, y el nuevo solo llega por correo. |
| `/api/cron/daily` | Vercel | Recordatorio 3 días antes, limpia códigos y límites viejos, mantiene viva la BD. |

**Dos formas de entrar:** invitación directa por correo (`/i/[token]`) o el enlace genérico del evento (`/u/[token]`), que el organizador puede desactivar o regenerar. En ambas se confirma el correo con un código. Si el organizador canceló la invitación de un correo, ese correo tampoco puede unirse con el enlace. El cupo, la fecha límite y el sorteo impiden que entre más gente.

**El sorteo** solo ocurre cuando el organizador aprieta el botón (nunca automático). Es un **ciclo único** aleatorio (`crypto.randomInt` + Fisher–Yates): cada quien le regala a exactamente una persona y recibe de exactamente una, nadie se toca a sí mismo. Respeta exclusiones y corre en una transacción con `SELECT … FOR UPDATE` (a prueba de doble clic).

**Código de acceso:** 4 dígitos, vale 10 minutos, máximo 5 intentos, uno nuevo cada 60 s y máximo 8 al día por correo; solo se guarda su hash. La respuesta es la misma exista o no el correo. El mismo mecanismo confirma el correo al aceptar una invitación (propósito `invite`, así un correo reenviado no basta para entrar) y al unirse con el enlace genérico (propósito `join`).

**Sesiones:** la cookie lleva un token de sesión propio (no el enlace personal), dura 60 días y en la BD solo se guarda su hash (`sessions`). "Cerrar sesión" la borra.

**Fotos de la lista:** el bucket `wishlist` es **privado**; las imágenes se muestran con enlaces firmados que caducan en 1 h, y solo se firman las de tu lista y la de quien te tocó.

**Anti-abuso (cuida la cuota de Gmail):** límites por ventana guardados en Postgres (`rate_limits`, se limpia en el cron): crear evento 5/h por IP y 5/día por correo del organizador; invitaciones 100 correos/h por evento y máximo 200 por evento; reenviar una invitación cada 10 min; pedir código 10/h por IP; validar código 30/h por IP; recuperar panel 5/h por IP y 3/h por correo. El formulario de crear evento tiene un campo trampa para bots.

**¿Perdiste tu panel?** En `/` el organizador escribe su correo y le reenviamos los enlaces a sus paneles (misma respuesta exista o no).

**El secreto:** los enlaces personales y de invitación nunca pasan por el organizador. Al aceptar, cada quien puede mandarse su enlace a su propio WhatsApp; el organizador solo manda mensajes genéricos ("ya se hizo el sorteo, revisa tu correo"). `Referrer-Policy: no-referrer` evita que el token se filtre al abrir enlaces de tiendas.

## Correr local (WSL)

```bash
npm install
docker run -d --name posadita-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker exec -i posadita-db psql -U postgres < db/schema.sql
cp .env.example .env.local   # pon DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
npm run dev
```

Si no hay `SMTP_USER`/`SMTP_PASS` en ningún archivo `.env*`, los correos se imprimen en la consola, lo cual es útil para probar. **Ojo:** si tu `.env` tiene las credenciales reales de Gmail, `npm run dev` también las usa y manda correos de verdad. Sin Supabase todo funciona excepto subir imágenes.

Pruebas: `npm test` (sorteo, fechas y teléfonos) y `npm run test:db` (integración contra Postgres; crea antes la BD `posadita_test` y corre `db/schema.sql` en ella).

## Prueba de punta a punta (Playwright)

Recorre todo el flujo en un navegador real: el organizador crea el evento y arma su lista, invita a 20 personas, cada una abre su invitación desde el correo, entra con el código que le llegó y sube 2-3 deseos con foto real, nota y enlace. Después el organizador hace el sorteo y cada quien abre su correo del sorteo y ve la lista (con fotos) de su amigo secreto. Al final se comprueba que hubo exactamente 82 correos, todos `sent`, y que hay 53 fotos en Storage.

Corre contra un stack local aparte, así que no toca tu BD de dev ni manda nada por Gmail:

- **Supabase local** (`supabase/config.toml`): Postgres en `54322`, Storage en `54321` y Studio en http://127.0.0.1:54323 para ver el bucket `wishlist`.
- **Mailpit** (`docker-compose.e2e.yml`): atrapa todos los correos. Se ven en http://localhost:8026.
- La app se compila y corre en http://localhost:3100. `playwright.config.ts` le pasa variables que le ganan a `.env`.

Un solo comando para todo:

```bash
npm run e2e        # baja las fotos si faltan, levanta el stack y corre las 23 pruebas
npm run e2e -- --headed   # lo mismo, viendo el navegador (cualquier flag va a Playwright)
npm run test:all   # lint + typecheck + unitarias + e2e
```

**Demo visual:** abre una ventana de Chromium y recorre todo el flujo en orden, despacio y con un cartel abajo que narra cada paso. Usa tres pestañas: 👑 Organizador, 📬 Correo (Mailpit) e 🙋 Invitado.

1. El organizador crea el evento y arma su lista.
2. Invita a las 20 personas.
3. Cada una abre su invitación desde el correo, escribe el código que le llegó y sube sus deseos. Después de cada una, el panel del organizador marca su invitación como ✓ Aceptó.
4. El organizador hace el sorteo y cada quien abre su correo y ve la lista de su amigo secreto.

Hace las mismas verificaciones que las pruebas normales.

```bash
npm run e2e:demo                          # las 20 personas (≈10-12 min)
DEMO_PEOPLE=5 npm run e2e:demo            # versión corta
DEMO_PAUSE=2500 npm run e2e:demo          # más lento (pausa en ms al resaltar algo)
DEMO_PAUSE=400 DEMO_TYPE_DELAY=0 npm run e2e:demo   # más rápido
```

Por partes:

```bash
npm run e2e:images     # una vez: baja 53 fotos reales a e2e/fixtures/images/
npm run e2e:up         # supabase start + Mailpit (la primera vez descarga imágenes de Docker)
npm run test:e2e       # todo en headless (~1 min incluyendo el build)
npm run test:e2e:ui    # modo UI: ves cada paso, el DOM y el video
npm run test:e2e:headed
npm run test:e2e:report  # reporte HTML con video, capturas y trace de cada prueba
npm run e2e:down
```

Las etapas son proyectos encadenados: `reset → organizador → participantes (20 en paralelo) → sorteo`. Cada corrida empieza con la BD, el bucket y Mailpit vacíos. Cada invitado manda su propio `x-forwarded-for` para no toparse con el límite de 10 códigos por hora por IP.

## Desplegar (≈15 min)

1. **Supabase** → New project (región `us-east-1` o `us-west-1`, las más cercanas a MX).
   - SQL Editor → pega y corre `db/schema.sql` y luego `db/supabase-storage.sql`.
   - **Connect → Transaction pooler**, copia la URI y úsala como `DATABASE_URL`. Si tu password tiene símbolos, codifícalos en URL.
   - Project Settings → API Keys → `SUPABASE_URL` y la **secret key** (`SUPABASE_SECRET_KEY`).
2. **Gmail** → Cuenta de Google → Seguridad → activa la verificación en 2 pasos → **Contraseñas de aplicación**. Genera una y ponla en `SMTP_PASS`. Te recomiendo crear un Gmail dedicado, p. ej. `posadita.app@gmail.com`.
3. **Vercel** → sube el repo a GitHub → Import → agrega todas las variables de `.env.example`, con `APP_URL=https://<tu-app>.vercel.app` y un `CRON_SECRET` largo. Deploy.
   - El cron (`vercel.json`) corre diario a las 15:00 UTC (9:00 en CDMX). Vercel le manda `Authorization: Bearer $CRON_SECRET`.
4. Prueba: crea un evento con tu correo, invita a otro correo tuyo y acepta la invitación.

## Cambiar el nombre

`src/lib/config.ts` → `APP_NAME` y `APP_TAGLINE`.

## Ideas para v2

- Vista previa (Open Graph) de enlaces de tiendas
- Preguntas anónimas al amigo secreto ("¿qué talla eres?")
- WhatsApp Cloud API para avisos automáticos (~US$0.0085 por mensaje de utilidad en MX)
