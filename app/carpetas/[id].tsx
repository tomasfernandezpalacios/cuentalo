import { useLocalSearchParams } from 'expo-router';

import { EmptyView, LoadingView } from '@/components/StateViews';
import { FolderForm } from '@/features/contadores/components/FolderForm';
import { useFolders } from '@/features/contadores/folders';

export default function EditFolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const folders = useFolders();

  if (folders.isPending) return <LoadingView />;
  const folder = folders.data?.find((f) => f.id === id);
  if (!folder) return <EmptyView title="Esta carpeta ya no existe" />;
  return <FolderForm folder={folder} />;
}
