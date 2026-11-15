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
| `/admin/[token]` | Organizador | Invita por correo, ve quién aceptó/rechazó, exclusiones, **decide cuándo sortear**, avisa por WhatsApp. **No ve asignaciones.** |
| `/i/[token]` | Invitado | Su invitación: **Aceptar** (pone nombre y WhatsApp y confirma con un **código que llega al correo invitado**) o **Rechazar**. Solo quien acepta entra al evento. |
| `/e/[slug]` | Participantes | Enlace del evento: entras con **tu correo + un código de 6 dígitos** y ahí mismo ves tu lista, quiénes van y, tras el sorteo, a quién te tocó. Sin sesión solo se ve cuántas personas van, no sus nombres. |
| `/p/[token]` | Cada participante | Acceso directo (desde los correos) a la misma vista. Se puede **generar uno nuevo** (el anterior deja de servir y se cierran todas las sesiones); el organizador también puede regenerarlo, y el nuevo solo llega por correo. |
| `/api/cron/daily` | Vercel | Recordatorio 3 días antes, limpia códigos y límites viejos, mantiene viva la BD. |

**Invitaciones:** solo por invitación; nadie se registra solo. El cupo y la fecha límite únicamente impiden aceptar más invitaciones.

**El sorteo** solo ocurre cuando el organizador aprieta el botón (nunca automático). Es un **ciclo único** aleatorio (`crypto.randomInt` + Fisher–Yates): cada quien le regala a exactamente una persona y recibe de exactamente una, nadie se toca a sí mismo. Respeta exclusiones y corre en una transacción con `SELECT … FOR UPDATE` (a prueba de doble clic).

**Código de acceso:** 6 dígitos, vale 10 minutos, máximo 5 intentos, uno nuevo cada 60 s y máximo 8 al día por correo; solo se guarda su hash. La respuesta es la misma exista o no el correo. El mismo mecanismo (con propósito `invite`) confirma el correo al aceptar una invitación, así un correo reenviado no basta para entrar.

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

Sin `SMTP_*` los correos se imprimen en la consola, lo cual es útil para probar. Sin Supabase todo funciona excepto subir imágenes.

Pruebas: `npm test` (sorteo, fechas y teléfonos) y `npm run test:db` (integración contra Postgres; crea antes la BD `posadita_test` y corre `db/schema.sql` en ella).

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
