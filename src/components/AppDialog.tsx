import Ionicons from '@expo/vector-icons/Ionicons';
import { useSyncExternalStore, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { proseFont, titleFont, useThemeColors } from '@/lib/theme';

import { AppButton } from './AppButton';

// Avisos con el estilo de la app, en lugar de los del sistema (Alert.alert). Misma forma de
// usarlos: appAlert(título, mensaje, botones). Los que tienen un botón destructivo (o
// { warning: true }) muestran un icono de advertencia en un círculo rojo.

export type DialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type Dialog = {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  warning: boolean;
  /** Imagen arriba (p. ej. la foto de un amigo en su menú); va en lugar de la advertencia. */
  image?: ReactNode;
};

let queue: Dialog[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Muestra un aviso. Igual que Alert.alert; sin botones, pone «Aceptar». */
export function appAlert(
  title: string,
  message?: string,
  buttons: DialogButton[] = [{ text: 'Aceptar' }],
  options: { warning?: boolean; image?: ReactNode } = {},
) {
  // Con imagen propia no sale la advertencia (un menú no es una acción peligrosa en sí).
  const warning =
    options.image !== undefined
      ? false
      : (options.warning ?? buttons.some((b) => b.style === 'destructive'));
  queue = [...queue, { id: nextId++, title, message, buttons, warning, image: options.image }];
  emit();
}

function close(dialog: Dialog, button?: DialogButton) {
  queue = queue.filter((d) => d.id !== dialog.id);
  emit();
  // Se ejecuta después de cerrar, así un botón puede abrir otro aviso (p. ej. «¿Seguro?»).
  button?.onPress?.();
}

/** Se monta una vez en el layout raíz y muestra el primer aviso de la cola. */
export function DialogHost() {
  const colors = useThemeColors();
  const dialog = useSyncExternalStore(subscribe, () => queue[0]);
  if (!dialog) return null;

  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  // Con dos botones van en fila (el de cancelar a la izquierda); con más, uno debajo de otro.
  const inRow = dialog.buttons.length <= 2;
  const ordered = inRow
    ? [...dialog.buttons].sort(
        (a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel'),
      )
    : dialog.buttons;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => close(dialog, cancel)}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={cancel ? () => close(dialog, cancel) : undefined}
          accessibilityLabel={cancel ? cancel.text : undefined}
        />
        <View
          style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
          accessibilityViewIsModal
        >
          {dialog.image ? <View style={styles.image}>{dialog.image}</View> : null}
          {dialog.warning ? (
            <View
              style={[styles.icon, { backgroundColor: colors.danger }]}
              accessibilityLabel="Advertencia"
            >
              <Ionicons name="warning" size={26} color="#FFFFFF" />
            </View>
          ) : null}
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {dialog.title}
          </Text>
          {dialog.message ? (
            <Text style={[styles.message, { color: colors.textMuted }]}>{dialog.message}</Text>
          ) : null}
          <View style={inRow ? styles.row : styles.column}>
            {ordered.map((button) => (
              <AppButton
                key={button.text}
                title={button.text}
                variant={
                  button.style === 'destructive'
                    ? 'danger'
                    : button.style === 'cancel'
                      ? 'secondary'
                      : 'primary'
                }
                onPress={() => close(dialog, button)}
                style={inRow ? styles.flex : undefined}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: { borderRadius: 22, borderWidth: 1, padding: 22, gap: 12, alignItems: 'center' },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  image: { marginBottom: 2 },
  title: { ...titleFont(20), textAlign: 'center' },
  message: { ...proseFont(15, 21), textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 6 },
  column: { gap: 10, alignSelf: 'stretch', marginTop: 6 },
  flex: { flex: 1 },
});
