import User from '../models/user.model.js';
import Post from '../models/post.model.js';
import Follower from '../models/follower.model.js';
import Comment from '../models/comment.model.js';
import Note from '../models/note.model.js';
import Quiz from '../models/quiz.model.js';

// @desc    Get user profile info
// @route   GET /api/v1/profile/:userId
// @access  Private
export const getUserProfile = async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId).select('username avatar bio onboarding');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 1. Counts
        const followersCount = await Follower.countDocuments({ followingId: userId });
        const followingCount = await Follower.countDocuments({ followerId: userId });
        const isFollowing = await Follower.exists({ followerId: req.user._id, followingId: userId });

        // 2. Posts by this user
        const userPosts = await Post.find({ userId })
            .populate('userId', 'username avatar')
            .sort({ createdAt: -1 });

        // Add comment count to user posts
        const userPostsWithCounts = await Promise.all(userPosts.map(async (post) => {
            const commentCount = await Comment.countDocuments({ postId: post._id });
            return { ...post._doc, commentCount };
        }));

        const totalLikes = userPosts.reduce((acc, post) => acc + post.likes.length, 0);

        // 3. Posts liked by this user
        const likedPosts = await Post.find({ likes: userId })
            .populate('userId', 'username avatar')
            .sort({ createdAt: -1 });

        const likedPostsWithCounts = await Promise.all(likedPosts.map(async (post) => {
            const commentCount = await Comment.countDocuments({ postId: post._id });
            return { ...post._doc, commentCount };
        }));

        // 4. Posts commented on by this user
        const userComments = await Comment.find({ userId }).select('postId');
        const commentedPostIds = [...new Set(userComments.map(c => c.postId.toString()))];
        const commentedPosts = await Post.find({ _id: { $in: commentedPostIds } })
            .populate('userId', 'username avatar')
            .sort({ createdAt: -1 });

        const commentedPostsWithCounts = await Promise.all(commentedPosts.map(async (post) => {
            const commentCount = await Comment.countDocuments({ postId: post._id });
            return { ...post._doc, commentCount };
        }));

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    username: user.username,
                    avatar: user.avatar,
                    bio: user.bio,
                    class: user.onboarding?.class
                },
                stats: {
                    followers: followersCount,
                    following: followingCount,
                    totalLikes,
                    totalPosts: userPosts.length,
                    isFollowing: !!isFollowing
                },
                posts: userPostsWithCounts,
                likedPosts: likedPostsWithCounts,
                commentedPosts: commentedPostsWithCounts
            }
        });

    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
