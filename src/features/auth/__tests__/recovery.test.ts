import { parseRecoveryUrl } from '../recovery';

jest.mock('expo-linking', () => ({ createURL: (path: string) => `cuentalo:/${path}` }));

describe('parseRecoveryUrl', () => {
  it('saca la sesión del fragmento', () => {
    expect(
      parseRecoveryUrl(
        'exp://192.168.1.5:8081/--/restablecer#access_token=AAA&expires_in=3600&refresh_token=RRR&type=recovery',
      ),
    ).toEqual({ kind: 'session', accessToken: 'AAA', refreshToken: 'RRR' });
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
