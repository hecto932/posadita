// Enlaces wa.me: costo cero. Abren WhatsApp con el mensaje ya escrito;
// la persona solo da "Enviar". Nunca incluimos enlaces personales (tokens)
// en mensajes que manda el organizador, para mantener el secreto.

/** Abre el selector de chats de WhatsApp (ideal para mandar al grupo). */
export function waShare(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Abre el chat con un número específico (E.164, con o sin +). */
export function waTo(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}
