/**
 * Utility functions for permission handling and display
 */

export type Permission = 'read' | 'write';

/**
 * Format permission value for display
 */
export function formatPermission(permission: Permission): string {
  return permission === 'read' ? 'Read Only' : 'Read/Write';
}

/**
 * Get permission label for select options
 */
export function getPermissionLabel(value: Permission): string {
  return formatPermission(value);
}
