import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { LoadingView } from '@/components/StateViews';
import { useUserId } from '@/features/auth/AuthProvider';
import type { Notice } from '@/features/social/api';
import { PersonRow } from '@/features/social/components/PersonRow';
import {
  useAcceptInvitation,
  useDecideCounterRequest,
  useFriendships,
  useMarkNoticesRead,
  useMyGroups,
  useNotices,
  usePendingCounterRequests,
  useRemoveMember,
  useRespondFriendRequest,
} from '@/features/social/hooks';
import { getErrorMessage } from '@/lib/errors';
import { formatAmount, formatDateTime } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

function showError(error: unknown) {
  appAlert('Error', getErrorMessage(error));
}

function change(amount: number | null): string {
  if (amount === null) return '';
  return amount > 0 ? `+${formatAmount(amount)}` : `−${formatAmount(-amount)}`;
}

/** Texto de cada aviso. */
function noticeText(n: Notice): string {
  const who = n.actor?.display_name ?? 'Alguien';
  const counter = n.counter_name ? `«${n.counter_name}»` : 'un contador';
  const group = n.group_name ? ` (${n.group_name})` : '';
  switch (n.kind) {
    case 'friend_accepted':
      return `${who} ha aceptado tu solicitud de amistad.`;
    case 'request_approved':
      return `${who} ha aceptado tu solicitud: ${change(n.amount)} en ${counter}${group}.`;
    case 'request_rejected':
      return `${who} ha rechazado tu solicitud de ${change(n.amount)} en ${counter}${group}.`;
    case 'counter_deleted':
      return `${who} ha quitado ${counter} del grupo${group}. Tus registros siguen en tu contador personal.`;
    case 'group_deleted':
      return `${who} ha eliminado el grupo${group}. Tus registros de ${counter} siguen en tu contador personal.`;
  }
}

type Tab = 'pending' | 'notices' | 'friends';

/**
 * Buzón en tres pestañas (barra fina arriba): lo que espera una respuesta tuya, tus avisos y el
 * historial de solicitudes de amistad.
 */
export default function InboxScreen() {
  const colors = useThemeColors();
  const userId = useUserId();
  const friendships = useFriendships();
  const groups = useMyGroups();
  const requests = usePendingCounterRequests();
  const notices = useNotices();
  const respond = useRespondFriendRequest();
  const accept = useAcceptInvitation();
  const decline = useRemoveMember();
  const decide = useDecideCounterRequest();
  const markRead = useMarkNoticesRead();
  // null = la pestaña por defecto (Pendientes si hay algo; si no, Avisos si hay sin leer).
  const [chosenTab, setChosenTab] = useState<Tab | null>(null);

  const unread = (notices.data ?? []).filter((n) => n.read_at === null).length;
  const pendingTotal =
    (friendships.data ?? []).filter((f) => f.status === 'pending' && f.direction === 'incoming')
      .length +
    (groups.data ?? []).filter((g) => g.status === 'invited').length +
    (requests.data ?? []).length;
  const tab: Tab = chosenTab ?? (pendingTotal === 0 && unread > 0 ? 'notices' : 'pending');

  // Los avisos se dan por leídos al ver su pestaña (los pendientes siguen hasta responderlos).
  useEffect(() => {
    if (tab === 'notices' && unread > 0) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar pestaña o número
  }, [tab, unread]);

  if (friendships.isPending || groups.isPending || requests.isPending || notices.isPending) {
    return <LoadingView />;
  }

  const allFriendships = friendships.data ?? [];
  const incoming = allFriendships.filter(
    (f) => f.status === 'pending' && f.direction === 'incoming',
  );
  const invitations = (groups.data ?? []).filter((g) => g.status === 'invited');
  const counterRequests = requests.data ?? [];
  const history = allFriendships.filter(
    (f) => !(f.status === 'pending' && f.direction === 'incoming'),
  );

  function refresh() {
    friendships.refetch();
    groups.refetch();
    requests.refetch();
    notices.refetch();
  }

  const tabs: { value: Tab; label: string; dot: boolean }[] = [
    {
      value: 'pending',
      label: pendingTotal > 0 ? `Pendientes (${pendingTotal})` : 'Pendientes',
      dot: pendingTotal > 0,
    },
    { value: 'notices', label: 'Avisos', dot: unread > 0 },
    { value: 'friends', label: 'Amistad', dot: false },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View
        style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        accessibilityRole="tablist"
      >
        {tabs.map((t) => {
          const selected = t.value === tab;
          return (
            <Pressable
              key={t.value}
              onPress={() => setChosenTab(t.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[
                styles.tab,
                {
                  backgroundColor: selected ? colors.primary : colors.background,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[styles.tabText, { color: selected ? colors.onPrimary : colors.text }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {t.label}
              </Text>
              {t.dot && !selected ? (
                <View style={[styles.tabDot, { backgroundColor: colors.danger }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            colors={[colors.primary]}
            refreshing={false}
            onRefresh={refresh}
          />
        }
      >
        {tab === 'pending' ? (
          <>
            {pendingTotal === 0 ? (
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                No tienes nada pendiente.
              </Text>
            ) : null}

            {counterRequests.map((r) => (
              <View
                key={r.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.text, { color: colors.text }]}>
                  {r.requester?.display_name ?? 'Alguien'} pide {change(r.amount)} a todos en{' '}
                  {r.counterEmoji ? `${r.counterEmoji} ` : ''}«{r.counterName}».
                </Text>
                <Text style={[styles.muted, { color: colors.textMuted }]}>
                  {formatDateTime(r.createdAt)}
                </Text>
                <View style={styles.actions}>
                  <AppButton
                    small
                    title="Aceptar"
                    onPress={() =>
                      decide.mutate({ id: r.id, approve: true }, { onError: showError })
                    }
                    style={styles.flex}
                  />
                  <AppButton
                    small
                    variant="secondary"
                    title="Rechazar"
                    onPress={() =>
                      decide.mutate({ id: r.id, approve: false }, { onError: showError })
                    }
                    style={styles.flex}
                  />
                </View>
              </View>
            ))}

            {incoming.map((f) => (
              <PersonRow
                key={f.id}
                profile={f.other}
                note="quiere ser tu amigo"
                actions={
                  <>
                    <AppButton
                      small
                      title="Aceptar"
                      onPress={() =>
                        respond.mutate({ id: f.id, status: 'accepted' }, { onError: showError })
                      }
                    />
                    <AppButton
                      small
                      variant="secondary"
                      title="Rechazar"
                      onPress={() =>
                        respond.mutate({ id: f.id, status: 'rejected' }, { onError: showError })
                      }
                    />
                  </>
                }
              />
            ))}

            {invitations.map((g) => (
              <View
                key={g.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.text, { color: colors.text }]}>
                  Te han invitado al grupo «{g.name}».
                </Text>
                <View style={styles.actions}>
                  <AppButton
                    small
                    title="Unirme"
                    onPress={() => accept.mutate(g.id, { onError: showError })}
                    style={styles.flex}
                  />
                  <AppButton
                    small
                    variant="secondary"
                    title="Rechazar"
                    onPress={() =>
                      decline.mutate({ groupId: g.id, userId }, { onError: showError })
                    }
                    style={styles.flex}
                  />
                </View>
              </View>
            ))}
          </>
        ) : null}

        {tab === 'notices' ? (
          <View>
            {(notices.data ?? []).length === 0 ? (
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                Todavía no tienes avisos.
              </Text>
            ) : (
              (notices.data ?? []).map((n) => (
                <View key={n.id} style={[styles.notice, { borderBottomColor: colors.border }]}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: n.read_at === null ? colors.danger : 'transparent' },
                    ]}
                  />
                  <View style={styles.flex}>
                    <Text style={[styles.text, { color: colors.text }]}>{noticeText(n)}</Text>
                    <Text style={[styles.muted, { color: colors.textMuted }]}>
                      {formatDateTime(n.created_at)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'friends' ? (
          <View>
            {history.length === 0 ? (
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                Aquí verás las solicitudes de amistad que envíes y las que respondas.
              </Text>
            ) : null}
            {history.map((f) => (
              <PersonRow
                key={f.id}
                profile={f.other}
                note={
                  f.status === 'accepted'
                    ? 'Aceptada · sois amigos'
                    : f.status === 'rejected'
                      ? 'La rechazaste'
                      : 'Enviada · pendiente'
                }
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  bar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tabText: { fontSize: 13, fontFamily: fonts.title },
  tabDot: { position: 'absolute', top: 4, right: 8, width: 8, height: 8, borderRadius: 4 },
  card: { padding: 14, borderRadius: 16, borderWidth: 1, gap: 6 },
  text: { fontSize: 15, fontFamily: fonts.detail, lineHeight: 21 },
  muted: { fontSize: 13, fontFamily: fonts.detail },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  flex: { flex: 1 },
  notice: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
});
