import { useLocalSearchParams } from 'expo-router';

import { FolderForm } from '@/features/contadores/components/FolderForm';

/** ?contadores=id1,id2 llega desde la selección de la pantalla principal. */
export default function NewFolderScreen() {
  const { contadores } = useLocalSearchParams<{ contadores?: string }>();
  return <FolderForm initialCounterIds={contadores ? contadores.split(',') : []} />;
}
