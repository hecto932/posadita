import { describe, expect, it } from 'vitest';
import { drawPairs, DrawError } from '@/lib/draw';
import { zonedLocalToUtc, utcToZonedLocal, normalizePhone } from '@/lib/format';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe('drawPairs', () => {
  it('nadie se toca a sí mismo y todos dan y reciben una vez', () => {
    for (let run = 0; run < 500; run++) {
      const people = ids(3 + (run % 20));
      const pairs = drawPairs(people);
      expect(pairs).toHaveLength(people.length);
      expect(new Set(pairs.map((p) => p.giverId)).size).toBe(people.length);
      expect(new Set(pairs.map((p) => p.receiverId)).size).toBe(people.length);
      expect(pairs.every((p) => p.giverId !== p.receiverId)).toBe(true);
    }
  });

  it('forma un solo ciclo (sin grupitos cerrados)', () => {
    const people = ids(12);
    const pairs = drawPairs(people);
    const next = new Map(pairs.map((p) => [p.giverId, p.receiverId]));
    let cur = people[0];
    const seen = new Set<string>();
    while (!seen.has(cur)) {
      seen.add(cur);
      cur = next.get(cur)!;
    }
    expect(seen.size).toBe(people.length);
  });

  it('respeta exclusiones en ambos sentidos', () => {
    for (let run = 0; run < 300; run++) {
      const pairs = drawPairs(ids(6), [['p0', 'p1'], ['p2', 'p3']]);
      for (const p of pairs) {
        const k = [p.giverId, p.receiverId].sort().join('-');
        expect(['p0-p1', 'p2-p3']).not.toContain(k);
      }
    }
  });

  it('falla con menos de 3 o con exclusiones imposibles', () => {
    expect(() => drawPairs(ids(2))).toThrowError(DrawError);
    // p0 excluido de todos → imposible
    expect(() => drawPairs(ids(4), [['p0', 'p1'], ['p0', 'p2'], ['p0', 'p3']], 200)).toThrowError(/exclusiones/);
  });
});

describe('fechas y teléfonos', () => {
  it('convierte hora local de México a UTC y de regreso', () => {
    const d = zonedLocalToUtc('2026-12-18T20:00', 'America/Mexico_City')!;
    expect(d.toISOString()).toBe('2026-12-19T02:00:00.000Z');
    expect(utcToZonedLocal(d, 'America/Mexico_City')).toBe('2026-12-18T20:00');
    expect(zonedLocalToUtc('2026-12-18T20:00', 'America/Hermosillo')!.toISOString()).toBe('2026-12-19T03:00:00.000Z');
    expect(zonedLocalToUtc('2026-07-01T10:00', 'America/Tijuana')!.toISOString()).toBe('2026-07-01T17:00:00.000Z');
  });

  it('normaliza celulares mexicanos', () => {
    expect(normalizePhone('662 123 4567')).toBe('+526621234567');
    expect(normalizePhone('+52 1 55 1234 5678')).toBe('+525512345678');
    expect(normalizePhone('')).toBeNull();
    expect(() => normalizePhone('123')).toThrow();
  });
});
