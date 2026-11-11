import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/components/AppButton';
import { hexToHsv, type Hsv, hsvToHex, normalizeHex } from '@/lib/color';
import {
  customAccentColors,
  fonts,
  proseFont,
  titleFont,
  useColorMode,
  useThemeColors,
} from '@/lib/theme';

type Props = {
  initial: string;
  onCancel: () => void;
  onDone: (hex: string) => void;
};

const HUES = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Zona que se toca o arrastra para elegir un valor: avisa con la posición del dedo de 0 a 1 en
 * cada eje. Sus hijos no reciben toques, así `locationX/Y` son relativos a la zona.
 */
function TouchArea({
  onPick,
  style,
  children,
}: {
  onPick: (x: number, y: number) => void;
  style: object;
  children: React.ReactNode;
}) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const pick = (e: GestureResponderEvent) =>
    onPick(
      clamp01(e.nativeEvent.locationX / size.width),
      clamp01(e.nativeEvent.locationY / size.height),
    );
  return (
    <View
      style={style}
      onLayout={(e: LayoutChangeEvent) => setSize(e.nativeEvent.layout)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={pick}
      onResponderMove={pick}
      onResponderTerminationRequest={() => false}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {children}
      </View>
    </View>
  );
}

/**
 * Recuadro para elegir un color a mano: un cuadro de saturación (horizontal) y brillo
 * (vertical), una barra de tonos y el código #RRGGBB, con la vista previa del botón.
 */
export function ColorPickerDialog({ initial, onCancel, onDone }: Props) {
  const colors = useThemeColors();
  const mode = useColorMode();
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(normalizeHex(initial) ?? '#5B4BDB'));
  const [text, setText] = useState(() => hsvToHex(hsv));
  const hex = hsvToHex(hsv);
  // Como quedará en la app (ajustado para que el texto de los botones se lea bien).
  const preview = customAccentColors(hex)[mode];

  function update(next: Hsv) {
    setHsv(next);
    setText(hsvToHex(next));
  }

  function typeHex(value: string) {
    setText(value);
    const valid = normalizeHex(value);
    if (valid) setHsv(hexToHsv(valid));
  }

  const marker = (left: number, top: number) => ({
    left: `${left * 100}%` as const,
    top: `${top * 100}%` as const,
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Cerrar">
        {/* El recuadro no se cierra al tocarlo por dentro. */}
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.text }]}>Color personalizado</Text>
          {/* Sobre el fondo del modo actual, un color parecido a él apenas se distingue. */}
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {mode === 'dark'
              ? 'Estás en el tema oscuro: no escojas un color muy oscuro.'
              : 'Estás en el tema claro: no escojas un color muy claro.'}
          </Text>

          <TouchArea style={styles.square} onPick={(x, y) => update({ ...hsv, s: x, v: 1 - y })}>
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }) },
              ]}
            />
            <LinearGradient
              colors={['#FFFFFF', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient colors={['rgba(0,0,0,0)', '#000000']} style={StyleSheet.absoluteFill} />
            <View style={[styles.marker, marker(hsv.s, 1 - hsv.v), { backgroundColor: hex }]} />
          </TouchArea>

          <TouchArea style={styles.hueBar} onPick={(x) => update({ ...hsv, h: x * 359.9 })}>
            <LinearGradient
              colors={HUES as unknown as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, styles.hueGradient]}
            />
            <View
              style={[
                styles.hueMarker,
                {
                  left: `${(hsv.h / 360) * 100}%`,
                  backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }),
                },
              ]}
            />
          </TouchArea>

          <View style={styles.row}>
            <TextInput
              value={text}
              onChangeText={typeHex}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              accessibilityLabel="Código del color"
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: normalizeHex(text) ? colors.border : colors.danger,
                  backgroundColor: colors.background,
                },
              ]}
            />
            {/* Vista previa: un botón y un fondo suave con el color tal como saldrán. */}
            <View style={[styles.previewButton, { backgroundColor: preview.primary }]}>
              <Text style={[styles.previewText, { color: colors.onPrimary }]}>Botón</Text>
            </View>
            <View style={[styles.previewSoft, { backgroundColor: preview.primarySoft }]}>
              <Text style={[styles.previewText, { color: preview.primary }]}>Detalle</Text>
            </View>
          </View>
          {preview.primary !== hex ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Se ajusta un poco para que el texto de los botones se lea bien en este modo.
            </Text>
          ) : null}

          <View style={styles.actions}>
            <AppButton
              title="Cancelar"
              variant="secondary"
              onPress={onCancel}
              style={styles.flex}
            />
            <AppButton title="Usar color" onPress={() => onDone(hex)} style={styles.flex} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  card: { borderRadius: 20, padding: 18, gap: 14 },
  title: { ...titleFont(18) },
  square: { height: 200, borderRadius: 12, overflow: 'hidden' },
  marker: {
    position: 'absolute',
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  hueBar: { height: 28, justifyContent: 'center' },
  hueGradient: { borderRadius: 14 },
  hueMarker: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    letterSpacing: 1,
  },
  previewButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  previewSoft: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  previewText: { fontSize: 14, fontFamily: fonts.title },
  hint: { ...proseFont(13) },
  actions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
