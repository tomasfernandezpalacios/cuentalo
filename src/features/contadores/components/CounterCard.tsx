import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatAmount, formatWithUnit } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

import type { CounterWithTotal } from '../api';

import { CounterAvatar } from './CounterAvatar';
import { TutorialTarget } from '@/features/tutorial/TutorialTarget';

import { QuickAddBar } from './QuickAddBar';

type Props = {
  counter: CounterWithTotal;
  onPress: () => void;
  onAdd: (amount: number) => void;
  onRemoveOne: () => void;
  /** Mantener pulsado el primer botón (+1) abre la cantidad personalizada. */
  onCustomAdd: () => void;
  /** Mantener pulsada la tarjeta (en la lista de inicio: entra en modo selección). */
  onLongPress?: () => void;
  /** Modo selección: en vez de los botones rápidos se ve si está elegida. */
  selectionMode?: boolean;
  selected?: boolean;
  /** Primera tarjeta de la lista: la que ilumina el tutorial (tarjeta y su primer botón). */
  tutorialTarget?: boolean;
};

/** Tarjeta de la lista: emoticono · nombre · botones rápidos y −1 · total. */
export function CounterCard({
  counter,
  onPress,
  onAdd,
  onRemoveOne,
  onCustomAdd,
  onLongPress,
  selectionMode = false,
  selected = false,
  tutorialTarget = false,
}: Props) {
  const colors = useThemeColors();
  return (
    <TutorialTarget id="tarjeta" enabled={tutorialTarget}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole={selectionMode ? 'checkbox' : 'button'}
        accessibilityState={selectionMode ? { checked: selected } : undefined}
        accessibilityLabel={`${counter.name}${counter.group ? `, del grupo ${counter.group.name}` : ''}: ${formatWithUnit(counter.displayTotal, counter.unit)}`}
        accessibilityHint={
          selectionMode ? undefined : 'Abre el contador. Mantén pulsado para seleccionar'
        }
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: selected ? colors.primarySoft : colors.surface,
            borderColor: selected ? colors.primary : colors.border,
            borderWidth: selected ? 2 : 1,
            opacity: counter.hidden ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <CounterAvatar emoji={counter.emoji} name={counter.name} size={42} />
        <View style={styles.name}>
          <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={2}>
            {counter.name}
          </Text>
          {counter.group || counter.hidden ? (
            <Text style={[styles.unit, { color: colors.textMuted }]} numberOfLines={1}>
              {[
                counter.linkedGroups.length > 0
                  ? `👥 ${counter.linkedGroups.map((g) => g.group.name).join(' · ')}`
                  : null,
                counter.is_common ? 'Común' : null,
                counter.hidden ? 'Oculto' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
        </View>

        {selectionMode ? (
          <Ionicons
            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={28}
            color={selected ? colors.primary : colors.textMuted}
          />
        ) : (
          <QuickAddBar
            compact
            unit={counter.unit}
            onAdd={onAdd}
            onRemoveOne={onRemoveOne}
            canRemove={counter.is_common ? counter.total >= 1 : counter.myGroupTotal >= 1}
            streak={
              counter.streak
                ? { days: counter.streak.current, todayDone: counter.streak.todayDone }
                : null
            }
            onLongPressAdd={onCustomAdd}
            tutorialTarget={tutorialTarget}
          />
        )}

        <View style={styles.totalBox}>
          <Text
            style={[styles.total, { color: colors.primary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.3}
          >
            {/* En un compartido la tarjeta muestra lo mío; el total del grupo está en el detalle. */}
            {formatAmount(counter.displayTotal)}
          </Text>
          {counter.unit ? (
            <Text style={[styles.unit, { color: colors.textMuted }]} numberOfLines={1}>
              {counter.unit}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </TutorialTarget>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  name: { flex: 1, gap: 2 },
  nameText: { fontSize: 17, fontFamily: fonts.title },
  totalBox: { alignItems: 'flex-end', minWidth: 36, maxWidth: 64 },
  total: { fontSize: 21, fontFamily: fonts.title },
  unit: { fontSize: 12, fontFamily: fonts.detail },
});
