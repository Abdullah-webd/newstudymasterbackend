import GameAttempt from '../models/game.model.js';
import User from '../models/user.model.js';

// @desc    Save game attempt
// @route   POST /api/v1/game/attempt
// @access  Private
export const saveAttempt = async (req, res) => {
    try {
        const { timeTaken, correctCount } = req.body;

        if (!timeTaken || correctCount === undefined) {
             return res.status(400).json({
                success: false,
                message: 'Please provide timeTaken and correctCount'
            });
        }

        const attempt = await GameAttempt.create({
            userId: req.user._id,
            timeTaken,
            correctCount
        });

        res.status(201).json({
            success: true,
            data: attempt
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Server error while saving game attempt'
        });
    }
};

// @desc    Get leaderboard
// @route   GET /api/v1/game/leaderboard
// @access  Private
export const getLeaderboard = async (req, res) => {
    try {
        // 1. All-time leaderboard (best time per user)
        // Group by userId, take the minimum timeTaken where correctCount is 10
        const leaderboard = await GameAttempt.aggregate([
            { $match: { correctCount: 10 } },
            {
                $group: {
                    _id: '$userId',
                    bestTime: { $min: '$timeTaken' },
                    totalAttempts: { $sum: 1 },
                    lastAttemptAt: { $max: '$createdAt' }
                }
            },
            { $sort: { bestTime: 1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: '$userInfo' },
            {
                $project: {
                    _id: 1,
                    bestTime: 1,
                    totalAttempts: 1,
                    lastAttemptAt: 1,
                    username: '$userInfo.username',
                    avatar: '$userInfo.avatar'
                }
            }
        ]);

        // 2. Daily top scorer
        const todayAtMidnight = new Date();
        todayAtMidnight.setHours(0, 0, 0, 0);

        const dailyTop = await GameAttempt.findOne({
            correctCount: 10,
            createdAt: { $gte: todayAtMidnight }
        })
        .sort({ timeTaken: 1 })
        .populate('userId', 'username avatar');

        // 3. Current user attempts
        const userAttempts = await GameAttempt.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            leaderboard,
            dailyTop,
            userAttempts
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching leaderboard'
        });
    }
};
