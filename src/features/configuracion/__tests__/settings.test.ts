import { localDateTime, toCsv } from '@/lib/csv';

import { reminderDates } from '../reminderDates';
import { DEFAULT_SETTINGS, parseSettings, toggleQuickAmount } from '../settings';

describe('parseSettings', () => {
  it('sin nada guardado o con JSON roto da los valores por defecto', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{roto')).toEqual(DEFAULT_SETTINGS);
  });

  it('mezcla lo guardado con lo que falta', () => {
    const s = parseSettings(JSON.stringify({ theme: 'dark', reminder: { enabled: true } }));
    expect(s.theme).toBe('dark');
    expect(s.accent).toBe('morado');
    expect(s.reminder).toEqual({ enabled: true, counters: false, hour: 21, minute: 0 });
  });

  it('limpia las cantidades rápidas: positivas, sin repetir, ordenadas y como mucho 3', () => {
    const s = parseSettings(JSON.stringify({ quickAmounts: [10, 1, 1, -2, 5, 20] }));
    expect(s.quickAmounts).toEqual([1, 5, 10]);
    expect(parseSettings(JSON.stringify({ quickAmounts: [] })).quickAmounts).toEqual([1, 5]);
  });
});

describe('toggleQuickAmount', () => {
  it('añade ordenado y quita', () => {
    expect(toggleQuickAmount([1, 5], 2)).toEqual([1, 2, 5]);
    expect(toggleQuickAmount([1, 5], 5)).toEqual([1]);
  });

  it('no pasa de 3 ni deja la lista vacía', () => {
    expect(toggleQuickAmount([1, 2, 5], 10)).toEqual([1, 2, 5]);
    expect(toggleQuickAmount([1], 1)).toEqual([1]);
  });
});

describe('reminderDates', () => {
  const now = new Date(2026, 10, 4, 18, 0); // 4 nov, 18:00

  it('incluye hoy si la hora no ha pasado y no hay registro', () => {
    const dates = reminderDates(now, 21, 0, false, 3);
    expect(dates.map((d) => d.getDate())).toEqual([4, 5, 6]);
    expect(dates[0]?.getHours()).toBe(21);
  });

  it('se salta hoy si ya registraste o si la hora ya pasó', () => {
    expect(reminderDates(now, 21, 0, true, 3).map((d) => d.getDate())).toEqual([5, 6]);
    expect(reminderDates(now, 9, 30, false, 3).map((d) => d.getDate())).toEqual([5, 6]);
  });

  it('cruza de mes', () => {
    const end = new Date(2026, 10, 30, 22, 0);
    expect(reminderDates(end, 21, 0, false, 2).map((d) => d.getMonth())).toEqual([11]);
  });
});

describe('toCsv', () => {
  it('pone comillas solo donde hace falta', () => {
    expect(
      toCsv([
        ['fecha', 'nota'],
        ['2026-11-04', 'hola, "tú"'],
      ]),
    ).toBe('fecha,nota\n2026-11-04,"hola, ""tú"""');
  });
});

describe('localDateTime', () => {
  it('formatea en la hora del móvil', () => {
    const iso = new Date(2026, 10, 4, 9, 5).toISOString();
    expect(localDateTime(iso)).toBe('2026-11-04 09:05');
  });
});
