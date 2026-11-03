import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { DateTimeField } from '@/components/DateTimeField';
import { TextField } from '@/components/TextField';
import { fonts, useThemeColors } from '@/lib/theme';
import { LIMITS, parseAmount } from '@/lib/validation';

import type { Entry, EntryInput } from '../api';

type Props = {
  visible: boolean;
  unit: string | null;
  /** Si se pasa, el diálogo edita ese registro; si no, crea uno nuevo. */
  entry?: Entry | null;
  saving?: boolean;
  onSave: (input: EntryInput) => void;
  onDelete?: () => void;
  onClose: () => void;
};

export function EntryDialog({ visible, onClose, ...formProps }: Props) {
  // El formulario solo se monta con el diálogo abierto, así su estado empieza limpio cada vez.
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {visible ? (
        <EntryForm key={formProps.entry?.id ?? 'new'} onClose={onClose} {...formProps} />
      ) : null}
    </Modal>
  );
}

function EntryForm({ unit, entry, saving, onSave, onDelete, onClose }: Omit<Props, 'visible'>) {
  const colors = useThemeColors();
  // Las restas (−1) se editan como cantidad positiva y conservan su signo al guardar.
  const sign = entry && entry.amount < 0 ? -1 : 1;
  const [amount, setAmount] = useState(
    entry ? String(Math.abs(entry.amount)).replace('.', ',') : '',
  );
  const [loggedAt, setLoggedAt] = useState(() => (entry ? new Date(entry.logged_at) : new Date()));
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const parsed = parseAmount(amount);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    onSave({ amount: sign * parsed.value, loggedAt, note: note.trim() || null });
  }

  return (
    <KeyboardAvoidingView
      style={styles.backdrop}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {!entry ? 'Añadir cantidad' : sign < 0 ? 'Editar resta' : 'Editar registro'}
        </Text>
        <TextField
          label={unit ? `Cantidad (${unit})` : 'Cantidad'}
          value={amount}
          onChangeText={setAmount}
          error={error}
          keyboardType="decimal-pad"
          autoFocus={!entry}
          placeholder="ej. 2,5"
        />
        <DateTimeField label="Fecha" value={loggedAt} onChange={setLoggedAt} />
        <TextField
          label="Nota (opcional)"
          value={note}
          onChangeText={setNote}
          maxLength={LIMITS.note}
        />
        <View style={styles.actions}>
          <AppButton title="Cancelar" variant="secondary" onPress={onClose} style={styles.flex} />
          <AppButton title="Guardar" onPress={handleSave} loading={saving} style={styles.flex} />
        </View>
        {entry && onDelete ? (
          <AppButton title="Borrar registro" variant="ghost" onPress={onDelete} />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: { borderRadius: 20, padding: 20, gap: 16 },
  title: { fontSize: 20, fontFamily: fonts.title },
  actions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
