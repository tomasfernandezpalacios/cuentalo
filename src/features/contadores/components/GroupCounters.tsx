import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { fonts, useThemeColors } from '@/lib/theme';

import { useCounterList } from '../hooks';
import { useCounterActions } from '../useCounterActions';

import { CounterCard } from './CounterCard';

/** Contadores compartidos de un grupo, con los mismos botones rápidos que la lista de inicio. */
export function GroupCounters({ groupId }: { groupId: string }) {
  const colors = useThemeColors();
  const counters = useCounterList();
  const actions = useCounterActions();

  const groupCounters = (counters.data ?? []).filter(
    (c) => c.group_id === groupId && c.isActive && !c.archived,
  );

  function openCounter(id: string) {
    router.push({ pathname: '/contadores/[id]', params: { id } });
  }

  return (
    <View style={styles.container}>
      {counters.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : groupCounters.length === 0 ? (
        <Text style={[styles.detail, { color: colors.textMuted }]}>
          Aún no hay contadores compartidos. Crea uno: cada miembro sumará lo suyo y veréis la
          clasificación.
        </Text>
      ) : (
        groupCounters.map((counter) => (
          <CounterCard
            key={counter.id}
            counter={counter}
            onPress={() => openCounter(counter.id)}
            onAdd={(amount) => actions.add(counter, { amount, loggedAt: new Date(), note: null })}
            onRemoveOne={() => actions.subtractOne(counter)}
            onCustomAdd={() => openCounter(counter.id)}
          />
        ))
      )}
      {/* Con contadores, el + de la cabecera del grupo basta; sin ninguno, se ofrece aquí. */}
      {!counters.isPending && groupCounters.length === 0 ? (
        <AppButton
          title="Nuevo contador compartido"
          variant="secondary"
          onPress={() => router.push({ pathname: '/contadores/nuevo', params: { grupo: groupId } })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  detail: { fontSize: 14, fontFamily: fonts.detail },
});
