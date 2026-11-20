import { MAX_LEVEL } from '../model';
import {
  emblemStage,
  inkFor,
  rankOf,
  RANKS_PER_TIER,
  tierBonus,
  tierLevels,
  TIERS,
} from '../ranks';

describe('rangos de vida', () => {
  it('reparte los 100 niveles en 20 capítulos de 5', () => {
    expect(TIERS).toHaveLength(20);
    expect(RANKS_PER_TIER).toBe(5);
    expect(TIERS.flatMap(tierLevels)).toEqual(Array.from({ length: MAX_LEVEL }, (_, i) => i + 1));
  });

  it('da nombre a cada nivel', () => {
    expect(rankOf(1).name).toBe('Semilla I');
    expect(rankOf(5).name).toBe('Semilla V');
    expect(rankOf(6)).toMatchObject({ name: 'Brote I', firstOfTier: true });
    expect(rankOf(13).name).toBe('Caminante III');
    expect(rankOf(100).name).toBe('Infinito V');
  });

  it('no se sale de los límites', () => {
    expect(rankOf(0).name).toBe('Semilla I');
    expect(rankOf(999).name).toBe('Infinito V');
  });

  it('el emblema se complica cada 4 capítulos', () => {
    expect(TIERS.map((t) => emblemStage(t.chapter))).toEqual([
      1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5,
    ]);
  });

  it('la recompensa de capítulo crece', () => {
    expect(tierBonus(2)).toEqual({ coins: 100, shields: 1 });
    expect(tierBonus(10).coins).toBeGreaterThan(tierBonus(3).coins);
  });

  it('elige la tinta que más se lee', () => {
    expect(inkFor('#F2C230')).toBe('#1A1714');
    expect(inkFor('#2B2D6E')).toBe('#FFFFFF');
  });
});
