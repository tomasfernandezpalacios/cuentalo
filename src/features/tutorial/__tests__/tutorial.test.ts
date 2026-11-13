import { dimPath, holeFor, lerpHole, placeBubble, ARROW_SPACE, HOLE_PADDING } from '../layout';
import { advancesOn, buildSteps, nextIndex, stepKind } from '../steps';

describe('pasos', () => {
  it('siempre se crea un contador sencillo, se aprenden los botones y se acaba en la racha', () => {
    expect(buildSteps().map((s) => s.id)).toEqual([
      'welcome',
      'intro',
      'create',
      'pick-idea',
      'submit',
      'add',
      'remove',
      'stats',
      'social',
      'streak',
      'done',
    ]);
  });

  it('«Siguiente» avanza y el último termina', () => {
    const steps = buildSteps();
    expect(nextIndex(steps, 0)).toBe(1);
    expect(nextIndex(steps, steps.length - 1)).toBeNull();
  });

  it('solo la acción que pide el paso lo hace avanzar', () => {
    const byId = Object.fromEntries(buildSteps().map((s) => [s.id, s]));
    expect(advancesOn(byId.create, 'form-opened')).toBe(true);
    expect(advancesOn(byId['pick-idea'], 'idea-chosen')).toBe(true);
    expect(advancesOn(byId.submit, 'counter-created')).toBe(true);
    expect(advancesOn(byId.create, 'entry-added')).toBe(false);
    expect(advancesOn(byId.add, 'entry-added')).toBe(true);
    expect(advancesOn(byId.remove, 'entry-removed')).toBe(true);
    expect(advancesOn(byId.remove, 'entry-added')).toBe(false);
    expect(advancesOn(undefined, 'entry-added')).toBe(false);
  });

  it('los pasos de tarea no tienen «Siguiente»; los que solo enseñan algo, sí', () => {
    const withAction = buildSteps()
      .filter((s) => s.action)
      .map((s) => s.id);
    expect(withAction).toEqual(['create', 'pick-idea', 'submit', 'add', 'remove']);
  });
});

describe('posición del bocadillo', () => {
  const screen = { width: 400, height: 800, top: 40, bottom: 30 };

  it('debajo del foco si cabe', () => {
    const hole = { x: 300, y: 60, width: 50, height: 50 };
    const result = placeBubble(hole, 160, screen);
    expect(result.placement).toBe('below');
    expect(result.top).toBe(60 + 50 + ARROW_SPACE);
    expect(result.arrowX).toBe(325);
  });

  it('encima si abajo no cabe (p. ej. la barra de pestañas)', () => {
    const hole = { x: 100, y: 700, width: 100, height: 60 };
    const result = placeBubble(hole, 160, screen);
    expect(result.placement).toBe('above');
    expect(result.top + 160).toBeLessThanOrEqual(700 - ARROW_SPACE);
  });

  it('nunca se sale de la pantalla', () => {
    const hole = { x: 0, y: 300, width: 400, height: 300 };
    const result = placeBubble(hole, 400, screen);
    expect(result.top).toBeGreaterThanOrEqual(screen.top + 16);
    expect(result.top + 400).toBeLessThanOrEqual(screen.height - screen.bottom - 16);
  });

  it('la flecha no se sale por los lados', () => {
    const hole = { x: 380, y: 60, width: 30, height: 30 };
    expect(placeBubble(hole, 100, screen).arrowX).toBeLessThanOrEqual(400 - 28);
  });
});

describe('foco', () => {
  it('el hueco deja margen alrededor del elemento', () => {
    const hole = holeFor({ x: 10, y: 20, width: 40, height: 40 });
    expect(hole).toMatchObject({
      x: 10 - HOLE_PADDING,
      y: 20 - HOLE_PADDING,
      width: 40 + HOLE_PADDING * 2,
    });
    expect(hole.radius).toBeLessThanOrEqual(hole.height / 2);
  });

  it('el contorno tiene el rectángulo de fuera y el hueco', () => {
    const path = dimPath(400, 800, { x: 10, y: 10, width: 50, height: 50, radius: 10 });
    expect(path.startsWith('M0 0H400V800H0Z')).toBe(true);
    expect(path).toContain('M20 10');
  });
});

describe('recorrido', () => {
  it('empieza y acaba a pantalla completa, y enseña la app unos segundos', () => {
    const steps = buildSteps();
    expect(stepKind(steps[0]!)).toBe('welcome');
    expect(stepKind(steps[1]!)).toBe('banner');
    expect(steps[1]?.autoAdvanceMs).toBe(2000);
    expect(stepKind(steps.at(-1)!)).toBe('finish');
    expect(steps.at(-2)?.target).toBe('racha');
  });

  it('crear se guía dentro del formulario, al que llega el propio usuario', () => {
    const inForm = buildSteps().filter((s) => s.screen === '/contadores/nuevo');
    expect(inForm.map((s) => s.id)).toEqual(['pick-idea', 'submit']);
    expect(inForm.every((s) => s.userNavigates)).toBe(true);
  });

  it('Estadísticas y Social se señalan desde la pantalla principal', () => {
    const tabs = buildSteps().filter((s) => s.id === 'stats' || s.id === 'social');
    expect(tabs.map((s) => [s.target, s.screen ?? '/', stepKind(s)])).toEqual([
      ['tab-estadisticas', '/', 'spotlight'],
      ['tab-social', '/', 'spotlight'],
    ]);
  });
});

describe('foco que se desliza', () => {
  it('a mitad de camino está entre los dos huecos', () => {
    const a = { x: 0, y: 0, width: 10, height: 10, radius: 4 };
    const b = { x: 100, y: 200, width: 30, height: 50, radius: 12 };
    expect(lerpHole(a, b, 0)).toEqual(a);
    expect(lerpHole(a, b, 1)).toEqual(b);
    expect(lerpHole(a, b, 0.5)).toEqual({ x: 50, y: 100, width: 20, height: 30, radius: 8 });
  });
});
