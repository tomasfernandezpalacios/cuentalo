import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo, useLayoutEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedRef,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  displayFont,
  fonts,
  proseFont,
  screenTitleFont,
  shape,
  useThemeColors,
  type ThemeColors,
} from '@/lib/theme';

import {
  demoState,
  SCENES,
  TUTORIAL_COUNTER_NAME,
  type Scene,
  type StepId,
  type TargetId,
} from './steps';
import { demoGesture, registerTarget, unregisterTarget } from './store';

// Demostración fija de la app para el tutorial: las pantallas principales dibujadas con datos de
// ejemplo, siempre iguales. No usa la base de datos ni la navegación de verdad, y tapa la app
// entera: lo único que responde es lo que pide el paso (y solo a través del hueco del foco).

const HEADER = 64;
const TAB_BAR = 64;

/** Etiquetas para el lector de pantalla de lo que se puede tocar en la demostración. */
const LABELS: Partial<Record<TargetId, string>> = {
  'nuevo-contador': 'Nuevo contador',
  'crear-contador': 'Crear contador',
  sumar: 'Añadir 1',
  restar: 'Restar 1',
  tarjeta: `${TUTORIAL_COUNTER_NAME}. Mantén pulsado para seleccionar`,
  'tab-estadisticas': 'Estadísticas',
  'tab-social': 'Social',
};

/**
 * Elemento de la demostración que el tutorial puede iluminar. Con `gesture`, tocarlo (o
 * mantenerlo pulsado) cuenta como hacer el paso; cualquier otro toque no hace nada.
 */
function DemoTarget({
  id,
  gesture,
  style,
  children,
}: {
  id: TargetId;
  gesture?: 'tap' | 'hold';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const ref = useAnimatedRef<Animated.View>();
  useLayoutEffect(() => {
    registerTarget(id, ref);
    return () => unregisterTarget(id, ref);
  }, [id, ref]);
  return (
    <Animated.View ref={ref} collapsable={false} style={style}>
      {gesture ? (
        <Pressable
          onPress={gesture === 'tap' ? () => demoGesture(id, 'tap') : undefined}
          onLongPress={gesture === 'hold' ? () => demoGesture(id, 'hold') : undefined}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={LABELS[id]}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          {children}
        </Pressable>
      ) : (
        children
      )}
    </Animated.View>
  );
}

type Props = {
  /** Paso actual: decide lo que se ve (total del contador, modo selección). */
  stepId: StepId;
  /** Pantalla a la vista (la única que se puede tocar). */
  scene: Scene;
  /** Opacidad de cada pantalla (se funden en el hilo de la interfaz). */
  scenes: SharedValue<number>[];
};

/** Toda la demostración: las pantallas una encima de otra y la barra de pestañas. */
export const Demo = memo(function Demo({ stepId, scene, scenes }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { total, selecting } = demoState(stepId);
  const formIndex = SCENES.indexOf('form');
  const formScene = scenes[formIndex];
  const tabBarStyle = useAnimatedStyle(() => ({ opacity: 1 - (formScene?.value ?? 0) }));
  const activeTab = scene === 'stats' ? 1 : scene === 'social' ? 2 : 0;

  const screens: Record<Scene, ReactNode> = {
    'home-empty': <HomeScene colors={colors} empty total={0} selecting={false} />,
    form: <FormScene colors={colors} />,
    home: <HomeScene colors={colors} empty={false} total={total} selecting={selecting} />,
    stats: <StatsScene colors={colors} />,
    social: <SocialScene colors={colors} />,
  };

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
      // Se queda con cualquier toque que no sea de lo iluminado: la app de debajo no recibe nada.
      onStartShouldSetResponder={() => true}
    >
      {SCENES.map((name, index) => (
        <SceneLayer
          key={name}
          opacity={scenes[index]}
          active={name === scene}
          top={insets.top}
          bottom={name === 'form' ? insets.bottom : insets.bottom + TAB_BAR + 12}
        >
          {screens[name]}
        </SceneLayer>
      ))}
      <Animated.View
        pointerEvents={scene === 'form' ? 'none' : 'box-none'}
        style={[
          styles.tabBar,
          { backgroundColor: colors.surface, marginBottom: insets.bottom + 12 },
          tabBarStyle,
        ]}
      >
        <View style={styles.tabItems}>
          {/* Píldora de la pestaña activa (como en la barra de verdad). */}
          <View style={[styles.tabPill, { left: `${activeTab * 25}%` }]}>
            <View
              style={[
                styles.tabPillFill,
                { backgroundColor: colors.primarySoft, borderColor: colors.primary },
              ]}
            />
          </View>
          <TabIcon icon="add-circle-outline" active={activeTab === 0} colors={colors} />
          <DemoTarget id="tab-estadisticas" gesture="tap" style={styles.tab}>
            <TabIcon icon="bar-chart-outline" active={activeTab === 1} colors={colors} />
          </DemoTarget>
          <DemoTarget id="tab-social" gesture="tap" style={styles.tab}>
            <TabIcon icon="people-outline" active={activeTab === 2} colors={colors} />
          </DemoTarget>
          <TabIcon icon="person-circle-outline" active={false} colors={colors} />
        </View>
      </Animated.View>
    </View>
  );
});

function SceneLayer({
  opacity,
  active,
  top,
  bottom,
  children,
}: {
  opacity: SharedValue<number> | undefined;
  active: boolean;
  top: number;
  bottom: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({ opacity: opacity?.value ?? 0 }));
  return (
    <Animated.View
      pointerEvents={active ? 'box-none' : 'none'}
      style={[styles.scene, { paddingTop: top, bottom }, style]}
    >
      {children}
    </Animated.View>
  );
}

function TabIcon({
  icon,
  active,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.tab}>
      <Ionicons name={icon} size={24} color={active ? colors.primary : colors.textMuted} />
    </View>
  );
}

function Header({
  title,
  colors,
  left,
  right,
}: {
  title: string;
  colors: ThemeColors;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {left}
      <Text
        style={[screenTitleFont(28), styles.headerTitle, { color: colors.text }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}

function AddButton({ colors }: { colors: ThemeColors }) {
  return (
    <View style={[styles.addButton, { backgroundColor: colors.primary }]}>
      <MaterialCommunityIcons name="plus" size={32} color={colors.background} />
    </View>
  );
}

// --- Mis contadores -------------------------------------------------------------------------

function HomeScene({
  colors,
  empty,
  total,
  selecting,
}: {
  colors: ThemeColors;
  empty: boolean;
  total: number;
  selecting: boolean;
}) {
  const filters = <Ionicons name="options-outline" size={26} color={colors.primary} />;
  const header = selecting ? (
    <View style={styles.header}>
      <Ionicons name="close" size={26} color={colors.text} />
      <Text style={[styles.selectionTitle, { color: colors.text }]}>1 seleccionado</Text>
      <DemoTarget id="herramientas" style={styles.tools}>
        <Ionicons name="trash-outline" size={24} color={colors.primary} />
        <Ionicons name="folder-outline" size={24} color={colors.primary} />
        <Ionicons name="eye-off-outline" size={24} color={colors.primary} />
        <Ionicons name="create-outline" size={24} color={colors.primary} />
        <Ionicons name="git-merge-outline" size={24} color={colors.primary} />
      </DemoTarget>
    </View>
  ) : (
    <Header
      title="Mis contadores"
      colors={colors}
      right={
        <View style={styles.headerActions}>
          {filters}
          {empty ? (
            <DemoTarget id="nuevo-contador" gesture="tap">
              <AddButton colors={colors} />
            </DemoTarget>
          ) : (
            <AddButton colors={colors} />
          )}
        </View>
      }
    />
  );

  return (
    <>
      {header}
      {empty ? (
        <View style={styles.empty}>
          <Text style={[proseFont(17, 24), styles.centerText, { color: colors.textMuted }]}>
            Aún no tienes contadores.{'\n'}Crea el primero con el +.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          <DemoTarget id="tarjeta" gesture="hold">
            <View
              style={[
                styles.card,
                {
                  backgroundColor: selecting ? colors.primarySoft : colors.surface,
                  borderColor: selecting ? colors.primary : colors.border,
                  borderWidth: selecting ? 2 : 1,
                },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>M</Text>
              </View>
              <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>
                {TUTORIAL_COUNTER_NAME}
              </Text>
              {selecting ? (
                <Ionicons name="checkmark-circle" size={26} color={colors.primary} />
              ) : (
                <View style={styles.quick}>
                  <DemoTarget id="sumar" gesture="tap">
                    <View style={[styles.quickButton, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.quickText, { color: colors.onPrimary }]}>+1</Text>
                    </View>
                  </DemoTarget>
                  <DemoTarget id="restar" gesture="tap">
                    <View
                      style={[
                        styles.quickButton,
                        styles.quickOutline,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.quickText, { color: colors.text }]}>−1</Text>
                    </View>
                  </DemoTarget>
                </View>
              )}
              <View
                style={[
                  styles.totalBadge,
                  { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                ]}
              >
                <Text style={[styles.totalText, { color: colors.primary }]}>{total}</Text>
              </View>
            </View>
          </DemoTarget>
        </View>
      )}
    </>
  );
}

// --- Nuevo contador -------------------------------------------------------------------------

function FormScene({ colors }: { colors: ThemeColors }) {
  return (
    <>
      <Header
        title="Nuevo contador"
        colors={colors}
        left={<Ionicons name="arrow-back" size={26} color={colors.text} style={styles.back} />}
      />
      <View style={styles.form}>
        <DemoTarget id="nombre" style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Nombre</Text>
          <View
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.primary }]}
          >
            <Text style={[styles.inputText, { color: colors.text }]}>{TUTORIAL_COUNTER_NAME}</Text>
          </View>
        </DemoTarget>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Unidad (opcional)</Text>
          <View
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.inputText, { color: colors.textMuted }]}>
              ej. cervezas, libros, km
            </Text>
          </View>
        </View>
        <View style={styles.formSpacer} />
        <DemoTarget id="crear-contador" gesture="tap">
          <View style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Crear contador</Text>
          </View>
        </DemoTarget>
      </View>
    </>
  );
}

// --- Estadísticas ---------------------------------------------------------------------------

/** Alturas fijas de las barras de ejemplo (lunes → domingo). */
const BARS = [0.35, 0.6, 0.45, 0.8, 0.55, 0.9, 0.3];
const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function StatsScene({ colors }: { colors: ThemeColors }) {
  return (
    <>
      <Header
        title="Estadísticas"
        colors={colors}
        right={
          <DemoTarget id="racha">
            <View style={[styles.streak, { backgroundColor: colors.surface }]}>
              <Ionicons name="flame" size={20} color={colors.flame} />
              <Text style={[styles.streakText, { color: colors.flame }]}>1</Text>
            </View>
          </DemoTarget>
        }
      />
      <DemoTarget id="pantalla-estadisticas" style={styles.page}>
        <View style={styles.chips}>
          {['Semana', 'Mes', 'Año', 'Siempre'].map((label, i) => (
            <View
              key={label}
              style={[
                styles.chip,
                {
                  backgroundColor: i === 0 ? colors.primarySoft : colors.surface,
                  borderColor: i === 0 ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: i === 0 ? colors.primary : colors.text }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View
          style={[
            styles.chartCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.bars}>
            {BARS.map((height, i) => (
              <View key={DAYS[i]} style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    { height: `${height * 100}%`, backgroundColor: colors.primary },
                  ]}
                />
                <Text style={[styles.barLabel, { color: colors.textMuted }]}>{DAYS[i]}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Toca la gráfica para ampliarla
          </Text>
        </View>
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.rowName, { color: colors.text }]}>{TUTORIAL_COUNTER_NAME}</Text>
          <Text style={[styles.rowValue, { color: colors.primary }]}>24</Text>
        </View>
      </DemoTarget>
    </>
  );
}

// --- Social ---------------------------------------------------------------------------------

const DEMO_FRIENDS = [
  { name: 'Lucía', streak: 12 },
  { name: 'Marcos', streak: 5 },
  { name: 'Irene', streak: 3 },
];

function SocialScene({ colors }: { colors: ThemeColors }) {
  return (
    <>
      <Header
        title="Social"
        colors={colors}
        right={
          <View style={styles.headerActions}>
            <Ionicons name="key-outline" size={24} color={colors.primary} />
            <Ionicons name="mail-outline" size={24} color={colors.primary} />
            <AddButton colors={colors} />
          </View>
        }
      />
      <DemoTarget id="pantalla-social" style={styles.page}>
        <View style={[styles.segment, { backgroundColor: colors.surface }]}>
          <View
            style={[
              styles.segmentItem,
              { backgroundColor: colors.primarySoft, borderColor: colors.primary },
            ]}
          >
            <Text style={[styles.chipText, { color: colors.primary }]}>Grupos</Text>
          </View>
          <View style={styles.segmentItem}>
            <Text style={[styles.chipText, { color: colors.textMuted }]}>Amigos</Text>
          </View>
        </View>
        <View
          style={[
            styles.groupCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.groupIcon, { backgroundColor: colors.primarySoft }]}>
            <Text style={styles.groupEmoji}>🏋️</Text>
          </View>
          <View style={styles.groupText}>
            <Text style={[styles.rowName, { color: colors.text }]}>Gimnasio</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              4 miembros · 3 contadores
            </Text>
          </View>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Clasificación</Text>
        {DEMO_FRIENDS.map((friend, i) => (
          <View
            key={friend.name}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.position, { color: colors.primary }]}>{i + 1}</Text>
            <Text style={[styles.rowName, { color: colors.text }]}>{friend.name}</Text>
            <Ionicons name="flame" size={16} color={colors.flame} />
            <Text style={[styles.rowValue, { color: colors.flame }]}>{friend.streak}</Text>
          </View>
        ))}
      </DemoTarget>
    </>
  );
}

const styles = StyleSheet.create({
  scene: { position: 'absolute', left: 0, right: 0, top: 0 },
  header: {
    height: HEADER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  headerTitle: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectionTitle: { flex: 1, fontSize: 18, fontFamily: fonts.title },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 2 },
  back: { marginRight: -4 },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerText: { textAlign: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: shape.card,
    gap: 8,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontFamily: fonts.title },
  cardName: { flex: 1, fontSize: 17, fontFamily: fonts.title },
  quick: { flexDirection: 'row', gap: 6 },
  quickButton: {
    minWidth: 44,
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickOutline: { borderWidth: 1 },
  quickText: { fontSize: 17, fontFamily: fonts.title },
  totalBadge: {
    height: 40,
    minWidth: 52,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalText: { ...displayFont(26), lineHeight: 30, includeFontPadding: false },
  form: { flex: 1, padding: 16, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 15, fontFamily: fonts.title },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputText: { fontSize: 16, fontFamily: fonts.detail },
  formSpacer: { flex: 1 },
  primaryButton: {
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 17, fontFamily: fonts.title },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
  },
  streakText: { fontSize: 17, fontFamily: fonts.title },
  page: { flex: 1, paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontFamily: fonts.title },
  chartCard: { borderRadius: shape.card, borderWidth: 1, padding: 14, gap: 10 },
  bars: { height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  barColumn: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  bar: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 12, fontFamily: fonts.detail },
  hint: { fontSize: 13, fontFamily: fonts.detail },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
  },
  rowName: { flex: 1, fontSize: 16, fontFamily: fonts.title },
  rowValue: { fontSize: 18, fontFamily: fonts.title },
  position: { width: 18, fontSize: 16, fontFamily: fonts.title },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  segmentItem: {
    flex: 1,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: shape.card,
    borderWidth: 1,
  },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupEmoji: { fontSize: 26 },
  groupText: { flex: 1, gap: 2 },
  sectionTitle: { fontSize: 18, fontFamily: fonts.title, marginTop: 4 },
  tabBar: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 0,
    height: TAB_BAR,
    borderRadius: 999,
    paddingHorizontal: 8,
  },
  tabItems: { flex: 1, flexDirection: 'row' },
  tabPill: { position: 'absolute', top: 8, bottom: 8, width: '25%', paddingHorizontal: 4 },
  tabPillFill: { flex: 1, borderRadius: 999, borderWidth: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
