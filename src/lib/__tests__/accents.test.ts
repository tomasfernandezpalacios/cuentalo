import { contrastRatio } from '../color';

jest.mock('@/features/configuracion/settings', () => ({
  getSettings: () => ({ theme: 'dark' }),
  useSettings: () => ({ theme: 'dark', accent: 'dorado' }),
}));

// eslint-disable-next-line import/first
import { accents } from '../theme';

// El texto de los botones: blanco en claro y casi negro en oscuro.
const ON_PRIMARY = { light: '#FFFFFF', dark: '#0B0A09' };
// Fondos de la app, para que el color también se lea como texto sobre ellos.
const BACKGROUND = { light: '#F3EEE4', dark: '#0B0A09' };

describe('colores de destaque', () => {
  it('son seis', () => {
    expect(Object.keys(accents)).toHaveLength(6);
  });

  for (const [name, accent] of Object.entries(accents)) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${name} (${mode}) cumple AA con el texto de los botones y sobre el fondo`, () => {
        expect(contrastRatio(accent[mode].primary, ON_PRIMARY[mode])).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(accent[mode].primary, BACKGROUND[mode])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
