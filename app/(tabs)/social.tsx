import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { FriendsPanel } from '@/features/social/components/FriendsPanel';
import { GroupsPanel } from '@/features/social/components/GroupsPanel';
import { socialKeys } from '@/features/social/hooks';
import { useThemeColors } from '@/lib/theme';

type Tab = 'friends' | 'groups';

const TABS: { value: Tab; label: string }[] = [
  { value: 'groups', label: 'Grupos' },
  { value: 'friends', label: 'Amigos' },
];

export default function SocialScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('groups');
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: socialKeys.all });
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          colors={[colors.primary]}
          refreshing={refreshing}
          onRefresh={refresh}
        />
      }
    >
      <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      {tab === 'groups' ? <GroupsPanel /> : <FriendsPanel />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
});
