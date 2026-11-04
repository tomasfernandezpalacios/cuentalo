import { dimPath, holeFor, placeBubble, ARROW_SPACE, HOLE_PADDING } from '../layout';
import { advancesOn, buildSteps, nextIndex, stepKind } from '../steps';

describe('pasos', () => {
  it('sin contadores, primero se crea uno', () => {
    expect(buildSteps(false).map((s) => s.id)).toEqual([
      'welcome',
      'intro',
      'create',
      'add',
      'remove',
      'tips',
      'stats',
      'social',
      'streak',
    ]);
  });

  it('con contadores, se salta crear', () => {
    expect(buildSteps(true).map((s) => s.id)).not.toContain('create');
  });

  it('«Siguiente» avanza y el último termina', () => {
    const steps = buildSteps(true);
    expect(nextIndex(steps, 0)).toBe(1);
    expect(nextIndex(steps, steps.length - 1)).toBeNull();
  });

  it('solo la acción que pide el paso lo hace avanzar', () => {
    const [, , create, add, remove] = buildSteps(false);
    expect(advancesOn(create, 'counter-created')).toBe(true);
    expect(advancesOn(create, 'entry-added')).toBe(false);
    expect(advancesOn(add, 'entry-added')).toBe(true);
    expect(advancesOn(remove, 'entry-removed')).toBe(true);
    expect(advancesOn(remove, 'entry-added')).toBe(false);
    expect(advancesOn(undefined, 'entry-added')).toBe(false);
  });

  it('los pasos de acción no tienen «Siguiente» y todos los demás sí', () => {
    const withAction = buildSteps(false)
      .filter((s) => s.action)
      .map((s) => s.id);
    expect(withAction).toEqual(['create', 'add', 'remove']);
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
  it('empieza a pantalla completa, enseña la app unos segundos y termina en la racha', () => {
    const steps = buildSteps(false);
    expect(stepKind(steps[0]!)).toBe('welcome');
    expect(stepKind(steps[1]!)).toBe('banner');
    expect(steps[1]?.autoAdvanceMs).toBe(2000);
    expect(steps.at(-1)?.target).toBe('racha');
    expect(steps.at(-1)?.screen).toBe('/');
  });

  it('va a Estadísticas y luego a Amigos y grupos, enseñando la pestaña entera', () => {
    const tour = buildSteps(true).filter((s) => stepKind(s) === 'tour');
    expect(tour.map((s) => s.screen)).toEqual(['/estadisticas', '/social']);
  });
});
