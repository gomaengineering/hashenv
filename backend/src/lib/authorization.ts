import { Response, NextFunction } from 'express';
import Project, { IProject } from '../models/Project';
import { AuthRequest } from './auth';

/**
 * Authorization utilities for project-based access control
 * 
 * SECURITY: GitHub-like collaborator system
 * - Any user can create projects
 * - Users can access projects they created (owner) OR projects they're collaborators on
 * - Project owners always have write access
 * - Collaborators have read or write permissions based on membership
 */

export type Permission = 'read' | 'write';

/**
 * Check if a user is the owner/creator of a project
 */
export async function isProjectOwner(
  userId: string,
  project: IProject
): Promise<boolean> {
  return project.createdBy.toString() === userId;
}

/**
 * Check if user has access to a project
 * Returns the user's permission level if they have access, null otherwise
 * 
 * SECURITY: 
 * - Project owners always have write access
 * - Collaborators have permissions based on membership (read or write)
 */
export async function getUserProjectPermission(
  userId: string,
  projectId: string
): Promise<Permission | null> {
  const project = await Project.findById(projectId);
  
  if (!project) {
    return null;
  }
  
  // Check if user is the project owner
  const isOwner = await isProjectOwner(userId, project);
  if (isOwner) {
    return 'write'; // Project owner always has write access
  }
  
  // Check if user is a collaborator (member)
  const member = project.members.find(
    (m) => m.userId.toString() === userId
  );
  
  if (member) {
    return member.permission; // Return their permission level (read or write)
  }
  
  return null; // No access - not owner and not a collaborator
}

/**
 * Middleware to check if user has access to a project
 * Extracts projectId from route params
 * Requires 'read' permission by default
 * 
 * SECURITY: GitHub-like collaborator access
 * - Project owners always have write access
 * - Collaborators have permissions based on membership
 */
export function requireProjectAccess(requiredPermission: Permission = 'read') {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const projectId = req.params.projectId || req.params.id;
      
      if (!projectId) {
        res.status(400).json({ error: 'Project ID required' });
        return;
      }
      
      // Security: Validate ObjectId format to prevent NoSQL injection
      if (!/^[0-9a-fA-F]{24}$/.test(projectId)) {
        res.status(400).json({ error: 'Invalid project ID format' });
        return;
      }
      
      const project = await Project.findById(projectId);
      
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      
      // Check if user is the project owner
      const isOwner = await isProjectOwner(req.user.userId, project);
      if (isOwner) {
        // Project owner always has write access, which includes read
        (req as any).project = project;
        return next();
      }
      
      // Check if user is a collaborator (member)
      const member = project.members.find(
        (m) => m.userId.toString() === req.user!.userId
      );
      
      if (!member) {
        res.status(403).json({ 
          error: 'Access denied: You do not have access to this project' 
        });
        return;
      }
      
      // Check permission level for collaborators
      const hasAccess =
        member.permission === 'write' ||
        (requiredPermission === 'read' && member.permission === 'read');
      
      if (!hasAccess) {
        res.status(403).json({
          error: `Access denied: ${requiredPermission} permission required`,
        });
        return;
      }
      
      // Attach project to request for use in route handlers
      (req as any).project = project;
      
      next();
    } catch (error) {
      // Security: Don't log full error details
      console.error('Authorization error:', error instanceof Error ? error.message : 'Authorization error');
      res.status(500).json({ error: 'Authorization error' });
      return;
    }
  };
}

/**
 * Middleware to verify that the current user owns the project
 * Use this for operations that require project ownership (e.g., managing collaborators)
 * 
 * SECURITY: Only project owners can manage collaborators and project settings
 */
export function requireProjectOwnership() {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const projectId = req.params.projectId || req.params.id;
      
      if (!projectId) {
        res.status(400).json({ error: 'Project ID required' });
        return;
      }
      
      // Security: Validate ObjectId format to prevent NoSQL injection
      if (!/^[0-9a-fA-F]{24}$/.test(projectId)) {
        res.status(400).json({ error: 'Invalid project ID format' });
        return;
      }
      
      const project = await Project.findById(projectId);
      
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      
      // SECURITY: Verify user owns this project
      const isOwner = await isProjectOwner(req.user.userId, project);
      if (!isOwner) {
        res.status(403).json({ 
          error: 'Access denied: Only project owners can perform this action' 
        });
        return;
      }
      
      // Attach project to request
      (req as any).project = project;
      
      next();
    } catch (error) {
      // Security: Don't log full error details
      console.error('Project ownership check error:', error instanceof Error ? error.message : 'Authorization error');
      res.status(500).json({ error: 'Authorization error' });
      return;
    }
  };
}
