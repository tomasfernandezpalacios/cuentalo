import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';
import { LIMITS, validateOptionalText, validateRequiredText } from '@/lib/validation';

import type { CounterInput } from '../api';

import { EmojiPicker } from './EmojiPicker';

type GroupOption = { id: string; name: string };

type Props = {
  initial?: CounterInput;
  submitTitle: string;
  saving: boolean;
  error: unknown;
  onSubmit: (input: CounterInput, groupId: string | null) => void;
  /** Al crear: grupos en los que se puede compartir. Si no se pasa, no se puede elegir. */
  groups?: GroupOption[];
  initialGroupId?: string | null;
  /** Al editar un compartido: nombre del grupo (no se puede cambiar). */
  sharedGroupName?: string | null;
  /** Contenido extra al final (p. ej. archivar o borrar en la pantalla de edición). */
  footer?: ReactNode;
};

export function CounterForm({
  initial,
  submitTitle,
  saving,
  error,
  onSubmit,
  groups,
  initialGroupId = null,
  sharedGroupName,
  footer,
}: Props) {
  const colors = useThemeColors();
  const [name, setName] = useState(initial?.name ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '');
  const [groupId, setGroupId] = useState<string | null>(initialGroupId);
  const [errors, setErrors] = useState<{ name?: string | null; unit?: string | null }>({});

  function handleSubmit() {
    const next = {
      name: validateRequiredText(name, 'El nombre', LIMITS.counterName),
      unit: validateOptionalText(unit, 'La unidad', LIMITS.unit),
    };
    setErrors(next);
    if (!next.name && !next.unit) onSubmit({ name, unit, emoji }, groupId);
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
      <EmojiPicker value={emoji} onChange={setEmoji} />
      <TextField
        label="Unidad (opcional)"
        value={unit}
        onChangeText={setUnit}
        error={errors.unit}
        placeholder="ej. cervezas, libros, km. Déjalo vacío si no hace falta"
        maxLength={LIMITS.unit}
        autoCapitalize="none"
      />

      {groups ? (
        <View style={styles.visibility}>
          <Text style={[styles.label, { color: colors.text }]}>¿Quién lo ve?</Text>
          <VisibilityOption
            title="Privado"
            description="Solo tú lo ves."
            selected={groupId === null}
            onPress={() => setGroupId(null)}
          />
          {groups.map((group) => (
            <VisibilityOption
              key={group.id}
              title={`👥 ${group.name}`}
              description="Cada miembro suma lo suyo y hay clasificación."
              selected={groupId === group.id}
              onPress={() => setGroupId(group.id)}
            />
          ))}
          {groups.length === 0 ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Para compartir un contador, crea o únete a un grupo en Amigos y grupos.
            </Text>
          ) : null}
          {/* Fuera de la V1: compartir con un grupo un contador privado ya existente. */}
        </View>
      ) : (
        <View
          style={[styles.option, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.optionTitle, { color: colors.text }]}>
            {sharedGroupName ? `👥 ${sharedGroupName}` : 'Privado'}
          </Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {sharedGroupName ? 'Compartido con el grupo.' : 'Solo tú lo ves.'}
          </Text>
        </View>
      )}

      {error ? (
        <Text style={{ color: colors.danger, fontFamily: fonts.detail }}>
          {getErrorMessage(error)}
        </Text>
      ) : null}
      <AppButton title={submitTitle} onPress={handleSubmit} loading={saving} />
      {footer}
    </FormScreen>
  );
}

type OptionProps = {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
};

function VisibilityOption({ title, description, selected, onPress }: OptionProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.option,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.optionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  visibility: { gap: 8 },
  label: { fontSize: 15, fontFamily: fonts.detail },
  option: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 4 },
  optionTitle: { fontSize: 15, fontFamily: fonts.title },
  hint: { fontSize: 14, fontFamily: fonts.detail },
});
