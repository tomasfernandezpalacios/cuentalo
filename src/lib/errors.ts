// Traduce los errores de Supabase a mensajes comprensibles en español.

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'El usuario o la contraseña no son correctos.',
  wrong_login: 'El usuario o la contraseña no son correctos.',
  otp_expired: 'El código no es correcto o ha caducado. Pide otro.',
  same_password: 'La contraseña nueva tiene que ser distinta de la anterior.',
  user_already_exists: 'Ya existe una cuenta con ese email.',
  email_exists: 'Ya existe una cuenta con ese email.',
  weak_password: 'La contraseña es demasiado débil.',
  email_not_confirmed: 'Tienes que confirmar tu email antes de entrar.',
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos.',
  signup_disabled: 'El registro está desactivado.',
  validation_failed: 'Revisa los datos introducidos.',
  username_taken: 'Ese nombre de usuario ya está en uso. Elige otro.',
};

const POSTGRES_MESSAGES: Record<string, string> = {
  '23505': 'Ese valor ya está en uso.',
  '23514': 'Algún dato no es válido.',
  '42501': 'No tienes permiso para hacer esto.',
  // PostgREST no encuentra la tabla, la columna o la función: falta aplicar una migración.
  '42703': 'La base de datos no está actualizada. Falta ejecutar una migración en Supabase.',
  PGRST204: 'La base de datos no está actualizada. Falta ejecutar una migración en Supabase.',
  PGRST202: 'La base de datos no está actualizada. Falta ejecutar una migración en Supabase.',
  PGRST205: 'La base de datos no está actualizada. Falta ejecutar una migración en Supabase.',
};

// Errores lanzados a propósito desde nuestras funciones SQL (raise exception '…').
const CUSTOM_MESSAGES: Record<string, string> = {
  invalid_invite_code: 'Ese código no corresponde a ningún grupo.',
  not_group_owner: 'Solo el líder del grupo puede hacer esto.',
  not_group_member: 'Solo los miembros del grupo pueden hacer esto.',
  not_shared_counter: 'Este contador no es de ningún grupo del que formes parte.',
  cannot_log_common: 'En este contador común solo suma o resta su administrador.',
  not_counter_manager: 'Solo el administrador de este contador puede hacer esto.',
  request_not_pending: 'Esa solicitud ya estaba respondida.',
  no_participants: 'Elige al menos una persona para el contador común.',
  folder_not_found: 'Esa carpeta ya no existe.',
  merge_needs_two: 'Elige al menos dos contadores para fusionar.',
  merge_same_group: 'No puedes fusionar dos contadores del mismo grupo.',
  cannot_log: 'No puedes registrar en este contador.',
  merge_invalid_counters: 'Alguno de esos contadores no se puede fusionar.',
  merge_two_groups: 'Solo puedes fusionar con un contador de grupo a la vez.',
  invalid_amount: 'Esa cantidad no es válida.',
  invalid_period: 'Ese periodo no es válido.',
  not_authenticated: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  not_common_counter: 'Este contador no es común.',
};

/** ¿Es un mensaje ya escrito para el usuario (no un código interno como «not_shared_counter»)? */
function isReadable(message: string): boolean {
  return !/^[a-z0-9_]+$/.test(message) && /[áéíóúñ ]/i.test(message);
}

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof message === 'string' && CUSTOM_MESSAGES[message]) return CUSTOM_MESSAGES[message];
    // raise exception con un texto en español (p. ej. «No eres el líder de este grupo.»).
    if (code === 'P0001' && typeof message === 'string' && isReadable(message)) return message;
    if (typeof code === 'string') {
      const known = AUTH_MESSAGES[code] ?? POSTGRES_MESSAGES[code];
      if (known) return known;
    }
    if (typeof message === 'string' && /network|fetch/i.test(message)) {
      return 'No hay conexión. Comprueba tu internet e inténtalo de nuevo.';
    }
  }
  return 'Ha ocurrido un error inesperado. Inténtalo de nuevo.';
}
