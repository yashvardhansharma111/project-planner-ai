import { Router } from 'express';
import {
  changePassword,
  changePasswordSchema,
  login,
  loginSchema,
  logout,
  me,
  refresh,
  register,
  registerSchema,
  updateMe,
  updateMeSchema,
  updateTheme,
  updateThemeSchema,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/register', validateBody(registerSchema), asyncHandler(register));
router.post('/login', validateBody(loginSchema), asyncHandler(login));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', logout);
router.get('/me', requireAuth, asyncHandler(me));
router.patch('/me', requireAuth, validateBody(updateMeSchema), asyncHandler(updateMe));
router.patch('/me/theme', requireAuth, validateBody(updateThemeSchema), asyncHandler(updateTheme));
router.patch(
  '/me/password',
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(changePassword),
);

export default router;
