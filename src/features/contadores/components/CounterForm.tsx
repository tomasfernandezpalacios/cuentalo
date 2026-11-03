import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { getErrorMessage } from '@/lib/errors';
import { useThemeColors } from '@/lib/theme';
import { LIMITS, validateOptionalText, validateRequiredText } from '@/lib/validation';

import type { CounterInput } from '../api';

type Props = {
  initial?: CounterInput;
  submitTitle: string;
  saving: boolean;
  error: unknown;
  onSubmit: (input: CounterInput) => void;
  /** Contenido extra al final (p. ej. archivar o borrar en la pantalla de edición). */
  footer?: ReactNode;
};

export function CounterForm({ initial, submitTitle, saving, error, onSubmit, footer }: Props) {
  const colors = useThemeColors();
  const [name, setName] = useState(initial?.name ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [errors, setErrors] = useState<{ name?: string | null; unit?: string | null }>({});

  function handleSubmit() {
    const next = {
      name: validateRequiredText(name, 'El nombre', LIMITS.counterName),
      unit: validateOptionalText(unit, 'La unidad', LIMITS.unit),
    };
    setErrors(next);
    if (!next.name && !next.unit) onSubmit({ name, unit });
  }

  return (
    <FormScreen>
      <TextField
        label="Nombre"
        value={name}
        onChangeText={setName}
        error={errors.name}
        placeholder="ej. Cervezas, Libros leídos, Kilómetros"
        maxLength={LIMITS.counterName}
        autoFocus={!initial}
      />
      <TextField
        label="Unidad (opcional)"
        value={unit}
        onChangeText={setUnit}
        error={errors.unit}
        placeholder="ej. cervezas, libros, km. Déjalo vacío si no hace falta"
        maxLength={LIMITS.unit}
        autoCapitalize="none"
      />

      {/* Fase 4: aquí se elegirá entre privado o compartido con un grupo. */}
      <View
        style={[styles.visibility, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.visibilityTitle, { color: colors.text }]}>Privado</Text>
        <Text style={{ color: colors.textMuted }}>
          Solo tú lo ves. Los contadores compartidos con grupos llegarán pronto.
        </Text>
      </View>

      {error ? <Text style={{ color: colors.danger }}>{getErrorMessage(error)}</Text> : null}
      <AppButton title={submitTitle} onPress={handleSubmit} loading={saving} />
      {footer}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  visibility: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 4 },
  visibilityTitle: { fontSize: 15, fontWeight: '600' },
});
