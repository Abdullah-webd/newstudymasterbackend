import express from 'express';
import { getDashboardInfo } from '../controllers/dashboard.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/', getDashboardInfo);

export default router;
