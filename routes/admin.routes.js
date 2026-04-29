import express from 'express';
import {
    adminLogin,
    getAdminDashboard,
    getAllUsers,
    extendUserSubscriptionByAdmin,
    updateUserSubscriptionByAdmin,
    markUserContacted
} from '../controllers/admin.controller.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const protectAdminPanel = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Admin token is required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);
        if (!decoded?.isAdminPanel) {
            return res.status(401).json({ success: false, message: 'Invalid admin token' });
        }

        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired admin token' });
    }
};

router.post('/login', adminLogin);

router.use(protectAdminPanel);

router.get('/dashboard', getAdminDashboard);

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users in the system
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/users', getAllUsers);
router.post('/subscription/extend', extendUserSubscriptionByAdmin);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/subscription:
 *   put:
 *     summary: Update a user's subscription by admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plan:
 *                 type: string
 *               expirationDate:
 *                 type: string
 *                 format: date-time
 *               metadata:

/**
 * @swagger
 * /api/v1/admin/users/{userId}/subscription:
 *   put:
 *     summary: Update a user's subscription by admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plan:
 *                 type: string
 *               expirationDate:
 *                 type: string
 *                 format: date-time
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 *       404:
 *         description: User not found
 */
router.put('/users/:userId/subscription', updateUserSubscriptionByAdmin);
router.patch('/users/:userId/contacted', markUserContacted);

export default router;
