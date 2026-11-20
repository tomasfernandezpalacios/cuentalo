import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { BirthDatePicker } from '@/components/BirthDatePicker';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { isUsernameAvailable, signUp } from '@/features/auth/api';
import { birthStart } from '@/features/estadisticas/age';
import { isOldEnough, MIN_AGE, openLegalPage, TERMS_VERSION } from '@/features/legal/legal';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { getErrorMessage } from '@/lib/errors';
import { fonts, proseFont, useThemeColors } from '@/lib/theme';
import {
  LIMITS,
  normalizeUsername,
  validateEmail,
  validatePassword,
  validateRequiredText,
  validateUsername,
} from '@/lib/validation';

type Errors = Partial<
  Record<'displayName' | 'username' | 'email' | 'password' | 'birthDate' | 'terms', string | null>
>;

const LONG_DATE = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Fecha de partida del calendario: hace 20 años (se empieza eligiendo el año). */
function defaultBirthDate(): string {
  return `${new Date().getFullYear() - 20}-01-01`;
}

export default function RegisterScreen() {
  const colors = useThemeColors();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Edad mínima (art. 7 LOPDGDD) y aceptación de las condiciones: obligatorias para registrarse.
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(defaultBirthDate);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Mientras se escribe, se comprueba si el nombre de usuario está libre (es único).
  const typedUsername = useDebouncedValue(normalizeUsername(username), 400);
  const usernameCheck = useQuery({
    queryKey: ['username-available', typedUsername],
    queryFn: () => isUsernameAvailable(typedUsername),
    enabled: validateUsername(typedUsername) === null,
    staleTime: 30_000,
  });
  const usernameTaken =
    typedUsername === normalizeUsername(username) && usernameCheck.data === false;

  const register = useMutation({
    mutationFn: () =>
      signUp({
        email,
        password,
        username,
        displayName,
        birthDate: birthDate ?? '',
        termsVersion: TERMS_VERSION,
      }),
    onSuccess: ({ needsConfirmation }) => {
      // Sin confirmación por email, onAuthStateChange cambia de pantalla automáticamente.
      if (needsConfirmation) {
        appAlert('Revisa tu email', 'Te hemos enviado un enlace para confirmar tu cuenta.');
        router.back();
      }
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  function handleSubmit() {
    const next: Errors = {
      displayName: validateRequiredText(displayName, 'El nombre', LIMITS.displayName),
      username:
        validateUsername(username) ??
        (usernameTaken ? 'Ese nombre de usuario ya está en uso. Elige otro.' : null),
      email: validateEmail(email),
      password: validatePassword(password),
      birthDate: !birthDate
        ? 'Elige tu fecha de nacimiento.'
        : isOldEnough(birthDate)
          ? null
          : `Tienes que tener al menos ${MIN_AGE} años para usar Cuéntalo.`,
      terms: accepted
        ? null
        : 'Tienes que aceptar las condiciones de uso y la política de privacidad.',
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).every((error) => !error)) register.mutate();
  }

  return (
    <FormScreen>
      <TextField
        label="Nombre"
        value={displayName}
        onChangeText={setDisplayName}
        error={errors.displayName}
        autoComplete="name"
        placeholder="Cómo te verán tus amigos"
      />
      <TextField
        label="Nombre de usuario"
        value={username}
        onChangeText={(value) => {
          setUsername(value);
          setErrors((e) => ({ ...e, username: null }));
        }}
        error={
          errors.username ??
          (usernameTaken ? 'Ese nombre de usuario ya está en uso. Elige otro.' : null)
        }
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="ej. tomas_88"
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>Fecha de nacimiento</Text>
        <Pressable
          onPress={() => {
            setDraftDate(birthDate ?? defaultBirthDate());
            setPickerOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            birthDate
              ? `Fecha de nacimiento: ${LONG_DATE.format(birthStart(birthDate))}. Cambiar`
              : 'Elegir fecha de nacimiento'
          }
          style={[
            styles.dateButton,
            {
              backgroundColor: colors.surface,
              borderColor: errors.birthDate ? colors.danger : colors.border,
            },
          ]}
        >
          <Text style={[styles.dateText, { color: birthDate ? colors.text : colors.textMuted }]}>
            {birthDate ? LONG_DATE.format(birthStart(birthDate)) : 'Elegir fecha'}
          </Text>
          <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
        </Pressable>
        {errors.birthDate ? (
          <Text style={[styles.error, { color: colors.danger }]}>{errors.birthDate}</Text>
        ) : (
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Para comprobar que tienes al menos {MIN_AGE} años. Solo la ves tú.
          </Text>
        )}
      </View>

      <View style={styles.field}>
        <View style={styles.termsRow}>
          <Pressable
            onPress={() => {
              setAccepted((a) => !a);
              setErrors((e) => ({ ...e, terms: null }));
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            accessibilityLabel="Acepto las condiciones de uso y la política de privacidad"
            hitSlop={10}
          >
            <Ionicons
              name={accepted ? 'checkbox' : 'square-outline'}
              size={26}
              color={errors.terms ? colors.danger : colors.primary}
            />
          </Pressable>
          <Text style={[styles.termsText, { color: colors.text }]}>
            He leído y acepto las{' '}
            <Text
              style={[styles.link, { color: colors.primary }]}
              onPress={() => openLegalPage('terms')}
              accessibilityRole="link"
            >
              condiciones de uso
            </Text>{' '}
            y la{' '}
            <Text
              style={[styles.link, { color: colors.primary }]}
              onPress={() => openLegalPage('privacy')}
              accessibilityRole="link"
            >
              política de privacidad
            </Text>
            .
          </Text>
        </View>
        {errors.terms ? (
          <Text style={[styles.error, { color: colors.danger }]}>{errors.terms}</Text>
        ) : null}
      </View>

      {formError ? (
        <Text style={{ color: colors.danger, fontFamily: fonts.detail }}>{formError}</Text>
      ) : null}

      <AppButton
        title="Crear cuenta"
        onPress={handleSubmit}
        loading={register.isPending}
        disabled={usernameTaken}
      />

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {LONG_DATE.format(birthStart(draftDate))}
            </Text>
            <BirthDatePicker
              value={draftDate}
              onChange={setDraftDate}
              initialView={birthDate ? 'day' : 'year'}
            />
            <AppButton
              title="Listo"
              onPress={() => {
                setBirthDate(draftDate);
                setErrors((e) => ({ ...e, birthDate: null }));
                setPickerOpen(false);
              }}
            />
            <AppButton title="Cancelar" variant="ghost" onPress={() => setPickerOpen(false)} />
          </View>
        </View>
      </Modal>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 15, fontFamily: fonts.detail },
  dateButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: { fontSize: 16, fontFamily: fonts.detail },
  hint: { fontSize: 13, fontFamily: fonts.detail },
  error: { fontSize: 13, fontFamily: fonts.detail },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  termsText: { flex: 1, ...proseFont(15, 22) },
  link: { textDecorationLine: 'underline' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: { borderRadius: 24, padding: 16, gap: 12, maxHeight: '92%' },
  sheetTitle: { fontSize: 18, fontFamily: fonts.title, textAlign: 'center' },
});
