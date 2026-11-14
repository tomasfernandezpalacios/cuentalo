import {
  BUBBLE_GAP,
  bubbleOutside,
  closedHole,
  HOLE_PADDING,
  holeFor,
  isClosed,
  movedEnough,
  placeBubble,
  screenHole,
} from '../layout';
import {
  advancesOn,
  advancesOnScreen,
  buildSteps,
  letsTouchTarget,
  nextIndex,
  showsNext,
  stepKind,
  stepScreen,
  TUTORIAL_COUNTER_NAME,
} from '../steps';

const byId = Object.fromEntries(buildSteps().map((s) => [s.id, s]));

describe('pasos', () => {
  it('el recorrido pedido: crear, sumar y restar, herramientas, pestañas, racha y fin', () => {
    expect(buildSteps().map((s) => s.id)).toEqual([
      'welcome',
      'intro',
      'create',
      'name',
      'submit',
      'add',
      'remove',
      'hold',
      'tools',
      'stats-tab',
      'stats',
      'social-tab',
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
    expect(advancesOn(byId.create, 'form-opened')).toBe(true);
    expect(advancesOn(byId.submit, 'counter-created')).toBe(true);
    expect(advancesOn(byId.add, 'entry-added')).toBe(true);
    expect(advancesOn(byId.remove, 'entry-removed')).toBe(true);
    expect(advancesOn(byId.hold, 'selection-opened')).toBe(true);
    expect(advancesOn(byId.create, 'entry-added')).toBe(false);
    expect(advancesOn(byId.remove, 'entry-added')).toBe(false);
    expect(advancesOn(undefined, 'entry-added')).toBe(false);
  });

  it('los pasos de pestaña avanzan al llegar a su pantalla', () => {
    expect(advancesOnScreen(byId['stats-tab'], '/estadisticas')).toBe(true);
    expect(advancesOnScreen(byId['stats-tab'], '/')).toBe(false);
    expect(advancesOnScreen(byId['social-tab'], '/social')).toBe(true);
    expect(advancesOnScreen(byId.stats, '/estadisticas')).toBe(false);
  });

  it('se toca lo iluminado en los pasos de acción y de pestaña; el resto lleva «Siguiente»', () => {
    const touch = buildSteps()
      .filter((s) => stepKind(s) === 'spotlight' && letsTouchTarget(s))
      .map((s) => s.id);
    expect(touch).toEqual(['create', 'submit', 'add', 'remove', 'hold', 'stats-tab', 'social-tab']);
    expect(showsNext(byId.name!, false)).toBe(true);
    expect(showsNext(byId.add!, false)).toBe(false);
    // Si el elemento no aparece, siempre se puede seguir.
    expect(showsNext(byId.add!, true)).toBe(true);
  });

  it('el contador del tutorial tiene nombre fijo y se crea en el formulario', () => {
    expect(TUTORIAL_COUNTER_NAME).toBe('Mi primer contador');
    expect(byId.name?.text).toContain(TUTORIAL_COUNTER_NAME);
    const inForm = buildSteps().filter((s) => s.screen === '/contadores/nuevo');
    expect(inForm.map((s) => [s.id, s.userNavigates, s.fallback])).toEqual([
      ['name', true, 'create'],
      ['submit', true, 'create'],
    ]);
  });

  it('empieza y acaba a pantalla completa; «Esto es Cuéntalo» se pasa solo', () => {
    const steps = buildSteps();
    expect(stepKind(steps[0]!)).toBe('welcome');
    expect(stepKind(steps[1]!)).toBe('banner');
    expect(steps[1]?.autoAdvanceMs).toBeGreaterThan(1500);
    expect(stepKind(steps.at(-1)!)).toBe('finish');
    expect(steps.at(-2)?.target).toBe('racha');
  });

  it('cada paso dice en qué pantalla se enseña', () => {
    expect(stepScreen(byId.create!)).toBe('/');
    expect(stepScreen(byId.stats!)).toBe('/estadisticas');
    expect(stepScreen(byId.social!)).toBe('/social');
    expect(stepScreen(byId.streak!)).toBe('/estadisticas');
  });
});

describe('foco', () => {
  it('el hueco deja margen alrededor del elemento', () => {
    expect(holeFor({ x: 10, y: 20, width: 40, height: 30 })).toEqual({
      left: 10 - HOLE_PADDING,
      top: 20 - HOLE_PADDING,
      right: 50 + HOLE_PADDING,
      bottom: 50 + HOLE_PADDING,
    });
  });

  it('un hueco cerrado es un punto', () => {
    expect(isClosed(closedHole(100, 200))).toBe(true);
    expect(isClosed(holeFor({ x: 0, y: 0, width: 10, height: 10 }))).toBe(false);
  });

  it('la pantalla entera queda entre la cabecera y la barra de pestañas', () => {
    const screen = { width: 400, height: 800, top: 40, bottom: 20 };
    expect(screenHole(screen, 64, 100)).toEqual({ left: 8, top: 104, right: 392, bottom: 700 });
  });

  it('solo se mueve el foco si el elemento se ha movido de verdad', () => {
    const a = { x: 10, y: 10, width: 50, height: 50 };
    expect(movedEnough(a, { ...a, y: 11 })).toBe(false);
    expect(movedEnough(a, { ...a, y: 20 })).toBe(true);
  });
});

describe('posición del bocadillo', () => {
  const screen = { width: 400, height: 800, top: 40, bottom: 30 };

  it('debajo del foco si cabe, con el piquito en su centro', () => {
    const hole = { left: 300, top: 60, right: 350, bottom: 110 };
    const result = placeBubble(hole, 160, screen);
    expect(result.placement).toBe('below');
    expect(result.top).toBe(110 + BUBBLE_GAP);
    expect(result.caretX).toBe(325);
    expect(bubbleOutside(hole, result, 160)).toBe(true);
  });

  it('encima si abajo no cabe (p. ej. la barra de pestañas)', () => {
    const hole = { left: 100, top: 700, right: 200, bottom: 760 };
    const result = placeBubble(hole, 160, screen);
    expect(result.placement).toBe('above');
    expect(result.top + 160).toBeLessThanOrEqual(700 - BUBBLE_GAP);
  });

  it('si no cabe fuera (la pantalla entera), va dentro, abajo, y sin piquito', () => {
    const hole = { left: 8, top: 104, right: 392, bottom: 700 };
    const result = placeBubble(hole, 180, screen);
    expect(result.top + 180).toBeLessThanOrEqual(700);
    expect(bubbleOutside(hole, result, 180)).toBe(false);
  });

  it('nunca se sale de la pantalla ni el piquito por los lados', () => {
    const hole = { left: 380, top: 300, right: 410, bottom: 330 };
    const result = placeBubble(hole, 400, screen);
    expect(result.top).toBeGreaterThanOrEqual(screen.top + 16);
    expect(result.top + 400).toBeLessThanOrEqual(screen.height - screen.bottom - 16);
    expect(result.caretX).toBeLessThanOrEqual(400 - 16 - 28);
  });
});
