import {
  parseAmount,
  validateEmail,
  validatePassword,
  validateRequiredText,
  validateUsername,
} from '../validation';

describe('parseAmount', () => {
  it.each([
    ['1', 1],
    ['2,5', 2.5],
    [' 10 ', 10],
    ['0.25', 0.25],
  ])('acepta %p', (input, expected) => {
    expect(parseAmount(input)).toEqual({ ok: true, value: expected });
  });

  it.each(['', '   ', '0', '0,0', '-3', 'abc', '1,2,3', '1e5', '1000000000'])(
    'rechaza %p',
    (input) => {
      expect(parseAmount(input).ok).toBe(false);
    },
  );
});

describe('validateRequiredText', () => {
  it('rechaza textos vacíos o solo espacios', () => {
    expect(validateRequiredText('   ', 'El nombre', 10)).toMatch(/vacío/);
  });

  it('rechaza textos demasiado largos', () => {
    expect(validateRequiredText('a'.repeat(11), 'El nombre', 10)).toMatch(/10 caracteres/);
  });

  it('acepta textos válidos', () => {
    expect(validateRequiredText(' Cervezas ', 'El nombre', 10)).toBeNull();
  });
});

describe('validateUsername', () => {
  it.each(['tomas', 'tomas_88', 'ABC'])('acepta %p', (value) => {
    expect(validateUsername(value)).toBeNull();
  });

  it.each(['ab', 'a'.repeat(21), 'tomás', 'con espacio', 'guion-medio'])('rechaza %p', (value) => {
    expect(validateUsername(value)).not.toBeNull();
  });
});

describe('validateEmail y validatePassword', () => {
  it('valida emails', () => {
    expect(validateEmail('yo@ejemplo.com')).toBeNull();
    expect(validateEmail('yo@ejemplo')).not.toBeNull();
  });

  it('exige al menos 6 caracteres de contraseña', () => {
    expect(validatePassword('12345')).not.toBeNull();
    expect(validatePassword('123456')).toBeNull();
  });
});
