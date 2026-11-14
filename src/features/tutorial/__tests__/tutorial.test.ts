import {
  BUBBLE_GAP,
  closeAt,
  closedHole,
  GLIDE_MAX,
  GLIDE_MIN,
  glideDuration,
  HOLE_PADDING,
  holeFor,
  holeInside,
  isClosed,
  isVisibleIn,
  movedEnough,
  PAGE_INSET,
  placeBubble,
} from '../layout';
import { nextPhase } from '../machine';
import {
  advancesOn,
  advancesOnScreen,
  buildSteps,
  closesBetween,
  isTabScreen,
  isWholeScreen,
  letsTouchTarget,
  navigationFor,
  nextIndex,
  readyToEnter,
  showsNext,
  stepKind,
  stepScreen,
  TUTORIAL_COUNTER_NAME,
  type Readiness,
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

  it('una pantalla entera se ilumina por dentro de su zona de contenido', () => {
    expect(holeInside({ x: 0, y: 100, width: 400, height: 600 })).toEqual({
      left: PAGE_INSET,
      top: 100 + PAGE_INSET,
      right: 400 - PAGE_INSET,
      bottom: 700 - PAGE_INSET,
    });
  });

  it('el iris se cierra sobre el centro del hueco', () => {
    expect(closeAt({ left: 10, top: 20, right: 50, bottom: 60 })).toEqual(closedHole(30, 40));
  });

  it('un elemento fuera de la pantalla (otra página) no se ilumina', () => {
    expect(isVisibleIn({ x: 10, y: 10, width: 50, height: 50 }, 400, 800)).toBe(true);
    expect(isVisibleIn({ x: 410, y: 10, width: 50, height: 50 }, 400, 800)).toBe(false);
    expect(isVisibleIn({ x: 10, y: 10, width: 0, height: 0 }, 400, 800)).toBe(false);
  });

  it('se considera quieto con medio píxel de diferencia', () => {
    const a = { x: 10, y: 10, width: 50, height: 50 };
    expect(movedEnough(a, { ...a, y: 10.3 })).toBe(false);
    expect(movedEnough(a, { ...a, y: 12 })).toBe(true);
  });

  it('el deslizamiento dura según lo que se mueve, entre un mínimo y un máximo', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(glideDuration(a, a)).toBe(GLIDE_MIN);
    const near = glideDuration(a, { left: 0, top: 100, right: 10, bottom: 110 });
    const far = glideDuration(a, { left: 0, top: 800, right: 10, bottom: 810 });
    expect(near).toBeGreaterThan(GLIDE_MIN);
    expect(near).toBeLessThan(far);
    expect(far).toBe(GLIDE_MAX);
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
    expect(result.caret).toBe(true);
  });

  it('encima si abajo no cabe (p. ej. la barra de pestañas)', () => {
    const hole = { left: 100, top: 700, right: 200, bottom: 760 };
    const result = placeBubble(hole, 160, screen);
    expect(result.placement).toBe('above');
    expect(result.top + 160).toBeLessThanOrEqual(700 - BUBBLE_GAP);
    expect(result.caret).toBe(true);
  });

  it('si no cabe fuera (la pantalla entera), va dentro, abajo, y sin piquito', () => {
    const hole = { left: 8, top: 104, right: 392, bottom: 700 };
    const result = placeBubble(hole, 180, screen);
    expect(result.top + 180).toBeLessThanOrEqual(700);
    expect(result.caret).toBe(false);
  });

  it('nunca se sale de la pantalla ni el piquito por los lados', () => {
    const hole = { left: 380, top: 300, right: 410, bottom: 330 };
    const result = placeBubble(hole, 400, screen);
    expect(result.top).toBeGreaterThanOrEqual(screen.top + 16);
    expect(result.top + 400).toBeLessThanOrEqual(screen.height - screen.bottom - 16);
    expect(result.caretX).toBeLessThanOrEqual(400 - 16 - 28);
  });
});

describe('foco cerrado', () => {
  it('sin elemento, el bocadillo va en el centro y sin piquito', () => {
    const screen = { width: 400, height: 800, top: 40, bottom: 30 };
    const result = placeBubble(closedHole(200, 400), 200, screen);
    expect(result.top).toBe(300);
    expect(result.caret).toBe(false);
  });
});

describe('fases de cada paso', () => {
  it('siempre en orden: irse → esperar → entrar → a la vista', () => {
    let phase = nextPhase('active', 'leave');
    expect(phase).toBe('leaving');
    phase = nextPhase(phase, 'left');
    expect(phase).toBe('waiting');
    phase = nextPhase(phase, 'ready');
    expect(phase).toBe('entering');
    phase = nextPhase(phase, 'entered');
    expect(phase).toBe('active');
  });

  it('un aviso que llega tarde no salta fases', () => {
    expect(nextPhase('leaving', 'ready')).toBe('leaving');
    expect(nextPhase('leaving', 'entered')).toBe('leaving');
    expect(nextPhase('waiting', 'entered')).toBe('waiting');
    expect(nextPhase('active', 'left')).toBe('active');
  });

  it('un paso nuevo corta cualquier fase', () => {
    for (const phase of ['leaving', 'waiting', 'entering', 'active'] as const) {
      expect(nextPhase(phase, 'leave')).toBe('leaving');
    }
  });
});

describe('cuándo se cierra el hueco', () => {
  it('entre elementos de la misma pantalla se desliza sin cerrarse', () => {
    expect(closesBetween(byId.add!, byId.remove!)).toBe(false);
    expect(closesBetween(byId.name!, byId.submit!)).toBe(false);
    expect(closesBetween(byId.tools!, byId['stats-tab']!)).toBe(false);
  });

  it('al cambiar de pantalla, o sin paso siguiente, se cierra', () => {
    expect(closesBetween(byId.create!, byId.name!)).toBe(true);
    expect(closesBetween(byId.submit!, byId.add!)).toBe(true);
    expect(closesBetween(byId.social!, byId.streak!)).toBe(true);
    expect(closesBetween(byId.streak!, byId.done!)).toBe(true);
    expect(closesBetween(byId.submit!, null)).toBe(true);
  });

  it('desde la bienvenida o el rótulo no hay hueco que cerrar', () => {
    expect(closesBetween(null, byId.welcome!)).toBe(false);
    expect(closesBetween(byId.intro!, byId.create!)).toBe(false);
  });
});

describe('navegación y espera', () => {
  const ready: Readiness = {
    pathname: '/',
    stackBusy: false,
    pagerBusy: false,
    targetMounted: true,
  };

  it('el tutorial solo navega a donde no llega el propio usuario', () => {
    expect(navigationFor(byId.streak!, '/social')).toBe('/estadisticas');
    expect(navigationFor(byId.create!, '/')).toBeNull();
    // Al formulario y de vuelta a la lista llega el usuario.
    expect(navigationFor(byId.name!, '/')).toBeNull();
    expect(navigationFor(byId.add!, '/contadores/nuevo')).toBeNull();
    expect(navigationFor(byId.welcome!, '/perfil')).toBeNull();
  });

  it('espera a que termine cualquier transición y a que el elemento esté montado', () => {
    expect(readyToEnter(byId.add!, ready)).toBe(true);
    expect(readyToEnter(byId.add!, { ...ready, stackBusy: true })).toBe(false);
    expect(readyToEnter(byId.add!, { ...ready, pagerBusy: true })).toBe(false);
    expect(readyToEnter(byId.add!, { ...ready, targetMounted: false })).toBe(false);
    expect(readyToEnter(byId.add!, { ...ready, pathname: '/contadores/nuevo' })).toBe(false);
    expect(readyToEnter(byId.stats!, { ...ready, pathname: '/estadisticas' })).toBe(true);
  });

  it('la bienvenida y el final no esperan a nada', () => {
    const busy = { ...ready, stackBusy: true, pagerBusy: true, targetMounted: false };
    expect(readyToEnter(byId.welcome!, busy)).toBe(true);
    expect(readyToEnter(byId.done!, busy)).toBe(true);
  });

  it('las pestañas grandes son páginas; el formulario no', () => {
    expect(isTabScreen('/estadisticas')).toBe(true);
    expect(isTabScreen('/')).toBe(true);
    expect(isTabScreen('/contadores/nuevo')).toBe(false);
  });

  it('las presentaciones de Estadísticas y Social iluminan la pantalla entera', () => {
    expect(isWholeScreen(byId.stats!.target)).toBe(true);
    expect(isWholeScreen(byId.social!.target)).toBe(true);
    expect(isWholeScreen(byId.add!.target)).toBe(false);
  });
});
