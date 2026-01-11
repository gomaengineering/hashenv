'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/Button';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

interface SidebarProps {
  onLogout: () => void;
}

export function Sidebar({ onLogout }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Create Project',
      href: '/projects/new',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
  ];

  const filteredNavItems = navItems;

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[var(--surface)] border-r border-[var(--border)] transition-all duration-300 z-40 hidden lg:block ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-[var(--foreground)]">HashEnv</h1>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-md hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {filteredNavItems.map((item, index) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={`${item.href}-${index}`}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]'
                }`}
                title={isCollapsed ? item.name : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-[var(--border)]">
          {!isCollapsed && user && (
            <div className="mb-4 p-3 rounded-md bg-[var(--surface-elevated)]">
              <p className="text-sm font-medium text-[var(--foreground)]">{user.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
            </div>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={onLogout}
            className="w-full"
            title={isCollapsed ? 'Logout' : undefined}
          >
            {!isCollapsed && 'Logout'}
            {isCollapsed && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}
