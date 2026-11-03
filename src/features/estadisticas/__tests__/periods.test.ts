import {
  bucketKey,
  buildSeries,
  isInPeriod,
  startOfIsoWeek,
  summarizeByCounter,
  todayInMadrid,
  type DailyTotal,
} from '../periods';

describe('todayInMadrid', () => {
  it('usa la fecha de Madrid aunque en UTC sea otro día', () => {
    // 23:30 UTC del 31 de diciembre = 00:30 del 1 de enero en Madrid (invierno, UTC+1).
    expect(todayInMadrid(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
    // 22:30 UTC del 30 de junio = 00:30 del 1 de julio en Madrid (verano, UTC+2).
    expect(todayInMadrid(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
    expect(todayInMadrid(new Date('2026-11-04T10:00:00Z'))).toBe('2026-11-04');
  });
});

describe('startOfIsoWeek', () => {
  it.each([
    ['2026-11-02', '2026-11-02'], // lunes
    ['2026-11-04', '2026-11-02'], // miércoles
    ['2026-11-08', '2026-11-02'], // domingo: sigue siendo la semana del lunes anterior
    ['2027-01-01', '2026-12-28'], // la semana cruza el cambio de año
    ['2024-03-01', '2024-02-26'], // año bisiesto
  ])('%s → %s', (day, monday) => {
    expect(startOfIsoWeek(day)).toBe(monday);
  });
});

describe('bucketKey', () => {
  it('agrupa por semana, mes y año', () => {
    expect(bucketKey('2026-11-04', 'week')).toBe('2026-11-02');
    expect(bucketKey('2026-11-04', 'month')).toBe('2026-11');
    expect(bucketKey('2026-11-04', 'year')).toBe('2026');
  });
});

describe('isInPeriod', () => {
  const today = '2026-11-04'; // miércoles

  it('semana: de lunes a hoy', () => {
    expect(isInPeriod('2026-11-02', today, 'week')).toBe(true);
    expect(isInPeriod('2026-11-01', today, 'week')).toBe(false); // domingo anterior
  });

  it('mes y año naturales', () => {
    expect(isInPeriod('2026-11-01', today, 'month')).toBe(true);
    expect(isInPeriod('2026-10-31', today, 'month')).toBe(false);
    expect(isInPeriod('2026-01-01', today, 'year')).toBe(true);
    expect(isInPeriod('2025-12-31', today, 'year')).toBe(false);
  });

  it('histórico incluye todo', () => {
    expect(isInPeriod('2001-05-05', today, 'all')).toBe(true);
  });
});

const rows: DailyTotal[] = [
  { counterId: 'a', day: '2026-11-03', total: 2, entryCount: 2 },
  { counterId: 'a', day: '2026-11-01', total: 5, entryCount: 1 },
  { counterId: 'a', day: '2026-02-10', total: 1.5, entryCount: 1 },
  { counterId: 'a', day: '2025-12-31', total: 10, entryCount: 3 },
  { counterId: 'b', day: '2026-11-04', total: 42, entryCount: 1 },
];

describe('summarizeByCounter', () => {
  const summary = summarizeByCounter(rows, '2026-11-04');

  it('suma cada periodo por separado', () => {
    expect(summary.get('a')).toEqual({
      week: { total: 2, entryCount: 2 },
      month: { total: 7, entryCount: 3 },
      year: { total: 8.5, entryCount: 4 },
      all: { total: 18.5, entryCount: 7 },
    });
  });

  it('no mezcla contadores', () => {
    expect(summary.get('b')?.all).toEqual({ total: 42, entryCount: 1 });
    expect(summary.has('c')).toBe(false);
  });
});

describe('buildSeries', () => {
  it('meses: rellena con 0 y cruza el cambio de año', () => {
    const series = buildSeries(rows, '2026-02-15', 'month', 4);
    expect(series.map((p) => p.key)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(series.map((p) => p.total)).toEqual([0, 10, 0, 1.5]);
    expect(series.map((p) => p.label)).toEqual(['nov', 'dic', 'ene 26', 'feb']);
  });

  it('semanas: claves por lunes y etiqueta con el día', () => {
    const series = buildSeries(rows, '2026-11-04', 'week', 2);
    expect(series).toEqual([
      { key: '2026-10-26', label: '26 oct', total: 5 },
      { key: '2026-11-02', label: '2 nov', total: 44 },
    ]);
  });

  it('años', () => {
    const series = buildSeries(rows, '2026-11-04', 'year', 3);
    expect(series.map((p) => [p.label, p.total])).toEqual([
      ['2024', 0],
      ['2025', 10],
      ['2026', 50.5],
    ]);
  });

  it('sin datos devuelve todos los periodos a 0', () => {
    expect(buildSeries([], '2026-11-04', 'week', 3).every((p) => p.total === 0)).toBe(true);
  });
});
