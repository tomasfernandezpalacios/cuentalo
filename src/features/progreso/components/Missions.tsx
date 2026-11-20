import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type ComponentRef, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Section } from '@/components/Section';
import { fonts, shape, useThemeColors } from '@/lib/theme';

import { COIN_FLIGHT_MS } from '../coinBurst';
import { claimMission, useProgress, type ClaimResult } from '../demoStore';
import { celebrateLevelUp } from '../levelUp';
import { missionStatus, sortMissions, type Mission, type MissionKind } from '../model';
import { ProgressBar, Reward } from './Bits';

type IconName = ComponentProps<typeof Ionicons>['name'];

const GROUPS: { kind: MissionKind; title: string }[] = [
  { kind: 'hoy', title: 'Hoy' },
  { kind: 'semana', title: 'Esta semana' },
  { kind: 'logro', title: 'Logros' },
];

/** Las misiones en tres grupos (hoy, esta semana y logros). */
export function Missions() {
  const { missions } = useProgress();
  return (
    <>
      {GROUPS.map((group) => {
        const list = sortMissions(missions.filter((m) => m.kind === group.kind));
        if (list.length === 0) return null;
        return (
          <Section key={group.kind} title={group.title}>
            <View style={styles.list}>
              {list.map((mission) => (
                <MissionRow key={mission.id} mission={mission} />
              ))}
            </View>
          </Section>
        );
      })}
    </>
  );
}

/** Si al recoger has subido de nivel, lo celebra a lo grande cuando ya han llegado las monedas. */
function announceLevels(result: ClaimResult | null) {
  const to = result?.levels[result.levels.length - 1];
  if (!result || to === undefined) return;
  setTimeout(
    () =>
      celebrateLevelUp({
        from: result.from,
        to,
        coins: result.levelCoins,
        bonusCoins: result.bonusCoins,
        shields: result.shields,
        gifts: result.gifts,
      }),
    COIN_FLIGHT_MS + 300,
  );
}

/**
 * Una misión: icono, título, premio y barra de progreso. Cumplida, el botón «Recoger»; recogida,
 * apagada y con una marca.
 */
function MissionRow({ mission }: { mission: Mission }) {
  const colors = useThemeColors();
  const status = missionStatus(mission);
  const ready = status === 'lista';
  const claimed = status === 'recogida';
  const button = useRef<ComponentRef<typeof View>>(null);
  // Las monedas salen volando desde el botón «Recoger».
  const onClaim = () => {
    if (!button.current) return announceLevels(claimMission(mission.id));
    button.current.measureInWindow((x, y, width, height) =>
      announceLevels(claimMission(mission.id, { x: x + width / 2, y: y + height / 2 })),
    );
  };
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: ready ? colors.primarySoft : colors.surface,
          borderColor: ready ? colors.primary : colors.border,
          opacity: claimed ? 0.55 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.elevated }]}>
        <Ionicons
          name={(claimed ? 'checkmark' : mission.icon) as IconName}
          size={20}
          color={ready || claimed ? colors.primary : colors.text}
        />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.text }]}>{mission.title}</Text>
        <Reward xp={mission.xp} coins={mission.coins} muted={claimed} />
        {status === 'en-curso' ? (
          <View style={styles.progress}>
            <View style={styles.bar}>
              <ProgressBar fraction={mission.progress / mission.goal} height={6} />
            </View>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {`${mission.progress}/${mission.goal}`}
            </Text>
          </View>
        ) : null}
      </View>
      {ready ? (
        <View ref={button} collapsable={false}>
          <AppButton title="Recoger" small onPress={onClaim} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: shape.card - 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.title, fontSize: 15 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  bar: { flex: 1 },
  count: { fontFamily: fonts.detail, fontSize: 12 },
});
