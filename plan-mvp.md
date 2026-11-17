# Posadita — Plan MVP (costo cero)

App de amigo secreto / intercambio para posadas. El organizador invita por correo, quien acepta entra al evento, arma su lista de deseos y, tras el sorteo, ve en secreto a quién le tocó y su lista. Monto máximo en MXN por evento. Notificaciones por correo y WhatsApp.

## Stack (todo en plan gratuito)
| Pieza | Servicio | Límite relevante | Mitigación |
|---|---|---|---|
| App + funciones | Next.js (App Router) en Vercel Hobby | Cron 1 vez/día; uso personal no comercial | Un cron diario |
| BD + imágenes | Supabase Free (Postgres + Storage) | 500 MB BD, 1 GB archivos, pausa tras 7 días sin actividad | Cron diario hace `select` → no se pausa |
| Correo | Gmail SMTP (Nodemailer + App Password) | ~500/día | Suficiente |
| WhatsApp | Enlaces `wa.me` (manual) | No automatizado | v2: WhatsApp Cloud API (~US$0.0085/msg utilidad MX) |

Decisión: Resend descartado para v1 — sin dominio verificado solo envía al correo del dueño de la cuenta. El código trae adaptador Resend que se activa con `RESEND_API_KEY`.

## Rutas
- `/` crear evento (organizador también participa por defecto)
- `/i/[token]` invitación: aceptar / rechazar
- `/u/[token]` enlace genérico para unirse sin invitación directa (el organizador lo desactiva o regenera)
- `/e/[slug]` enlace del evento: entrar con correo + código y ver el contenido
- `/p/[token]` página secreta del participante: mi lista + mi amigo secreto
- `/admin/[adminToken]` panel del organizador: invitaciones, participantes, exclusiones, sortear, reabrir, compartir en WhatsApp
- `/api/cron/daily` recordatorio 3 días antes, limpieza de códigos, keep-alive de Supabase

## Reglas de negocio
- Mínimo 3 participantes. Sorteo = ciclo único aleatorio (Fisher–Yates con crypto) respetando exclusiones.
- Participante = invitación aceptada o unido con el enlace genérico (ambos confirman el correo con un código). Cupo, fecha límite y sorteo bloquean entrar.
- El sorteo lo hace únicamente el organizador (nunca automático).
- Acceso al evento con correo + código de 4 dígitos (10 min, 5 intentos, hash sha256).
- Sorteo atómico: transacción con `select ... for update` del evento.
- El organizador nunca ve tokens de participantes ni asignaciones.
- Quitar participante tras sorteo → se re-sortea y se notifica a todos. "Reabrir registro" borra asignaciones.
- Imágenes: redimensionadas en el navegador (máx 1600 px, WebP) → bucket público `wishlist` con rutas UUID.

## Modelo de datos
events, participants, invitations, login_codes, wishlist_items, assignments, exclusions, notifications (ver `db/schema.sql`).

## v2 (ideas)
Vista previa OG de enlaces, preguntas anónimas al amigo secreto, WhatsApp Cloud API.
