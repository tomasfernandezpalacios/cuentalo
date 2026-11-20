import { isEmptyAlias, planAlias } from '../alias';

const shared = { name: 'Cervezas', emoji: '🍺', unit: 'cervezas', photoPath: null };
const picked = { uri: 'file://x.jpg', base64: 'AA==', mimeType: 'image/jpeg' };

describe('planAlias (versión personal)', () => {
  it('lo que coincide con el grupo se guarda como null', () => {
    const plan = planAlias(
      { name: 'Cervezas', emoji: '🍺', unit: 'cervezas', photo: undefined },
      shared,
      null,
    );
    expect(plan.alias).toEqual({ name: null, emoji: null, unit: null, photoPath: null });
    expect(isEmptyAlias(plan.alias)).toBe(true);
  });

  it('nombre, emoticono y unidad propios', () => {
    const plan = planAlias(
      { name: ' Mis cañas ', emoji: '🍻', unit: 'cañas', photo: undefined },
      shared,
      null,
    );
    expect(plan.alias).toEqual({ name: 'Mis cañas', emoji: '🍻', unit: 'cañas', photoPath: null });
  });

  it('foto nueva: se sube y quita el emoticono propio', () => {
    const plan = planAlias(
      { name: 'Cervezas', emoji: '🍻', unit: '', photo: picked },
      shared,
      null,
    );
    expect(plan.upload).toBe(picked);
    expect(plan.alias.emoji).toBeNull();
  });

  it('foto sin tocar: conserva la mía', () => {
    const current = { name: null, emoji: null, unit: null, photoPath: 'personal/u/c.jpg' };
    const plan = planAlias(
      { name: 'Cervezas', emoji: '', unit: '', photo: 'keep' },
      shared,
      current,
    );
    expect(plan.alias.photoPath).toBe('personal/u/c.jpg');
    expect(plan.upload).toBeNull();
  });

  it('foto del grupo sin tocar: sin imagen propia', () => {
    const withPhoto = { ...shared, photoPath: 'c1/1.jpg' };
    const plan = planAlias(
      { name: 'Cervezas', emoji: '', unit: '', photo: 'keep' },
      withPhoto,
      null,
    );
    expect(isEmptyAlias(plan.alias)).toBe(true);
  });

  it('el grupo tiene foto y elijo su mismo emoticono: lo guardo (quiero el emoticono)', () => {
    const withPhoto = { ...shared, photoPath: 'c1/1.jpg' };
    const plan = planAlias(
      { name: 'Cervezas', emoji: '🍺', unit: '', photo: 'remove' },
      withPhoto,
      null,
    );
    expect(plan.alias.emoji).toBe('🍺');
  });
});
