// Traduce los errores de Supabase a mensajes comprensibles en español.

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email o contraseña incorrectos.',
  user_already_exists: 'Ya existe una cuenta con ese email.',
  email_exists: 'Ya existe una cuenta con ese email.',
  weak_password: 'La contraseña es demasiado débil.',
  email_not_confirmed: 'Tienes que confirmar tu email antes de entrar.',
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos.',
  signup_disabled: 'El registro está desactivado.',
  validation_failed: 'Revisa los datos introducidos.',
  username_taken: 'Ese nombre de usuario ya está cogido.',
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
  not_group_owner: 'Solo el administrador del grupo puede hacer esto.',
  not_shared_counter: 'Este contador no es de ningún grupo del que formes parte.',
  cannot_log_common: 'Solo los miembros del grupo pueden registrar en este contador.',
  not_counter_manager:
    'Solo el creador del contador o el administrador del grupo pueden cambiarlo.',
  no_participants: 'Elige al menos una persona para el contador común.',
  folder_not_found: 'Esa carpeta ya no existe.',
};

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof message === 'string' && CUSTOM_MESSAGES[message]) return CUSTOM_MESSAGES[message];
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
