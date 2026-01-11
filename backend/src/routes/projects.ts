import express, { Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Project, { IProject } from '../models/Project';
import User from '../models/User';
import { authenticate, AuthRequest } from '../lib/auth';
import { requireProjectAccess, requireProjectOwnership, Permission } from '../lib/authorization';
import { validateProjectId, validateUserId, validateProjectName, validatePermission, isValidObjectId } from '../middleware/validation';
import { uploadRateLimiter } from '../middleware/security';

const router = express.Router();

/**
 * Get all projects (user's projects + projects they're a collaborator on)
 * GET /api/projects
 * 
 * SECURITY: GitHub-like collaborator system
 * - Users see projects they created OR projects they're collaborators on
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    // Find projects where user is owner OR collaborator
    const projects = await Project.find({
      $or: [
        { createdBy: req.user.userId }, // Projects user created
        { 'members.userId': req.user.userId }, // Projects user is a collaborator on
      ],
    })
      .populate('createdBy', 'name email')
      .populate('members.userId', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(projects);
    } catch (error) {
      console.error('Get projects error:', error instanceof Error ? error.message : 'Failed to fetch projects');
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

/**
 * Get a single project by ID
 * GET /api/projects/:id
 */
router.get(
  '/:id',
  authenticate,
  validateProjectId(), // Security: Validate ObjectId format
  requireProjectAccess('read'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const projectId = req.params.id;
      
      // Additional validation
      if (!isValidObjectId(projectId)) {
        res.status(400).json({ error: 'Invalid project ID format' });
        return;
      }
      
      const project = await Project.findById(projectId)
        .populate('createdBy', 'name email')
        .populate('members.userId', 'name email');
      
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      
      res.json(project);
    } catch (error) {
      console.error('Get project error:', error instanceof Error ? error.message : 'Failed to fetch project');
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  }
);

/**
 * Create a new project (any authenticated user)
 * POST /api/projects
 */
router.post(
  '/',
  authenticate,
  [validateProjectName()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      
      const { name } = req.body;
      
      const project = await Project.create({
        name,
        createdBy: req.user.userId,
        members: [],
      });
      
      const populatedProject = await Project.findById(project._id)
        .populate('createdBy', 'name email');
      
      res.status(201).json(populatedProject);
    } catch (error) {
      console.error('Create project error:', error instanceof Error ? error.message : 'Failed to create project');
      res.status(500).json({ error: 'Failed to create project' });
    }
  }
);

/**
 * Add a user to a project (must own the project)
 * POST /api/projects/:id/members
 * 
 * SECURITY: Only the project owner can add collaborators
 */
router.post(
  '/:id/members',
  authenticate,
  validateProjectId(), // Security: Validate ObjectId format
  requireProjectOwnership(), // SECURITY: Verify user owns the project
  [
    body('userId')
      .notEmpty()
      .withMessage('User ID is required')
      .custom((value) => {
        if (!isValidObjectId(value)) {
          throw new Error('Invalid user ID format');
        }
        return true;
      }),
    validatePermission(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      const projectId = req.params.id;
      const { userId, permission } = req.body;
      
      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      // Get project (already verified by requireProjectOwnership middleware)
      const project = (req as any).project as IProject;
      
      // Check if user is already a member
      const existingMemberIndex = project.members.findIndex(
        (m) => m.userId.toString() === userId
      );
      
      if (existingMemberIndex >= 0) {
        // Update existing member's permission
        project.members[existingMemberIndex].permission = permission as Permission;
      } else {
        // Add new member
        project.members.push({
          userId: user._id as mongoose.Types.ObjectId,
          permission: permission as Permission,
        });
      }
      
      await project.save();
      
      const populatedProject = await Project.findById(projectId)
        .populate('createdBy', 'name email')
        .populate('members.userId', 'name email');
      
      res.json(populatedProject);
    } catch (error) {
      console.error('Add member error:', error instanceof Error ? error.message : 'Failed to add member');
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

/**
 * Remove a user from a project (must own the project)
 * DELETE /api/projects/:id/members/:userId
 * 
 * SECURITY: Only the project owner can remove collaborators
 */
router.delete(
  '/:id/members/:userId',
  authenticate,
  validateProjectId(), // Security: Validate ObjectId format
  validateUserId(), // Security: Validate ObjectId format
  requireProjectOwnership(), // SECURITY: Verify user owns the project
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId;
      
      // Additional validation
      if (!isValidObjectId(userId)) {
        res.status(400).json({ error: 'Invalid user ID format' });
        return;
      }
      
      // Get project (already verified by requireProjectOwnership middleware)
      const project = (req as any).project as IProject;
      
      // Remove member
      project.members = project.members.filter(
        (m) => m.userId.toString() !== userId
      );
      
      await project.save();
      
      const populatedProject = await Project.findById(req.params.id)
        .populate('createdBy', 'name email')
        .populate('members.userId', 'name email');
      
      res.json(populatedProject);
    } catch (error) {
      console.error('Remove member error:', error instanceof Error ? error.message : 'Failed to remove member');
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);

/**
 * Search users (for project owners to add as collaborators)
 * GET /api/projects/users/search?q=searchterm
 */
router.get(
  '/users/search',
  authenticate,
  [
    query('q')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      const query = (req.query.q as string || '').trim();
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50); // Cap at 50
      
      // Security: Sanitize search query to prevent NoSQL injection
      if (query.length === 0) {
        res.json([]);
        return;
      }

      if (!query || query.trim().length === 0) {
        res.json([]);
        return;
      }

      // Search by name or email (case-insensitive)
      const searchRegex = new RegExp(query.trim(), 'i');
      const users = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
        ],
      })
        .select('-password')
        .limit(limit)
        .sort({ name: 1 });

      res.json(users);
    } catch (error) {
      console.error('Search users error:', error instanceof Error ? error.message : 'Failed to search users');
      res.status(500).json({ error: 'Failed to search users' });
    }
  }
);

/**
 * Get all users (for project owners to add as collaborators) - DEPRECATED: Use search instead
 * GET /api/projects/users/list
 */
router.get(
  '/users/list',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const users = await User.find().select('-password').sort({ name: 1 }).limit(100);
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error instanceof Error ? error.message : 'Failed to fetch users');
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

export default router;
