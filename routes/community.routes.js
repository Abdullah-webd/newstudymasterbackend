import express from 'express';
import { createPost, getPosts, likePost, addComment, getComments } from '../controllers/community.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { upload } from '../config/cloudinary.config.js';

const router = express.Router();

// Public feed for unauthenticated users
router.get('/posts', getPosts);

router.use(protect);

router.route('/posts')
    .post(upload.single('image'), createPost);

router.route('/posts/:id/like')
    .put(likePost);

router.route('/posts/:id/comments')
    .post(addComment)
    .get(getComments);

export default router;
