import { randomInt } from 'node:crypto';

export type Pair = { giverId: string; receiverId: string };

export class DrawError extends Error {
  constructor(public code: 'NOT_ENOUGH' | 'IMPOSSIBLE', message: string) {
    super(message);
  }
}

/**
 * Sorteo como un solo ciclo aleatorio: se revuelve la lista y cada quien le
 * regala al siguiente. Garantiza que nadie se toque a sí mismo y que no se
 * formen "grupitos" cerrados (A↔B). Respeta exclusiones en ambos sentidos.
 */
export function drawPairs(
  ids: string[],
  exclusions: Array<[string, string]> = [],
  maxTries = 2000,
): Pair[] {
  const unique = [...new Set(ids)];
  if (unique.length < 3) throw new DrawError('NOT_ENOUGH', 'Se necesitan al menos 3 participantes');

  const banned = new Set<string>();
  for (const [a, b] of exclusions) {
    banned.add(`${a}>${b}`);
    banned.add(`${b}>${a}`);
  }

  for (let t = 0; t < maxTries; t++) {
    const s = [...unique];
    for (let i = s.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [s[i], s[j]] = [s[j], s[i]];
    }
    const pairs = s.map((giverId, i) => ({ giverId, receiverId: s[(i + 1) % s.length] }));
    if (pairs.every((p) => !banned.has(`${p.giverId}>${p.receiverId}`))) return pairs;
  }
  throw new DrawError(
    'IMPOSSIBLE',
    'No se encontró una combinación que respete todas las exclusiones. Quita alguna e intenta de nuevo.',
  );
}
