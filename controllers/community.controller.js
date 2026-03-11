import Post from '../models/post.model.js';
import Comment from '../models/comment.model.js';
import { upload } from '../config/cloudinary.config.js';

// @desc    Create a new post
// @route   POST /api/v1/community/posts
// @access  Private
export const createPost = async (req, res) => {
    try {
        const { content } = req.body;
        const imageUrl = req.file ? req.file.path : '';

        const post = await Post.create({
            userId: req.user._id,
            content,
            image: imageUrl
        });

        // Populate user info for the response
        const populatedPost = await Post.findById(post._id).populate('userId', 'username avatar');

        res.status(201).json({
            success: true,
            data: populatedPost
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get all posts with user info and comment counts
// @route   GET /api/v1/community/posts
// @access  Private
export const getPosts = async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('userId', 'username avatar bio')
            .sort({ createdAt: -1 });

        // Add comment count to each post
        const postsWithCommentCount = await Promise.all(posts.map(async (post) => {
            const commentCount = await Comment.countDocuments({ postId: post._id });
            return {
                ...post._doc,
                commentCount
            };
        }));

        res.status(200).json({
            success: true,
            count: postsWithCommentCount.length,
            data: postsWithCommentCount
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Like or Unlike a post
// @route   PUT /api/v1/community/posts/:id/like
// @access  Private
export const likePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

        const isLiked = post.likes.includes(req.user._id);

        if (isLiked) {
            post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
        } else {
            post.likes.push(req.user._id);
        }

        await post.save();

        res.status(200).json({ success: true, data: post });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Create a comment on a post
// @route   POST /api/v1/community/posts/:id/comments
// @access  Private
export const addComment = async (req, res) => {
    try {
        const { content } = req.body;
        const comment = await Comment.create({
            userId: req.user._id,
            postId: req.params.id,
            content
        });

        res.status(201).json({
            success: true,
            data: comment
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get comments for a post
// @route   GET /api/v1/community/posts/:id/comments
// @access  Private
export const getComments = async (req, res) => {
    try {
        const comments = await Comment.find({ postId: req.params.id })
            .populate('userId', 'username avatar')
            .sort({ createdAt: 1 }); // Sort by oldest first for conversation flow

        res.status(200).json({
            success: true,
            data: comments
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
