'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { projectsAPI } from '@/lib/api';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AuthenticatedLayout } from '@/components/AuthenticatedLayout';
import { Button } from '@/components/ui/Button';
import { UserSearchInput } from '@/components/ui/UserSearchInput';
import { formatPermission } from '@/lib/permissions';
import { SkeletonCard, Skeleton } from '@/components/ui/Skeleton';

interface User {
  _id: string;
  name: string;
  username: string;
  email: string;
  role: string;
}

interface Project {
  _id: string;
  name: string;
  members: Array<{
    userId: {
      _id: string;
      name: string;
      email: string;
    };
    permission: 'read' | 'write';
  }>;
}

export default function ManageMembersPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<'read' | 'write'>('read');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const projectData = await projectsAPI.get(projectId);
      setProject(projectData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await projectsAPI.addMember(projectId, {
        userId: selectedUser._id,
        permission: selectedPermission,
      });
      await loadData();
      setSelectedUser(null);
      setSelectedPermission('read');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      await projectsAPI.removeMember(projectId, userId);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AuthenticatedLayout>
          <div className="p-6 lg:p-8">
            <Skeleton variant="rectangular" height={48} width="40%" className="mb-6" />
            <SkeletonCard className="mb-6" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </AuthenticatedLayout>
      </ProtectedRoute>
    );
  }

  if (!project) {
    return (
      <ProtectedRoute>
        <AuthenticatedLayout>
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <p className="text-[var(--error)] mb-4">Project not found</p>
              <Button variant="primary" size="md" asLink href="/dashboard">
                Back to Dashboard
              </Button>
            </div>
          </div>
        </AuthenticatedLayout>
      </ProtectedRoute>
    );
  }

  const memberUserIds = project.members.map((m) =>
    typeof m.userId === 'object' ? m.userId._id : m.userId
  );

  return (
    <ProtectedRoute>
      <AuthenticatedLayout>
        <div className="p-6 lg:p-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6">
              <Link
                href={`/projects/${projectId}`}
                className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] inline-block mb-4"
              >
                ← Back to Project
              </Link>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">
                Manage Members - {project.name}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Add or remove team members from this project. Search for users by name.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-[var(--error)]/50 bg-[var(--error)]/10 p-4">
                <p className="text-sm text-[var(--error)]">{error}</p>
              </div>
            )}

            {/* Add Member Form */}
            <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Add Member</h2>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Search Users
                  </label>
                  <UserSearchInput
                    value={selectedUser ? selectedUser.name : ''}
                    onChange={setSelectedUser}
                    excludeUserIds={memberUserIds}
                    placeholder="Type to search users by name..."
                    className="w-full"
                  />
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Start typing to search. Users who are already members will not appear.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Permission Level
                  </label>
                  <select
                    value={selectedPermission}
                    onChange={(e) => setSelectedPermission(e.target.value as 'read' | 'write')}
                    className="block w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  >
                    <option value="read">Read Only</option>
                    <option value="write">Read/Write</option>
                  </select>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    <strong>Read Only:</strong> Can view and download environment files. <strong>Read/Write:</strong> Can upload, view, and download environment files.
                  </p>
                </div>

                <div className="flex justify-end pt-4 border-t border-[var(--border)]">
                  <Button
                    variant="primary"
                    size="md"
                    type="submit"
                    disabled={submitting || !selectedUser}
                  >
                    {submitting ? 'Adding...' : 'Add Member'}
                  </Button>
                </div>
              </form>
            </div>

            {/* Members List */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Current Members</h2>
              {project.members.length === 0 ? (
                <p className="text-[var(--text-muted)] text-center py-4">No members added yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                  <table className="min-w-full divide-y divide-[var(--border)]">
                    <thead className="bg-[var(--surface-elevated)]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                          Permission
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                      {project.members.map((member, idx) => {
                        const userId = typeof member.userId === 'object' ? member.userId._id : member.userId;
                        const userName = typeof member.userId === 'object' ? member.userId.name : 'Unknown';
                        const userEmail = typeof member.userId === 'object' ? member.userId.email : '';
                        return (
                          <tr key={idx} className="hover:bg-[var(--surface-elevated)] transition-colors">
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--foreground)]">
                              <p className="font-medium">{userName}</p>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--text-secondary)]">
                              <span className="rounded-full bg-[var(--accent)]/20 px-3 py-1 text-xs font-medium text-[var(--accent)]">
                                {formatPermission(member.permission)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                              <button
                                onClick={() => handleRemoveMember(userId)}
                                className="text-[var(--error)] hover:text-[#F85149] transition-colors"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </AuthenticatedLayout>
    </ProtectedRoute>
  );
}
