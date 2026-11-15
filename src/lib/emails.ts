import { APP_NAME, appUrl } from './config';
import { escapeHtml as h, formatDateTime, formatMXN } from './format';
import type { Mail } from './mailer';
import type { EventRow, Invitation, Participant } from './service';

type Block = { heading: string; lines: string[]; cta?: { label: string; url: string }; footer?: string };

function render(to: string, subject: string, b: Block): Mail {
  const html = `<!doctype html><html><body style="margin:0;background:#fff7ec;font-family:Arial,Helvetica,sans-serif;color:#2b1a12">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <div style="height:8px;background:linear-gradient(90deg,#e4007c 0 20%,#ff7a00 20% 40%,#00a86b 40% 60%,#6b2fd6 60% 80%,#ffc400 80%);border-radius:4px"></div>
    <div style="background:#fff;border-radius:16px;padding:28px;margin-top:16px;border:1px solid #f1dcc4">
      <p style="margin:0 0 4px;font-size:13px;color:#a2552a;font-weight:bold">${h(APP_NAME)}</p>
      <h1 style="margin:0 0 16px;font-size:22px">${h(b.heading)}</h1>
      ${b.lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${l}</p>`).join('')}
      ${
        b.cta
          ? `<p style="margin:24px 0 8px"><a href="${h(b.cta.url)}" style="background:#e4007c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold;display:inline-block">${h(b.cta.label)}</a></p>
             <p style="margin:0;font-size:12px;color:#8a6a55;word-break:break-all">${h(b.cta.url)}</p>`
          : ''
      }
    </div>
    <p style="font-size:12px;color:#8a6a55;margin-top:16px">${h(b.footer ?? 'Este enlace es solo tuyo. No lo compartas para no arruinar la sorpresa.')}</p>
  </div></body></html>`;
  const strip = (s: string) => s.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '');
  const text = [b.heading, '', ...b.lines.map(strip), b.cta ? `\n${b.cta.label}: ${b.cta.url}` : ''].join('\n');
  return { to, subject, html, text };
}

const eventFacts = (e: EventRow) =>
  [
    `💰 Monto máximo: <b>${formatMXN(e.maxAmountMxn)}</b>`,
    e.eventAt ? `📅 ${h(formatDateTime(e.eventAt, e.timezone)!)}` : null,
    e.location ? `📍 ${h(e.location)}` : null,
  ].filter(Boolean) as string[];

export const personalUrl = (p: Participant) => appUrl(`/p/${p.accessToken}`);

export function registeredEmail(e: EventRow, p: Participant): Mail {
  return render(p.email, `Ya estás en "${e.name}" 🎁`, {
    heading: `¡Listo, ${p.name}! Ya estás en ${e.name}`,
    lines: [
      'Desde tu enlace personal puedes armar tu lista de deseos y, cuando se haga el sorteo, ver a quién te tocó.',
      ...eventFacts(e),
    ],
    cta: { label: 'Abrir mi página', url: personalUrl(p) },
  });
}

export function organizerEmail(e: EventRow, organizer: Participant | null): Mail {
  return render(e.organizerEmail, `Tu evento "${e.name}" está listo`, {
    heading: `Creaste "${e.name}" 🎉`,
    lines: [
      'Desde tu panel de organizador invitas a las personas por correo, ves quién aceptó, pones exclusiones y decides cuándo hacer el sorteo. Guárdalo y no lo compartas.',
      `Página del evento (cada quien entra con su correo):<br><b>${h(appUrl(`/e/${e.slug}`))}</b>`,
      organizer
        ? `Tu página personal como participante: <a href="${h(personalUrl(organizer))}">${h(personalUrl(organizer))}</a>`
        : '',
      ...eventFacts(e),
    ].filter(Boolean),
    cta: { label: 'Abrir panel de organizador', url: appUrl(`/admin/${e.adminToken}`) },
    footer: 'Tu panel de organizador no muestra a quién le tocó quién. Ni tú lo sabrás. 🤫',
  });
}

export function drawEmail(e: EventRow, p: Participant, receiverName: string): Mail {
  return render(p.email, `🎁 ¡Ya se hizo el sorteo de "${e.name}"!`, {
    heading: `${p.name}, te tocó… ${receiverName} 🤫`,
    lines: [`Entra a tu página para ver su lista de deseos y escoger el regalo perfecto.`, ...eventFacts(e)],
    cta: { label: `Ver la lista de ${receiverName}`, url: personalUrl(p) },
  });
}

export function reminderEmail(e: EventRow, p: Participant, receiverName: string): Mail {
  return render(p.email, `⏰ Ya casi es "${e.name}"`, {
    heading: `¿Ya tienes el regalo para ${receiverName}?`,
    lines: ['Te recordamos que ya casi es el intercambio.', ...eventFacts(e)],
    cta: { label: 'Ver su lista de deseos', url: personalUrl(p) },
  });
}

export function invitationEmail(e: EventRow, inv: Invitation): Mail {
  return render(inv.email, `${e.organizerName} te invita a "${e.name}" 🎁`, {
    heading: `¡Te invitaron al intercambio "${e.name}"!`,
    lines: [
      `<b>${h(e.organizerName)}</b> te invitó a su amigo secreto. Acepta para entrar, armar tu lista de deseos y participar en el sorteo.`,
      ...eventFacts(e),
      e.description ? h(e.description).replace(/\n/g, '<br>') : '',
    ].filter(Boolean),
    cta: { label: 'Ver invitación', url: appUrl(`/i/${inv.token}`) },
    footer: 'Esta invitación es para tu correo. Si no la esperabas, puedes ignorarla.',
  });
}

export function loginCodeEmail(e: EventRow, p: Participant, code: string, minutes: number): Mail {
  return render(p.email, `${code} es tu código para "${e.name}"`, {
    heading: `Tu código para entrar: ${code}`,
    lines: [
      `Hola ${h(p.name)}, escribe este código en la página del evento para entrar. Vale ${minutes} minutos.`,
      `<span style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</span>`,
    ],
    footer: 'Si tú no pediste este código, ignora este correo. Nadie puede entrar sin él.',
  });
}

/** Código para confirmar el correo al aceptar una invitación. */
export function inviteCodeEmail(e: EventRow, inv: Invitation, code: string, minutes: number): Mail {
  return render(inv.email, `${code} es tu código para entrar a "${e.name}"`, {
    heading: `Tu código para aceptar: ${code}`,
    lines: [
      `Escribe este código en la página de la invitación a <b>${h(e.name)}</b> para entrar. Vale ${minutes} minutos.`,
      `<span style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</span>`,
    ],
    footer: 'Si tú no lo pediste, ignora este correo: sin este código nadie puede aceptar tu invitación.',
  });
}

/** Enlace personal nuevo (el anterior ya no sirve). */
export function newLinkEmail(e: EventRow, p: Participant): Mail {
  return render(p.email, `Tu nuevo enlace para "${e.name}"`, {
    heading: `${p.name}, este es tu nuevo enlace personal`,
    lines: [
      'Se generó un enlace nuevo para tu página en el intercambio. El anterior ya no funciona y se cerró la sesión en todos los dispositivos.',
      'También puedes entrar siempre desde la página del evento con tu correo y un código.',
    ],
    cta: { label: 'Abrir mi página', url: personalUrl(p) },
  });
}

/** "¿Perdiste tu panel?": un solo correo con los paneles de los eventos de ese organizador. */
export function adminRecoveryEmail(to: string, events: EventRow[]): Mail {
  const many = events.length > 1;
  return render(to, many ? 'Tus paneles de organizador' : `Tu panel de "${events[0].name}"`, {
    heading: many ? 'Aquí están tus paneles de organizador' : `Aquí está tu panel de "${events[0].name}"`,
    lines: [
      'Alguien (seguramente tú) pidió recuperar el enlace del panel de organizador.',
      ...events.map((e) => {
        const url = appUrl(`/admin/${e.adminToken}`);
        const when = e.eventAt ? ` · ${h(formatDateTime(e.eventAt, e.timezone)!)}` : '';
        return `<b>${h(e.name)}</b>${when}<br><a href="${h(url)}">${h(url)}</a>`;
      }),
    ],
    cta: many ? undefined : { label: 'Abrir panel de organizador', url: appUrl(`/admin/${events[0].adminToken}`) },
    footer: 'Si tú no lo pediste, ignora este correo. Nadie más lo recibió.',
  });
}
