import { router } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';

import { useAddEntry, useCounterList, useRemoveOne } from '../hooks';

import { CounterCard } from './CounterCard';

function showError(error: unknown) {
  Alert.alert('No se ha podido guardar', getErrorMessage(error));
}

/** Contadores compartidos de un grupo, con los mismos botones rápidos que la lista de inicio. */
export function GroupCounters({ groupId }: { groupId: string }) {
  const colors = useThemeColors();
  const counters = useCounterList();
  const addEntry = useAddEntry();
  const removeOne = useRemoveOne();

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
            onAdd={(amount) =>
              addEntry.mutate(
                { counterId: counter.id, input: { amount, loggedAt: new Date(), note: null } },
                { onError: showError },
              )
            }
            onRemoveOne={() => removeOne.mutate(counter.id, { onError: showError })}
            onCustomAdd={() => openCounter(counter.id)}
          />
        ))
      )}
      <AppButton
        title="Nuevo contador compartido"
        variant="secondary"
        onPress={() => router.push({ pathname: '/contadores/nuevo', params: { grupo: groupId } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  detail: { fontSize: 14, fontFamily: fonts.detail },
});
