import { router } from 'expo-router';

/** Abre el perfil de otra persona (desde cualquier lista: amigos, miembros, clasificaciones). */
export function openProfile(userId: string) {
  router.push({ pathname: '/usuario/[id]', params: { id: userId } });
}
