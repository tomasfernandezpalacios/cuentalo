import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/lib/errors';
import { useThemeColors } from '@/lib/theme';

import { AppButton } from './AppButton';

export function LoadingView() {
  const colors = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Cargando" />
    </View>
  );
}

type ErrorViewProps = { error: unknown; onRetry?: () => void };

export function ErrorView({ error, onRetry }: ErrorViewProps) {
  const colors = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Algo ha fallado</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>
        {getErrorMessage(error)}
      </Text>
      {onRetry ? <AppButton title="Reintentar" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

type EmptyViewProps = {
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
};

export function EmptyView({ title, description, actionTitle, onAction }: EmptyViewProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
      ) : null}
      {actionTitle && onAction ? <AppButton title={actionTitle} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  description: { fontSize: 15, textAlign: 'center' },
});
