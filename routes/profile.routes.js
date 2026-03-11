import express from 'express';
import { getUserProfile } from '../controllers/profile.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/:userId', getUserProfile);

export default router;
