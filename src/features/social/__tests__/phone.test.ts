import { normalizePhone, phoneHashInput, uniquePhones } from '../phone';

describe('normalizePhone', () => {
  it('se queda con las 9 últimas cifras, con o sin prefijo', () => {
    expect(normalizePhone('+34 600 11 22 33')).toBe('600112233');
    expect(normalizePhone('0034600112233')).toBe('600112233');
    expect(normalizePhone('600-112-233')).toBe('600112233');
  });

  it('descarta lo que es demasiado corto', () => {
    expect(normalizePhone('112')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});

describe('uniquePhones', () => {
  it('quita repetidos e inválidos', () => {
    expect(uniquePhones(['+34600112233', '600 112 233', '123', '611223344'])).toEqual([
      '600112233',
      '611223344',
    ]);
  });
});

it('phoneHashInput añade el prefijo de la app', () => {
  expect(phoneHashInput('600112233')).toBe('cuentalo:600112233');
});
