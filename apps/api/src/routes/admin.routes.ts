import { Router } from 'express';
import {
  getProjectDetail,
  getStats,
  listAllProjects,
  listUsers,
  updateProjectStatus,
  updateRoleSchema,
  updateStatusSchema,
  updateUserRole,
  updateUserStatus,
  updateUserStatusSchema,
} from '../controllers/admin.controller';
import {
  createQuestion,
  deleteQuestion,
  listQuestions,
  questionBodySchema,
  updateQuestion,
  updateQuestionSchema,
} from '../controllers/questions.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Everything under /api/admin requires a valid token AND the admin role.
router.use(requireAuth, requireRole('admin'));

router.get('/stats', asyncHandler(getStats));

router.get('/users', asyncHandler(listUsers));
router.patch('/users/:id/role', validateBody(updateRoleSchema), asyncHandler(updateUserRole));
router.patch(
  '/users/:id/status',
  validateBody(updateUserStatusSchema),
  asyncHandler(updateUserStatus),
);

router.get('/projects', asyncHandler(listAllProjects));
router.get('/projects/:id', asyncHandler(getProjectDetail));
router.patch(
  '/projects/:id/status',
  validateBody(updateStatusSchema),
  asyncHandler(updateProjectStatus),
);

// Questionnaire bank management.
router.get('/questions', asyncHandler(listQuestions));
router.post('/questions', validateBody(questionBodySchema), asyncHandler(createQuestion));
router.patch('/questions/:id', validateBody(updateQuestionSchema), asyncHandler(updateQuestion));
router.delete('/questions/:id', asyncHandler(deleteQuestion));

export default router;
