import { parseRecoveryUrl } from '../recovery';

jest.mock('expo-linking', () => ({ createURL: (path: string) => `cuentalo:/${path}` }));

describe('parseRecoveryUrl', () => {
  it('saca el código de la consulta', () => {
    expect(parseRecoveryUrl('exp://192.168.1.5:8081/--/restablecer?code=ABC123')).toEqual({
      kind: 'code',
      code: 'ABC123',
    });
  });

  it('no acepta una sesión metida en el enlace (solo el código PKCE)', () => {
    expect(
      parseRecoveryUrl(
        'cuentalo://restablecer#access_token=AAA&expires_in=3600&refresh_token=RRR&type=recovery',
      ),
    ).toBeNull();
  });

  it('entiende el error de un enlace caducado', () => {
    expect(
      parseRecoveryUrl(
        'cuentalo://restablecer#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({ kind: 'error', message: 'Email link is invalid or has expired' });
  });

  it('un enlace sin nada no es de recuperación', () => {
    expect(parseRecoveryUrl('cuentalo://restablecer')).toBeNull();
  });
});
