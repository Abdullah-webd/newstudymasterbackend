import Activity from '../models/activity.model.js';
import User from '../models/user.model.js';

/**
 * @desc    Start a new study activity
 * @route   POST /api/v1/activity/start
 * @access  Private
 */
export const startActivity = async (req, res) => {
    try {
        const { type, metadata } = req.body;
        const userId = req.user.id;

        if (!type) {
            return res.status(400).json({
                success: false,
                message: 'Activity type is required'
            });
        }

        // Close any existing active activities for this user of the same type (optional safety)
        await Activity.updateMany(
            { userId, type, status: 'active' },
            {
                status: 'completed',
                endTime: Date.now()
                // We don't calculate duration here as it's a safety cleanup
            }
        );

        const activity = await Activity.create({
            userId,
            type,
            metadata: {
                ...metadata,
                startTime: Date.now()
            },
            startTime: Date.now(),
            status: 'active'
        });

        res.status(201).json({
            success: true,
            data: activity
        });
    } catch (error) {
        console.error('Error starting activity:', error);
        res.status(500).json({
            success: false,
            message: 'Error starting activity'
        });
    }
};

/**
 * @desc    Stop an active study activity
 * @route   POST /api/v1/activity/stop
 * @access  Private
 */
export const stopActivity = async (req, res) => {
    try {
        const { type, metadata } = req.body;
        const userId = req.user.id;

        if (!type) {
            return res.status(400).json({
                success: false,
                message: 'Activity type is required'
            });
        }

        // Find the most recent active activity of this type
        const activity = await Activity.findOne({
            userId,
            type,
            status: 'active'
        }).sort({ startTime: -1 });

        if (!activity) {
            return res.status(404).json({
                success: false,
                message: 'No active activity found for this type'
            });
        }

        const endTime = Date.now();
        const duration = Math.floor((endTime - activity.startTime) / 1000); // duration in seconds

        activity.endTime = endTime;
        activity.duration = duration;
        activity.status = 'completed';

        // Merge metadata if provided
        if (metadata) {
            activity.metadata = {
                ...(activity.metadata || {}),
                ...metadata
            };
        }

        await activity.save();

        // Update User Model studyStats
        const user = await User.findById(userId);
        if (user) {
            user.studyStats.totalStudyTime += duration;
            user.studyStats.lastActivity = endTime;

            // Increment activity count
            if (user.studyStats.activityCounts && user.studyStats.activityCounts[type] !== undefined) {
                user.studyStats.activityCounts[type] += 1;
            }

            await user.save();
        }

        res.status(200).json({
            success: true,
            data: activity,
            totalStudyTime: user ? user.studyStats.totalStudyTime : null
        });
    } catch (error) {
        console.error('Error stopping activity:', error);
        res.status(500).json({
            success: false,
            message: 'Error stopping activity'
        });
    }
};

/**
 * @desc    Get session summary (last completed activity)
 * @route   GET /api/v1/activity/summary/:type
 * @access  Private
 */
export const getSessionSummary = async (req, res) => {
    try {
        const { type } = req.params;
        const userId = req.user.id;

        const activity = await Activity.findOne({
            userId,
            type,
            status: 'completed'
        }).sort({ endTime: -1 });

        if (!activity) {
            return res.status(404).json({
                success: false,
                message: 'No previous session found'
            });
        }

        res.status(200).json({
            success: true,
            data: activity
        });
    } catch (error) {
        console.error('Error fetching session summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching session summary'
        });
    }
};

/**
 * @desc    Get summary stats for learning activities
 * @route   GET /api/v1/activity/stats/learning
 * @access  Private
 */
export const getLearningStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const mongoose = (await import('mongoose')).default;

        const activities = await Activity.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    type: { $in: ['note_study', 'quiz_study', 'past_question_study'] },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: '$type',
                    totalTime: { $sum: '$duration' },
                    count: { $sum: 1 },
                    avgScore: { $avg: '$metadata.score' }
                }
            }
        ]);

        // Format for easy frontend consumption
        const stats = {
            note_study: activities.find(a => a._id === 'note_study') || { totalTime: 0, count: 0 },
            quiz_study: activities.find(a => a._id === 'quiz_study') || { totalTime: 0, count: 0 },
            past_question_study: activities.find(a => a._id === 'past_question_study') || { totalTime: 0, count: 0 }
        };

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching learning stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching learning stats'
        });
    }
};
