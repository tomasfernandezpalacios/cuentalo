import { contrastRatio } from '../color';
import { PALETTE_NAMES, PALETTES } from '../palettes';

describe('paletas 60-30-10', () => {
  for (const name of PALETTE_NAMES) {
    const { colors } = PALETTES[name];
    describe(name, () => {
      it('el texto se lee sobre el fondo, las tarjetas y los chips (AA, 4,5)', () => {
        expect(contrastRatio(colors.text, colors.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.text, colors.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.text, colors.elevated)).toBeGreaterThanOrEqual(4.5);
      });

      it('el texto secundario se lee (AA en tarjetas; 4 sobre el fondo)', () => {
        expect(contrastRatio(colors.textMuted, colors.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.textMuted, colors.background)).toBeGreaterThanOrEqual(4);
      });

      it('los botones del color de destaque se leen y destacan sobre las tarjetas', () => {
        expect(contrastRatio(colors.primary, colors.onPrimary)).toBeGreaterThanOrEqual(4.5);
        // Los totales grandes y los iconos van sobre las tarjetas: AA para texto grande.
        expect(contrastRatio(colors.primary, colors.surface)).toBeGreaterThanOrEqual(3);
      });
    });
  }
});
