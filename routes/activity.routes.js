import express from 'express';
import {
    startActivity,
    stopActivity,
    getSessionSummary,
    getLearningStats
} from '../controllers/activity.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/start', startActivity);
router.post('/stop', stopActivity);
router.get('/summary/:type', getSessionSummary);
router.get('/stats/learning', getLearningStats);

export default router;
