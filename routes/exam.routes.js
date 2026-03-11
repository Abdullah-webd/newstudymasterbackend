import express from 'express';
import {
    generateExam,
    submitObjectiveExam,
    submitTheoryExam,
    getExamHistory
} from '../controllers/exam.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/generate', generateExam);
router.post('/:id/submit-objective', submitObjectiveExam);
router.post('/:id/submit-theory', submitTheoryExam);
router.get('/history', getExamHistory);

export default router;
