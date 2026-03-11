import express from 'express';
import {
    getQuestions,
    explainQuestion,
    followUpExplanation,
    getFilterOptions,
    generateAnswer
} from '../controllers/question.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/questions:
 *   get:
 *     summary: Fetch and filter past questions
 *     tags: [Questions]
 *     parameters:
 *       - in: query
 *         name: subject
 *         schema: { type: string }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: exam_name
 *         schema: { type: string, enum: [WAEC, NECO, JAMB] }
 *       - in: query
 *         name: question_type
 *         schema: { type: string, enum: [obj, theory] }
 */
router.get('/', getQuestions);
router.get('/filters', getFilterOptions);

router.post('/explain', protect, explainQuestion);
router.post('/follow-up', protect, followUpExplanation);
router.post('/generate-answer', protect, generateAnswer);

export default router;
