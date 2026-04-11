import { Navigate } from 'react-router-dom';
import { authStore } from '@/store/authStore';
import { useStoreSelector } from '@/hooks/useStore';

interface Props {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const isAuthenticated = useStoreSelector(authStore, s => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}