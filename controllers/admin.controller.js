import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import Activity from '../models/activity.model.js';

const ADMIN_ACTIVITY_LABELS = {
    note_creation: 'Notes',
    note_study: 'Notes Study',
    quiz_study: 'Quiz',
    past_question_study: 'Past Questions',
    ai_chat: 'AI Coach',
    app_session: 'App Session',
};

const toDayLabel = (dateValue) => {
    const date = new Date(dateValue);
    return date.toISOString().slice(0, 10);
};

const isSubscriptionActive = (subscription) => {
    if (!subscription?.expirationDate) return false;
    return new Date(subscription.expirationDate) > new Date();
};

const signAdminToken = () => {
    return jwt.sign(
        {
            isAdminPanel: true,
            scope: 'admin',
        },
        process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
        {
            expiresIn: process.env.ADMIN_JWT_EXPIRE || '12h',
        }
    );
};

// @desc    Admin panel login by password
// @route   POST /api/v1/admin/login
// @access  Public
export const adminLogin = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }

        const envPassword = process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
        if (!envPassword) {
            return res.status(500).json({ success: false, message: 'Admin password is not configured on server' });
        }

        const inputBuffer = Buffer.from(password);
        const envBuffer = Buffer.from(envPassword);
        const valid = inputBuffer.length === envBuffer.length && crypto.timingSafeEqual(inputBuffer, envBuffer);

        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid admin password' });
        }

        return res.status(200).json({
            success: true,
            token: signAdminToken(),
            message: 'Admin login successful',
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Admin dashboard with real metrics
// @route   GET /api/v1/admin/dashboard
// @access  Private/AdminPanel
export const getAdminDashboard = async (req, res) => {
    try {
        const users = await User.find()
            .sort({ createdAt: -1 })
            .select('username email userId phoneNumber onboarding.phoneNumber subscription createdAt studyStats.lastActivity');

        const totalUsers = users.length;
        const activeSubscriptions = users.filter((u) => isSubscriptionActive(u.subscription)).length;
        const trialUsers = users.filter((u) => u.subscription?.plan === '1-day-free-trial').length;

        const userGrowthMap = new Map();
        users
            .slice()
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .forEach((user) => {
                const key = toDayLabel(user.createdAt);
                userGrowthMap.set(key, (userGrowthMap.get(key) || 0) + 1);
            });

        let runningTotal = 0;
        const userGrowth = Array.from(userGrowthMap.entries()).map(([label, newUsers]) => {
            runningTotal += newUsers;
            return {
                label,
                newUsers,
                totalUsers: runningTotal,
            };
        });

        const tabAggregation = await Activity.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: '$type',
                    seconds: { $sum: { $ifNull: ['$duration', 0] } },
                    users: { $addToSet: '$userId' },
                },
            },
            { $sort: { seconds: -1 } },
        ]);

        const topTabs = tabAggregation.map((row) => ({
            tab: ADMIN_ACTIVITY_LABELS[row._id] || row._id,
            minutes: Math.round((row.seconds || 0) / 60),
            users: row.users?.length || 0,
        }));

        const mostUsedTab = topTabs[0]?.tab || '-';

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalUsers,
                    activeSubscriptions,
                    trialUsers,
                    mostUsedTab,
                },
                userGrowth,
                topTabs,
                users,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all users (search + pagination)
// @route   GET /api/v1/admin/users
// @access  Private/AdminPanel
export const getAllUsers = async (req, res) => {
    try {
        const { search = '', page = 1, limit = 25 } = req.query;
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 200);

        const query = {};
        const trimmed = String(search).trim();

        if (trimmed) {
            query.$or = [
                { username: { $regex: trimmed, $options: 'i' } },
                { email: { $regex: trimmed, $options: 'i' } },
                { userId: { $regex: trimmed, $options: 'i' } },
            ];
        }

        const [users, count] = await Promise.all([
            User.find(query)
                .sort({ createdAt: -1 })
                .skip((parsedPage - 1) * parsedLimit)
                .limit(parsedLimit)
                .select('username email userId phoneNumber onboarding.phoneNumber subscription createdAt studyStats.lastActivity'),
            User.countDocuments(query),
        ]);

        return res.status(200).json({
            success: true,
            count,
            page: parsedPage,
            limit: parsedLimit,
            totalPages: Math.ceil(count / parsedLimit),
            data: users,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Extend user subscription by admin
// @route   POST /api/v1/admin/subscription/extend
// @access  Private/AdminPanel
export const extendUserSubscriptionByAdmin = async (req, res) => {
    try {
        const { userId, months = 1, plan } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId is required' });
        }

        const extendMonths = Math.max(parseInt(months, 10) || 1, 1);
        const user = await User.findOne({ userId });

        if (!user) {
            return res.status(404).json({ success: false, message: `User not found with userId ${userId}` });
        }

        const now = new Date();
        const currentExpiry = user.subscription?.expirationDate ? new Date(user.subscription.expirationDate) : now;
        const baseDate = currentExpiry > now ? currentExpiry : now;
        const newExpiry = new Date(baseDate);
        newExpiry.setMonth(newExpiry.getMonth() + extendMonths);

        const nextPlan = (plan && String(plan).trim()) || 'basic';

        user.subscription = {
            ...(user.subscription || {}),
            plan: nextPlan,
            expirationDate: newExpiry,
            metadata: {
                ...(user.subscription?.metadata || {}),
                lastExtendedAt: now,
                lastExtendedBy: 'admin-panel',
                extensionMonths: extendMonths,
            },
        };

        await user.save();

        return res.status(200).json({
            success: true,
            message: `Subscription extended by ${extendMonths} month(s)`,
            data: user,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update user subscription by admin
// @route   PUT /api/v1/admin/users/:userId/subscription
// @access  Private/AdminPanel
export const updateUserSubscriptionByAdmin = async (req, res) => {
    try {
        const { plan, expirationDate, metadata } = req.body;
        const { userId } = req.params;

        const updateData = {};
        if (plan) updateData['subscription.plan'] = plan;
        if (expirationDate) updateData['subscription.expirationDate'] = expirationDate;
        if (metadata) updateData['subscription.metadata'] = metadata;

        const user = await User.findOneAndUpdate(
            { userId },
            { $set: updateData },
            { returnDocument: 'after', runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: `User not found with userId ${userId}` });
        }

        return res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
