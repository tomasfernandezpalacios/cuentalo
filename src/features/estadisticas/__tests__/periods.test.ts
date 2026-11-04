import {
  bucketKey,
  chartBuckets,
  chartValues,
  isInPeriod,
  startOfIsoWeek,
  localToday,
  type DailyTotal,
} from '../periods';

describe('localToday', () => {
  it('usa la fecha del móvil', () => {
    expect(localToday(new Date(2027, 0, 1, 0, 30))).toBe('2027-01-01');
    expect(localToday(new Date(2026, 10, 4, 23, 59))).toBe('2026-11-04');
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

describe('chartBuckets', () => {
  it('semana: de lunes a hoy, con iniciales', () => {
    const { buckets, granularity } = chartBuckets('week', '2026-11-04', null);
    expect(granularity).toBe('day');
    expect(buckets).toEqual([
      { key: '2026-11-02', label: 'L' },
      { key: '2026-11-03', label: 'M' },
      { key: '2026-11-04', label: 'X' },
    ]);
  });

  it('mes: del día 1 a hoy', () => {
    const { buckets } = chartBuckets('month', '2026-11-04', null);
    expect(buckets.map((b) => b.label)).toEqual(['1', '2', '3', '4']);
  });

  it('año: de enero al mes actual', () => {
    const { buckets, granularity } = chartBuckets('year', '2026-03-15', null);
    expect(granularity).toBe('month');
    expect(buckets.map((b) => b.key)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('histórico corto: por meses desde el primer registro', () => {
    const { buckets, granularity } = chartBuckets('all', '2026-02-10', '2025-11-20');
    expect(granularity).toBe('month');
    expect(buckets.map((b) => b.key)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('histórico largo: por años', () => {
    const { buckets, granularity } = chartBuckets('all', '2026-02-10', '2021-06-01');
    expect(granularity).toBe('year');
    expect(buckets.map((b) => b.key)).toEqual(['2021', '2022', '2023', '2024', '2025', '2026']);
  });

  it('histórico sin datos: solo el mes actual', () => {
    expect(chartBuckets('all', '2026-02-10', null).buckets).toHaveLength(1);
  });
});

describe('chartValues', () => {
  const rowsA = rows.filter((r) => r.counterId === 'a');

  it('suma por día', () => {
    const { buckets, granularity } = chartBuckets('week', '2026-11-04', null);
    expect(chartValues(rowsA, buckets, granularity)).toEqual([0, 2, 0]);
  });

  it('suma por mes y por año', () => {
    const months = chartBuckets('year', '2026-11-04', null);
    expect(chartValues(rowsA, months.buckets, months.granularity)).toEqual([
      0, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 7,
    ]);
    const years = chartBuckets('all', '2026-11-04', '2019-01-01');
    expect(chartValues(rowsA, years.buckets, years.granularity).slice(-2)).toEqual([10, 8.5]);
  });
});
