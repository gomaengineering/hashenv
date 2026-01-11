'use client';

import { useState, useEffect, useRef } from 'react';
import { projectsAPI } from '@/lib/api';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface UserSearchInputProps {
  value: string;
  onChange: (user: User | null) => void;
  excludeUserIds?: string[];
  placeholder?: string;
  className?: string;
}

export function UserSearchInput({
  value,
  onChange,
  excludeUserIds = [],
  placeholder = 'Search users by name or email...',
  className = '',
}: UserSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setUsers([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await projectsAPI.searchUsers(searchQuery.trim(), 10);
        // Filter out excluded users
        const filtered = results.filter((user: User) => !excludeUserIds.includes(user._id));
        setUsers(filtered);
        setShowDropdown(filtered.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        setUsers([]);
        setShowDropdown(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, excludeUserIds]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (user: User) => {
    onChange(user);
    setSearchQuery(`${user.name} (${user.email})`);
    setShowDropdown(false);
    setUsers([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || users.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < users.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectUser(users[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    if (!newValue || newValue.trim().length === 0) {
      onChange(null);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    onChange(null);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (users.length > 0) {
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          className="block w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 pl-10 pr-10 text-[var(--foreground)] placeholder:text-[var(--text-muted)] shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg className="h-5 w-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {searchQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-lg"
        >
          {loading ? (
            <div className="px-4 py-3 text-sm text-[var(--text-muted)]">
              Searching...
            </div>
          ) : users.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--text-muted)]">
              No users found
            </div>
          ) : (
            <ul className="py-1">
              {users.map((user, index) => (
                <li
                  key={user._id}
                  onClick={() => handleSelectUser(user)}
                  className={`cursor-pointer px-4 py-2 text-sm transition-colors ${
                    index === selectedIndex
                      ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                      : 'text-[var(--foreground)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
