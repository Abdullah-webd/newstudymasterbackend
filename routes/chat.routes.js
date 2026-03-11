import express from 'express';
import {
    createChat,
    getChats,
    getChatById,
    sendMessage
} from '../controllers/chat.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All chat routes are protected
router.use(protect);

router.post('/', createChat);
router.get('/', getChats);
router.get('/:id', getChatById);
router.post('/:id/messages', sendMessage);

export default router;
