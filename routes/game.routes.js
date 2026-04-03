import express from 'express';
import { saveAttempt, getLeaderboard } from '../controllers/game.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect); // Ensure user is logged in

router.post('/attempt', saveAttempt);
router.get('/leaderboard', getLeaderboard);

export default router;
