import Ionicons from '@expo/vector-icons/Ionicons';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  type GestureResponderEvent,
  Image,
  Modal,
  PanResponder,
  type PanResponderGestureState,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { getErrorMessage } from '@/lib/errors';
import {
  clampView,
  cropRect,
  displayScale,
  type ImageDims,
  type View as Pose,
} from '@/lib/photoCrop';
import { imageSize, localCopy, type PickedPhoto } from '@/lib/photos';
import { fonts, useThemeColors } from '@/lib/theme';

type Props = {
  /** La foto a editar: local o el enlace de la guardada. */
  uri: string;
  /** Marco redondo (foto de perfil) o cuadrado con esquinas (grupo). */
  round?: boolean;
  onCancel: () => void;
  onDone: (photo: PickedPhoto) => void;
};

const OUTPUT_SIZE = 512;

function touchDistance(event: GestureResponderEvent): number {
  const [a, b] = event.nativeEvent.touches;
  if (!a || !b) return 0;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

/**
 * Gesto del editor: un dedo mueve la foto y dos la amplían o reducen. Guarda su propio estado
 * (fuera de React) y avisa con onChange; `configure` le dice el tamaño de imagen y marco.
 */
function createPanZoom(onChange: (pose: Pose) => void) {
  let pose: Pose = { zoom: 1, x: 0, y: 0 };
  let image: ImageDims = { width: 1, height: 1 };
  let frame = 1;
  let start = { fingers: 0, distance: 0, pose, dx: 0, dy: 0 };

  const begin = (e: GestureResponderEvent, g: PanResponderGestureState) => {
    start = {
      fingers: e.nativeEvent.touches.length,
      distance: touchDistance(e),
      pose,
      dx: g.dx,
      dy: g.dy,
    };
  };
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: begin,
    onPanResponderMove: (e, g) => {
      // Si cambia el número de dedos, se toma la posición actual como nuevo punto de partida.
      if (e.nativeEvent.touches.length !== start.fingers) return begin(e, g);
      const zoom =
        start.fingers >= 2 && start.distance > 0
          ? (start.pose.zoom * touchDistance(e)) / start.distance
          : start.pose.zoom;
      pose = clampView(image, frame, {
        zoom,
        x: start.pose.x + (g.dx - start.dx),
        y: start.pose.y + (g.dy - start.dy),
      });
      onChange(pose);
    },
    onPanResponderTerminationRequest: () => false,
  });
  return {
    panHandlers: responder.panHandlers,
    configure: (dims: ImageDims, size: number, value: Pose) => {
      image = dims;
      frame = size;
      pose = value;
    },
  };
}

/** Editar una foto: moverla, ampliarla y girarla dentro del marco, y guardar el recorte. */
export function PhotoEditor({ uri, round = false, onCancel, onDone }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const frame = Math.min(width - 32, 380);
  const [source, setSource] = useState<{ uri: string; dims: ImageDims } | null>(null);
  const [pose, setPose] = useState<Pose>({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [gesture] = useState(() => createPanZoom(setPose));

  // La foto en el móvil (la guardada se descarga) y su tamaño.
  useEffect(() => {
    let alive = true;
    localCopy(uri)
      .then(async (local) => ({ uri: local, dims: await imageSize(local) }))
      .then((loaded) => alive && setSource(loaded))
      .catch((e: unknown) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [uri]);

  useEffect(() => {
    if (source) gesture.configure(source.dims, frame, pose);
  }, [gesture, source, frame, pose]);

  async function rotate() {
    if (!source) return;
    setBusy(true);
    try {
      const image = await ImageManipulator.manipulate(source.uri).rotate(90).renderAsync();
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
      setSource({ uri: saved.uri, dims: { width: saved.width, height: saved.height } });
      setPose({ zoom: 1, x: 0, y: 0 });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!source) return;
    setBusy(true);
    try {
      const rect = cropRect(source.dims, frame, pose);
      const context = ImageManipulator.manipulate(source.uri).crop(rect);
      if (rect.width > OUTPUT_SIZE) context.resize({ width: OUTPUT_SIZE, height: OUTPUT_SIZE });
      const image = await context.renderAsync();
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      if (!saved.base64) throw new Error('Sin datos de imagen');
      onDone({ uri: saved.uri, base64: saved.base64, mimeType: 'image/jpeg' });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  const scale = source ? displayScale(source.dims, frame, pose.zoom) : 1;
  const shown = source
    ? { width: source.dims.width * scale, height: source.dims.height * scale }
    : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View
        style={[
          styles.screen,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Volver sin guardar"
            hitSlop={10}
            style={styles.back}
          >
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Editar foto</Text>
          <Pressable
            onPress={rotate}
            disabled={!source || busy}
            accessibilityRole="button"
            accessibilityLabel="Girar 90 grados"
            hitSlop={6}
            style={({ pressed }) => [
              styles.rotate,
              { backgroundColor: colors.primarySoft, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="refresh" size={22} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.center}>
          <View
            style={[styles.frame, { width: frame, height: frame, backgroundColor: colors.surface }]}
            {...gesture.panHandlers}
          >
            {source && shown ? (
              <Image
                source={{ uri: source.uri }}
                style={{
                  position: 'absolute',
                  width: shown.width,
                  height: shown.height,
                  left: (frame - shown.width) / 2 + pose.x,
                  top: (frame - shown.height) / 2 + pose.y,
                }}
              />
            ) : error ? null : (
              <ActivityIndicator color={colors.primary} />
            )}
            {/* Guía de lo que se verá: el círculo de la foto de perfil o el cuadrado del grupo. */}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.guide,
                { borderColor: colors.background, borderRadius: round ? frame / 2 : 18 },
              ]}
            />
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Arrastra para mover la foto y pellizca con dos dedos para ampliarla o reducirla.
          </Text>
          {error ? (
            <Text style={[styles.hint, { color: colors.danger }]}>{getErrorMessage(error)}</Text>
          ) : null}
        </View>

        <AppButton title="Hecho" onPress={save} loading={busy} disabled={!source} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { flex: 1, fontSize: 20, fontFamily: fonts.title },
  rotate: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  guide: { borderWidth: 3 },
  hint: { fontSize: 14, fontFamily: fonts.detail, textAlign: 'center' },
});
