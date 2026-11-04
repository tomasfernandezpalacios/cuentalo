import { getErrorMessage } from '../errors';

describe('getErrorMessage', () => {
  it('traduce los códigos de nuestras funciones SQL', () => {
    expect(getErrorMessage({ code: 'P0001', message: 'not_shared_counter' })).toBe(
      'Este contador no es de ningún grupo del que formes parte.',
    );
    expect(getErrorMessage({ code: 'P0001', message: 'invalid_period' })).toBe(
      'Ese periodo no es válido.',
    );
  });

  it('enseña tal cual los mensajes ya escritos en español', () => {
    expect(getErrorMessage({ code: 'P0001', message: 'No eres el líder de este grupo.' })).toBe(
      'No eres el líder de este grupo.',
    );
  });

  it('nunca enseña un código interno desconocido', () => {
    expect(getErrorMessage({ code: 'P0001', message: 'some_internal_code' })).toBe(
      'Ha ocurrido un error inesperado. Inténtalo de nuevo.',
    );
  });

  it('códigos de Postgres y de la autenticación', () => {
    expect(getErrorMessage({ code: '42501', message: 'x' })).toBe(
      'No tienes permiso para hacer esto.',
    );
    expect(getErrorMessage({ code: 'invalid_credentials', message: 'x' })).toBe(
      'Email o contraseña incorrectos.',
    );
  });
});
