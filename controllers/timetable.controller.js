import Timetable from '../models/timetable.model.js';
import User from '../models/user.model.js';
import { getMessagingClient } from '../config/firebaseAdmin.js';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const isValidTime = (value) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
const normalizeOffset = (value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return 0;
    return Math.max(0, Math.min(120, Math.floor(parsed)));
};

// @desc    Add or Update timetable entries
// @route   POST /api/v1/timetable
// @access  Private
export const saveTimetable = async (req, res) => {
    try {
        const { entries, replace = false, timezone } = req.body;
        const userId = req.user._id;

        if (!entries || !Array.isArray(entries)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of timetable entries'
            });
        }

        const sanitizedEntries = entries.map((entry) => {
            const entryTimezone = entry.timezone || timezone || 'UTC';
            return {
                day: entry.day,
                startTime: entry.startTime,
                endTime: entry.endTime,
                activity: entry.activity?.trim(),
                notificationsEnabled: entry.notificationsEnabled !== false,
                notificationOffsetMinutes: normalizeOffset(entry.notificationOffsetMinutes),
                timezone: entryTimezone
            };
        });

        for (const entry of sanitizedEntries) {
            if (!DAY_ORDER.includes(entry.day)) {
                return res.status(400).json({ success: false, message: `Invalid day: ${entry.day}` });
            }
            if (!isValidTime(entry.startTime) || !isValidTime(entry.endTime)) {
                return res.status(400).json({ success: false, message: 'Please add valid time in HH:mm format' });
            }
            if (!entry.activity) {
                return res.status(400).json({ success: false, message: 'Activity is required' });
            }
        }

        if (replace) {
            await Timetable.deleteMany({ userId });
        }

        const bulkOps = sanitizedEntries.map((entry) => ({
            updateOne: {
                filter: {
                    userId,
                    day: entry.day,
                    startTime: entry.startTime
                },
                update: {
                    $set: {
                        ...entry,
                        userId
                    }
                },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            await Timetable.bulkWrite(bulkOps, { ordered: false });
        }

        const updatedEntries = await Timetable.find({ userId }).sort({ day: 1, startTime: 1 });

        res.status(201).json({
            success: true,
            data: updatedEntries
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Add or update a single timetable entry
// @route   PUT /api/v1/timetable/entry
// @access  Private
export const upsertTimetableEntry = async (req, res) => {
    try {
        const {
            id,
            day,
            startTime,
            endTime,
            activity,
            timezone = 'UTC',
            notificationsEnabled = true,
            notificationOffsetMinutes = 0
        } = req.body;

        if (!DAY_ORDER.includes(day)) {
            return res.status(400).json({ success: false, message: 'Invalid day provided' });
        }
        if (!isValidTime(startTime) || !isValidTime(endTime)) {
            return res.status(400).json({ success: false, message: 'Invalid time format. Use HH:mm.' });
        }
        if (!activity?.trim()) {
            return res.status(400).json({ success: false, message: 'Activity is required' });
        }

        const filter = id
            ? { _id: id, userId: req.user._id }
            : { userId: req.user._id, day, startTime };

        const updated = await Timetable.findOneAndUpdate(
            filter,
            {
                $set: {
                    day,
                    startTime,
                    endTime,
                    activity: activity.trim(),
                    timezone,
                    notificationsEnabled,
                    notificationOffsetMinutes: normalizeOffset(notificationOffsetMinutes)
                }
            },
            {
                returnDocument: 'after',
                upsert: !id,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        res.status(200).json({ success: true, data: updated });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get user's timetable
// @route   GET /api/v1/timetable
// @access  Private
export const getTimetable = async (req, res) => {
    try {
        const userId = req.user._id;

        const timetable = await Timetable.find({ userId }).sort({ day: 1, startTime: 1 });

        // Group by day for convenience
        const grouped = {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: [],
            Sunday: []
        };

        timetable.forEach(entry => {
            if (grouped[entry.day]) {
                grouped[entry.day].push(entry);
            }
        });

        res.status(200).json({
            success: true,
            entries: timetable,
            data: grouped
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Delete a timetable entry
// @route   DELETE /api/v1/timetable/:id
// @access  Private
export const deleteTimetableEntry = async (req, res) => {
    try {
        const entry = await Timetable.findById(req.params.id);

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Entry not found'
            });
        }

        // Make sure user owns the entry
        if (entry.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to delete this entry'
            });
        }

        await entry.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Register device token for push notification
// @route   POST /api/v1/timetable/device-token
// @access  Private
export const registerDeviceToken = async (req, res) => {
    try {
        const { token, platform = 'web', deviceName = '' } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token is required' });
        }

        await User.updateOne(
            { _id: req.user._id, 'fcmTokens.token': { $ne: token } },
            {
                $push: {
                    fcmTokens: {
                        token,
                        platform,
                        deviceName,
                        lastSeenAt: new Date()
                    }
                }
            }
        );

        await User.updateOne(
            { _id: req.user._id, 'fcmTokens.token': token },
            {
                $set: {
                    'fcmTokens.$.platform': platform,
                    'fcmTokens.$.deviceName': deviceName,
                    'fcmTokens.$.lastSeenAt': new Date()
                }
            }
        );

        return res.status(200).json({ success: true, message: 'Device token registered' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Unregister device token
// @route   DELETE /api/v1/timetable/device-token
// @access  Private
export const unregisterDeviceToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: 'Token is required' });
        }

        await User.updateOne(
            { _id: req.user._id },
            {
                $pull: {
                    fcmTokens: { token }
                }
            }
        );

        return res.status(200).json({ success: true, message: 'Device token removed' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Clear all device tokens for the current user
// @route   POST /api/v1/timetable/clear-tokens
// @access  Private
export const clearDeviceTokens = async (req, res) => {
    try {
        await User.updateOne(
            { _id: req.user._id },
            { $set: { fcmTokens: [] } }
        );

        return res.status(200).json({ success: true, message: 'All device tokens cleared' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Send a test push notification to the current user's devices
// @route   POST /api/v1/timetable/test-notification
// @access  Private
export const sendTestNotification = async (req, res) => {
    try {
        const { token, title, body } = req.body || {};

        const messaging = getMessagingClient();
        if (!messaging) {
            return res.status(500).json({ success: false, message: 'Firebase messaging is not configured' });
        }

        let tokens = [];
        if (token) {
            tokens = [token];
        } else {
            const user = await User.findById(req.user._id, { fcmTokens: 1 }).lean();
            tokens = (user?.fcmTokens || []).map((t) => t.token).filter(Boolean);
        }

        if (tokens.length === 0) {
            return res.status(400).json({ success: false, message: 'No device tokens registered for this user' });
        }

        const link = process.env.FRONTEND_URL || 'http://localhost:3000/timetable';
        const response = await messaging.sendEachForMulticast({
            tokens,
            data: {
                type: 'timetable_test',
                title: title || 'Test Timetable Notification',
                body: body || 'This is a test push from StudyMaster.',
                link
            },
            webpush: {
                fcmOptions: {
                    link
                }
            }
        });

        const failureReasons = response.responses
            .map((item, index) => {
                if (item.success) return null;
                console.error('FCM test failure:', {
                    token: tokens[index],
                    code: item.error?.code,
                    message: item.error?.message
                });
                return {
                    token: tokens[index],
                    code: item.error?.code,
                    message: item.error?.message
                };
            })
            .filter(Boolean);

        return res.status(200).json({
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount,
            failureReasons
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
