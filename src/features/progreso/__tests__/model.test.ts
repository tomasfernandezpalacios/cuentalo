import {
  levelCost,
  levelInfo,
  levelsGained,
  MAX_LEVEL,
  missionStatus,
  sortMissions,
  xpForLevel,
  xpToReach,
  type Mission,
} from '../model';

describe('niveles', () => {
  it('el coste crece de forma exponencial y redondeado a 5', () => {
    expect(levelCost(1)).toBe(30);
    expect(levelCost(3)).toBe(35);
    expect(levelCost(10)).toBe(45);
    for (let n = 1; n < MAX_LEVEL; n++) {
      expect(levelCost(n + 1)).toBeGreaterThanOrEqual(levelCost(n));
      expect(levelCost(n) % 5).toBe(0);
    }
  });

  it('la XP para llegar a un nivel suma los costes anteriores', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(30);
    expect(xpForLevel(3)).toBe(60);
  });

  it('calcula el nivel y lo que lleva dentro', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, into: 0, cost: 30 });
    expect(levelInfo(29).level).toBe(1);
    expect(levelInfo(30)).toMatchObject({ level: 2, into: 0, cost: 30 });
    expect(levelInfo(xpForLevel(MAX_LEVEL) + 999)).toMatchObject({
      level: MAX_LEVEL,
      max: true,
      fraction: 1,
    });
  });

  it('dice cuánto falta y qué niveles se ganan', () => {
    expect(xpToReach(20, 3)).toBe(40);
    expect(xpToReach(100, 2)).toBe(0);
    expect(levelsGained(25, 70)).toEqual([2, 3]);
    expect(levelsGained(30, 31)).toEqual([]);
  });
});

describe('misiones', () => {
  const base: Mission = {
    id: 'a',
    kind: 'hoy',
    title: '',
    icon: '',
    goal: 3,
    progress: 1,
    xp: 10,
    coins: 5,
    claimed: false,
  };

  it('distingue en curso, lista y recogida', () => {
    expect(missionStatus(base)).toBe('en-curso');
    expect(missionStatus({ ...base, progress: 3 })).toBe('lista');
    expect(missionStatus({ ...base, progress: 3, claimed: true })).toBe('recogida');
  });

  it('ordena primero las que se pueden recoger', () => {
    const list = [
      { ...base, id: 'recogida', progress: 3, claimed: true },
      { ...base, id: 'curso' },
      { ...base, id: 'lista', progress: 3 },
    ];
    expect(sortMissions(list).map((m) => m.id)).toEqual(['lista', 'curso', 'recogida']);
  });
});
