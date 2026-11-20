import { useEffect } from 'react';

import { appAlert } from '@/components/AppDialog';
import { useStreak } from '@/features/estadisticas/api';
import { localToday } from '@/features/estadisticas/periods';
import { shieldsToUse } from '@/features/estadisticas/streaks';

import { spendShields, useProgress } from './demoStore';

/**
 * Protector de racha automático (petición del usuario): si ayer no registraste nada y tienes
 * protectores, se gasta uno por cada día sin nada y la racha sigue viva; en el calendario esos
 * días salen con un escudo amarillo. Se monta una vez en las pestañas. PRUEBA: los protectores
 * viven en memoria (`demoStore.ts`) hasta que se guarden en Supabase.
 */
export function useAutoShields() {
  const streak = useStreak();
  const { shields, shieldedDays } = useProgress();
  const days = streak.data?.days;

  useEffect(() => {
    if (!days) return;
    const toUse = shieldsToUse(days, shieldedDays, shields, localToday());
    if (toUse.length === 0) return;
    spendShields(toUse);
    appAlert(
      toUse.length === 1 ? 'Protector de racha usado' : `${toUse.length} protectores usados`,
      toUse.length === 1
        ? 'Ayer no registraste nada, pero un protector ha salvado tu racha. Registra algo hoy para seguir.'
        : 'Llevabas días sin registrar, pero tus protectores han salvado tu racha. Registra algo hoy para seguir.',
    );
  }, [days, shields, shieldedDays]);
}
