import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';
import { LIMITS, validateOptionalText, validateRequiredText } from '@/lib/validation';

import type { CounterInput } from '../api';

import { CommonCounterInfo } from './CommonCounterInfo';
import { EmojiPicker } from './EmojiPicker';
import { ParticipantsPicker } from './ParticipantsPicker';

type GroupOption = { id: string; name: string };

type Props = {
  initial?: CounterInput;
  submitTitle: string;
  saving: boolean;
  error: unknown;
  /** participantIds: personas de un contador común, o null si no es común. */
  onSubmit: (input: CounterInput, groupId: string | null, participantIds: string[] | null) => void;
  /** Al crear: grupos en los que se puede compartir. Si no se pasa, no se puede elegir. */
  groups?: GroupOption[];
  initialGroupId?: string | null;
  /** Al editar un compartido: grupo (no se puede cambiar). */
  sharedGroupName?: string | null;
  sharedGroupId?: string | null;
  /** Al editar un contador común: sus participantes (se pueden cambiar). */
  initialParticipantIds?: string[] | null;
  /** Contenido extra al final (p. ej. archivar o borrar en la pantalla de edición). */
  footer?: ReactNode;
  /** Ideas de un toque que rellenan nombre, emoticono y unidad (tutorial de bienvenida). */
  suggestions?: boolean;
};

const SUGGESTIONS = [
  { emoji: '☕', name: 'Cafés', unit: 'cafés' },
  { emoji: '📚', name: 'Libros leídos', unit: 'libros' },
  { emoji: '🏃', name: 'Kilómetros', unit: 'km' },
  { emoji: '💧', name: 'Vasos de agua', unit: 'vasos' },
];

export function CounterForm({
  initial,
  submitTitle,
  saving,
  error,
  onSubmit,
  groups,
  initialGroupId = null,
  sharedGroupName,
  sharedGroupId = null,
  initialParticipantIds = null,
  footer,
  suggestions = false,
}: Props) {
  const colors = useThemeColors();
  const [name, setName] = useState(initial?.name ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '');
  // «Privado y amigos» por defecto: mis amigos ven mis individuales salvo que elija «Privado».
  const [hiddenFromFriends, setHiddenFromFriends] = useState(initial?.hiddenFromFriends ?? false);
  const [streakEnabled, setStreakEnabled] = useState(initial?.streakEnabled ?? false);
  const [groupId, setGroupId] = useState<string | null>(initialGroupId);
  // Al editar, el contador ya es (o no es) común; al crear, se elige con la casilla.
  const [isCommon, setIsCommon] = useState(initialParticipantIds !== null);
  const [participants, setParticipants] = useState<string[]>(initialParticipantIds ?? []);
  const [errors, setErrors] = useState<{
    name?: string | null;
    unit?: string | null;
    participants?: string | null;
  }>({});

  const creating = groups !== undefined;
  // Grupo cuyos miembros se pueden elegir como participantes.
  const commonGroupId = creating ? groupId : sharedGroupId;

  function selectGroup(id: string | null) {
    setGroupId(id);
    setIsCommon(false);
    setParticipants([]);
  }

  /** Individual: «Privado» (solo yo) o «Privado y amigos» (lo ven mis amigos en mi perfil). */
  function selectPrivate(hidden: boolean) {
    selectGroup(null);
    setHiddenFromFriends(hidden);
  }

  const privateOptions = (
    <>
      <VisibilityOption
        title="Privado"
        description="Solo tú lo ves."
        selected={groupId === null && hiddenFromFriends}
        onPress={() => selectPrivate(true)}
      />
      <VisibilityOption
        title="Privado y amigos"
        description="Tus amigos ven este contador y su total en tu perfil, nunca tus registros."
        selected={groupId === null && !hiddenFromFriends}
        onPress={() => selectPrivate(false)}
      />
    </>
  );

  function handleSubmit() {
    const common = isCommon && commonGroupId !== null;
    const next = {
      name: validateRequiredText(name, 'El nombre', LIMITS.counterName),
      unit: validateOptionalText(unit, 'La unidad', LIMITS.unit),
      participants: common && participants.length === 0 ? 'Elige al menos una persona.' : null,
    };
    setErrors(next);
    if (!next.name && !next.unit && !next.participants) {
      onSubmit(
        { name, unit, emoji, hiddenFromFriends, streakEnabled },
        groupId,
        common ? participants : null,
      );
    }
  }

  const commonSection =
    commonGroupId !== null && (creating || isCommon) ? (
      <View style={styles.visibility}>
        <View style={styles.commonRow}>
          {creating ? (
            <Pressable
              onPress={() => setIsCommon((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isCommon }}
              style={styles.checkbox}
            >
              <Ionicons
                name={isCommon ? 'checkbox' : 'square-outline'}
                size={24}
                color={isCommon ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.optionTitle, { color: colors.text }]}>Contador común</Text>
            </Pressable>
          ) : (
            <Text style={[styles.optionTitle, { color: colors.text }]}>👥 Contador común</Text>
          )}
          <CommonCounterInfo />
        </View>
        {isCommon ? (
          <>
            <ParticipantsPicker
              groupId={commonGroupId}
              selected={participants}
              onChange={setParticipants}
            />
            {errors.participants ? (
              <Text style={[styles.hint, { color: colors.danger }]}>{errors.participants}</Text>
            ) : null}
          </>
        ) : null}
      </View>
    ) : null;

  return (
    <FormScreen>
      {suggestions ? (
        <View style={styles.visibility}>
          <Text style={[styles.label, { color: colors.text }]}>Ideas para empezar</Text>
          <View style={styles.ideas}>
            {SUGGESTIONS.map((idea) => {
              const chosen = name === idea.name;
              return (
                <Pressable
                  key={idea.name}
                  onPress={() => {
                    setName(idea.name);
                    setEmoji(idea.emoji);
                    setUnit(idea.unit);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Usar ${idea.name}`}
                  style={[
                    styles.idea,
                    {
                      backgroundColor: chosen ? colors.primarySoft : colors.surface,
                      borderColor: chosen ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    {idea.emoji} {idea.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
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
          {privateOptions}
          {groups.map((group) => (
            <VisibilityOption
              key={group.id}
              title={`👥 ${group.name}`}
              description="Cada miembro suma lo suyo y hay clasificación."
              selected={groupId === group.id}
              onPress={() => selectGroup(group.id)}
            />
          ))}
          {groups.length === 0 ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Para compartir un contador, crea o únete a un grupo en Amigos y grupos.
            </Text>
          ) : null}
          {/* Fuera de la V1: compartir con un grupo un contador privado ya existente. */}
        </View>
      ) : sharedGroupName ? (
        <View
          style={[styles.option, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.optionTitle, { color: colors.text }]}>👥 {sharedGroupName}</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>Compartido con el grupo.</Text>
        </View>
      ) : (
        // Al editar un individual se puede cambiar entre «Privado» y «Privado y amigos».
        <View style={styles.visibility}>
          <Text style={[styles.label, { color: colors.text }]}>¿Quién lo ve?</Text>
          {privateOptions}
        </View>
      )}

      {commonSection}

      <Pressable
        onPress={() => setStreakEnabled((value) => !value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: streakEnabled }}
        style={styles.checkbox}
      >
        <Ionicons
          name={streakEnabled ? 'checkbox' : 'square-outline'}
          size={24}
          color={streakEnabled ? colors.primary : colors.textMuted}
        />
        <View style={styles.flexText}>
          <Text style={[styles.optionTitle, { color: colors.text }]}>🔥 Formato racha</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Para cosas como «días sin fumar»: si pasa un día entero sin sumar nada, vuelve a 0. Tu
            historial y tus estadísticas lo conservan todo y se guarda tu récord.
            {(creating ? groupId !== null : Boolean(sharedGroupName))
              ? ' En un grupo, cada uno tiene su propia racha.'
              : ''}
          </Text>
        </View>
      </Pressable>

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
  commonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  flexText: { flex: 1, gap: 2 },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  idea: {
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
});
