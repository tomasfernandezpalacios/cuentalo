import { StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { formatAmount } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

import type { SeriesPoint } from '../periods';

type Props = {
  series: SeriesPoint[];
  /** Nombre del contador, para el texto de accesibilidad. */
  name: string;
};

export function EvolutionChart({ series, name }: Props) {
  const colors = useThemeColors();
  const total = series.reduce((sum, point) => sum + point.total, 0);

  // Resumen en texto para lectores de pantalla, que no pueden "ver" las barras.
  const description = series
    .filter((point) => point.total > 0)
    .map((point) => `${point.label}: ${formatAmount(point.total)}`)
    .join(', ');

  return (
    <View
      accessible
      accessibilityLabel={`Gráfica de ${name}. ${description || 'Sin registros en este intervalo.'}`}
    >
      <BarChart
        data={series.map((point) => ({ value: point.total, label: point.label }))}
        barWidth={18}
        spacing={12}
        initialSpacing={8}
        endSpacing={8}
        barBorderTopLeftRadius={4}
        barBorderTopRightRadius={4}
        frontColor={colors.primary}
        noOfSections={4}
        maxValue={total === 0 ? 4 : undefined}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={colors.border}
        rulesColor={colors.border}
        yAxisTextStyle={{ color: colors.textMuted, fontSize: 11, fontFamily: fonts.detail }}
        xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10, fontFamily: fonts.detail }}
        formatYLabel={(label) => formatAmount(Number(label))}
        scrollToEnd
        height={180}
      />
      {total === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          Sin registros en este intervalo.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', fontSize: 13, marginTop: 8, fontFamily: fonts.detail },
});
