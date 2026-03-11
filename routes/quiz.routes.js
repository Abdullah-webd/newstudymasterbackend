import express from 'express';
import {
    getQuizzes,
    getQuizById,
    submitQuiz,
    explainQuizQuestion
} from '../controllers/quiz.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getQuizzes);
router.get('/:id', getQuizById);
router.post('/explain', explainQuizQuestion);
router.post('/:id/submit', submitQuiz);

export default router;

