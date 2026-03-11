import express from 'express';
import { getCurrentUser, onboardingUser } from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/user/onboarding:
 *   put:
 *     summary: Update user onboarding details (optional fields)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               class:
 *                 type: string
 *               bestSubject:
 *                 type: string
 *               weakSubject:
 *                 type: string
 *               schoolName:
 *                 type: string
 *               age:
 *                 type: number
 *     responses:
 *       200:
 *         description: Onboarding updated successfully
 *       401:
 *         description: Not authorized
 */
router.get('/me', protect, getCurrentUser);
router.put('/onboarding', protect, onboardingUser);

export default router;
