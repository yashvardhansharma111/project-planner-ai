import { Router } from 'express';
import {
  chat,
  chatExtract,
  chatSchema,
  chatStream,
  enrich,
  enrichSchema,
  generateDocuments,
  generateSchema,
  suggestChecklist,
} from '../controllers/ai.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth);

// Pre-generation: suggest an editable feature checklist.
router.post('/checklist/:projectId', asyncHandler(suggestChecklist));

// Synchronous generation: returns the saved PRD + TRD when Groq finishes.
router.post('/generate/:projectId', validateBody(generateSchema), asyncHandler(generateDocuments));

// Chatbot intake.
router.post('/chat', validateBody(chatSchema), asyncHandler(chat));
// Streamed reply — chatStream manages its own errors (no asyncHandler).
router.post('/chat/stream', validateBody(chatSchema), chatStream);
router.post('/chat/extract', validateBody(chatSchema), asyncHandler(chatExtract));

// Polish raw questionnaire answers into a structured brief.
router.post('/enrich', validateBody(enrichSchema), asyncHandler(enrich));

export default router;
