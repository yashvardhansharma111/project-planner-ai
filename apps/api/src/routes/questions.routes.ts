import { Router } from 'express';
import { listPublicQuestions } from '../controllers/questions.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Read-only question bank for the guided intake form (any signed-in user).
router.get('/', requireAuth, asyncHandler(listPublicQuestions));

export default router;
