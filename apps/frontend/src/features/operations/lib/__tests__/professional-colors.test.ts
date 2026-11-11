import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_TONE,
  PROFESSIONAL_TONES,
  buildProfessionalToneMap,
} from '../professional-colors';

// quick-261108-n4s: cor automática por profissional (fundo = profissional, borda = status).

function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const ids = Array.from({ length: 12 }, (_, i) => `0190-${String(i).padStart(2, '0')}`);

describe('professional-colors', () => {
  it('paleta tem 12 tons com bg e avatarBg únicos', () => {
    expect(PROFESSIONAL_TONES).toHaveLength(12);
    expect(new Set(PROFESSIONAL_TONES.map((t) => t.bg)).size).toBe(12);
    expect(new Set(PROFESSIONAL_TONES.map((t) => t.avatarBg)).size).toBe(12);
  });

  it('12 profissionais recebem 12 tons distintos', () => {
    const map = buildProfessionalToneMap(ids);
    expect(new Set(ids.map((id) => map.get(id)?.bg)).size).toBe(12);
  });

  it('mesmo conjunto em outra ordem gera o mesmo mapa', () => {
    const a = buildProfessionalToneMap(ids);
    const b = buildProfessionalToneMap([...ids].reverse());
    const c = buildProfessionalToneMap([ids[5], ...ids.slice(0, 5), ...ids.slice(6)]);
    for (const id of ids) {
      expect(b.get(id)?.bg).toBe(a.get(id)?.bg);
      expect(c.get(id)?.bg).toBe(a.get(id)?.bg);
    }
  });

  it('ids repetidos na entrada não deslocam ninguém', () => {
    const a = buildProfessionalToneMap(ids);
    const b = buildProfessionalToneMap([ids[0], ids[0], ...ids, ids[3]]);
    expect(b.size).toBe(12);
    for (const id of ids) expect(b.get(id)?.bg).toBe(a.get(id)?.bg);
  });

  it('a partir da 13ª profissional a paleta recomeça', () => {
    const map = buildProfessionalToneMap([...ids, '0190-99']);
    expect(map.get(ids[0])?.bg).toBe(PROFESSIONAL_TONES[0].bg);
    expect(map.get('0190-99')?.bg).toBe(PROFESSIONAL_TONES[0].bg);
  });

  it('lista vazia gera mapa vazio', () => {
    expect(buildProfessionalToneMap([]).size).toBe(0);
  });

  it('tom neutro mantém o visual atual (branco)', () => {
    expect(NEUTRAL_TONE.bg).toBe('#FFFFFF');
    expect(NEUTRAL_TONE.bgHover).toBe('#F9FAFB');
    expect(NEUTRAL_TONE.avatarBg).toBe('#F5E6FB');
  });

  it.each(PROFESSIONAL_TONES.map((t) => [t.name, t] as const))(
    'contraste AA do texto no tom %s',
    (_name, tone) => {
      for (const fg of ['#1F2937', '#4B5563']) {
        expect(contrast(fg, tone.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(fg, tone.bgHover)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast('#1F2937', tone.avatarBg)).toBeGreaterThanOrEqual(4.5);
      expect(tone.bgHover).not.toBe(tone.bg);
    },
  );
});
