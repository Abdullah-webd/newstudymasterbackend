import Follower from '../models/follower.model.js';

// @desc    Follow a user
// @route   POST /api/v1/follow/:userId
// @access  Private
export const followUser = async (req, res) => {
    try {
        const followingId = req.params.userId;
        const followerId = req.user._id;

        if (followingId === followerId.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
        }

        await Follower.create({ followerId, followingId });

        res.status(200).json({ success: true, message: 'User followed' });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Already following this user' });
        }
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Unfollow a user
// @route   DELETE /api/v1/follow/:userId
// @access  Private
export const unfollowUser = async (req, res) => {
    try {
        const followingId = req.params.userId;
        const followerId = req.user._id;

        await Follower.findOneAndDelete({ followerId, followingId });

        res.status(200).json({ success: true, message: 'User unfollowed' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
