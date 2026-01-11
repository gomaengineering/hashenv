'use client';

import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--background)] flex">
      <Sidebar onLogout={logout} />
      <main className="flex-1 transition-all duration-300 lg:ml-64">
        {children}
      </main>
    </div>
  );
}
