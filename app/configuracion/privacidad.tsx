import { ScrollView, StyleSheet, Text } from 'react-native';

import { Section } from '@/components/Section';
import { fonts, useThemeColors } from '@/lib/theme';

// Resumen de qué datos guarda la app y quién los ve. La política de privacidad completa (la que
// piden las tiendas) se redactará en la Fase 6.
const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Qué guardamos',
    body:
      'Tu email (para iniciar sesión), tu nombre y tu @usuario, tus contadores, carpetas y ' +
      'registros, tus amistades y grupos, y las imágenes de los grupos de los que eres líder.',
  },
  {
    title: 'Quién lo ve',
    body:
      'Tu email solo lo ves tú. Tus contadores «Privado y amigos» los ven tus amigos (los ' +
      '«Privado», nadie) y nunca sus registros, solo el total. En un grupo, sus miembros ven los ' +
      'contadores del grupo, la clasificación y los registros de cada uno. Tus días de racha ' +
      'son privados: tus amigos solo ven el número, y puedes ocultarlo.',
  },
  {
    title: 'En este móvil',
    body:
      'Tu sesión y tus ajustes (tema, color, botones, recordatorio) se guardan cifrados en el ' +
      'móvil y no se envían a ningún sitio.',
  },
  {
    title: 'Tus derechos',
    body:
      'Puedes descargar todos tus registros con «Exportar mis datos» y borrar tu cuenta y todos ' +
      'tus datos con «Eliminar cuenta», en Configuración.',
  },
];

export default function PrivacyScreen() {
  const colors = useThemeColors();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      {SECTIONS.map((section) => (
        <Section key={section.title} title={section.title}>
          <Text style={[styles.body, { color: colors.textMuted }]}>{section.body}</Text>
        </Section>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 24 },
  body: { fontSize: 15, fontFamily: fonts.detail, lineHeight: 22 },
});
