import { useEffect, useState, useSyncExternalStore } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, inverseColors, isCinema, proseFont, useThemeColors } from '@/lib/theme';

// Aviso pequeño abajo con un botón «Deshacer» (p. ej. «+1 en Cafés · Deshacer»). Uno a la vez:
// uno nuevo sustituye al anterior. Desaparece solo a los pocos segundos.

type Toast = { id: number; text: string; onUndo: () => void };

const VISIBLE_MS = 4500;
let current: Toast | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function hide() {
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  emit();
}

/** Enseña el aviso con «Deshacer». */
export function showUndoToast(text: string, onUndo: () => void) {
  if (timer) clearTimeout(timer);
  current = { id: nextId++, text, onUndo };
  timer = setTimeout(hide, VISIBLE_MS);
  emit();
}

/** Se monta una vez en el layout raíz. */
export function UndoToastHost() {
  const toast = useSyncExternalStore(subscribe, () => current);
  if (!toast) return null;
  return <ToastView key={toast.id} toast={toast} />;
}

function ToastView({ toast }: { toast: Toast }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [appear] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [appear]);

  const inverse = inverseColors(colors);
  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom: insets.bottom + 64 }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            backgroundColor: inverse.backgroundColor,
            borderColor: inverse.borderColor,
            borderWidth: 1,
            opacity: appear,
            transform: [
              { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            ],
          },
        ]}
      >
        <Text style={[styles.text, { color: inverse.color }]} numberOfLines={2}>
          {toast.text}
        </Text>
        <Pressable
          onPress={() => {
            hide();
            toast.onUndo();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Deshacer: ${toast.text}`}
          hitSlop={10}
          style={styles.button}
        >
          <Text style={[styles.undo, { color: isCinema ? colors.primary : colors.primarySoft }]}>
            Deshacer
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 900 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 14,
    alignSelf: 'stretch',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  text: { flex: 1, ...proseFont(15) },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  undo: { fontSize: 15, fontFamily: fonts.title },
});
