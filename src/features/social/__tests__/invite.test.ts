import { formatInviteCode, normalizeInviteCode } from '../api';
import { parseInviteCode } from '../pendingInvite';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('códigos de invitación', () => {
  it('normaliza lo que escribe el usuario', () => {
    expect(normalizeInviteCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizeInviteCode('ab cd ef gh')).toBe('ABCDEFGH');
  });

  it('formatea en dos bloques de cuatro', () => {
    expect(formatInviteCode('ABCDEFGH')).toBe('ABCD-EFGH');
    expect(formatInviteCode('ABC')).toBe('ABC');
  });

  it('extrae el código de los enlaces de la app y de Expo Go', () => {
    expect(parseInviteCode('cuentalo://unirse/ABCDEFGH')).toBe('ABCDEFGH');
    expect(parseInviteCode('exp://192.168.0.23:8081/--/unirse/ABCD-EFGH')).toBe('ABCD-EFGH');
    expect(parseInviteCode('cuentalo://contadores/123')).toBeNull();
  });
});
