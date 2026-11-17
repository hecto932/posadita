/** "YYYY-MM-DDTHH:mm" para un <input type=datetime-local>, `days` días a partir de hoy a las 19:00. */
export function localDateTime(days: number) {
  const d = new Date(Date.now() + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T19:00`;
}
