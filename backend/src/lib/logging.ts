import EnvLog, { LogAction } from '../models/EnvLog';
import User from '../models/User';

export interface LogMetadata {
  oldVersion?: number;
  newVersion?: number;
  fileName?: string;
}

export async function logEnvAction(
  projectId: string,
  userId: string,
  action: LogAction,
  environment: 'dev' | 'staging' | 'prod',
  metadata?: LogMetadata,
  envFileId?: string,
  version?: number
): Promise<void> {
  try {
    // Get user details
    const user = await User.findById(userId).select('name email');
    if (!user) {
      console.error('User not found for logging:', userId);
      return;
    }

    // Create log entry
    await EnvLog.create({
      projectId,
      envFileId,
      environment,
      version,
      action,
      performedBy: userId,
      performedByEmail: user.email,
      performedByName: user.name,
      metadata: metadata || {},
    });
  } catch (error) {
    // Log errors but don't fail the main operation
    // Security: Don't log full error details
    console.error('Failed to log env action:', error instanceof Error ? error.message : 'Logging failed');
  }
}
