import express from 'express';
import { followUser, unfollowUser } from '../controllers/follow.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/:userId', followUser);
router.delete('/:userId', unfollowUser);

export default router;
