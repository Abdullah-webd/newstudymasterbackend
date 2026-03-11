import express from 'express';
import { generateNote, streamNoteProgress, getNotes, deleteNote, chatForNotes, toggleNoteVisibility } from '../controllers/note.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     NoteRequest:
 *       type: object
 *       required:
 *         - userRequest
 *       properties:
 *         userRequest:
 *           type: string
 *           example: "Create a note about Quantum Physics"
 *           description: The instructions for the AI to follow.
 *         currentHtml:
 *           type: string
 *           description: Optional existing HTML content if you are requesting an update.
 *         onboardingData:
 *           type: object
 *           properties:
 *             userClass:
 *               type: string
 *               example: "University Student"
 */

/**
 * @swagger
 * /api/v1/notes/generate:
 *   post:
 *     summary: Trigger the AI Note Generation Agent
 *     description: This endpoint starts a multi-step Inngest process to generate or update educational notes.
 *     tags: [Notes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NoteRequest'
 *     responses:
 *       202:
 *         description: Generation process started successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 */
router.post('/generate', protect, generateNote);
router.post('/chat', protect, chatForNotes);
router.get('/stream', protect, streamNoteProgress);
router.get('/', protect, getNotes);
router.patch('/:id/visibility', protect, toggleNoteVisibility);
router.delete('/:id', protect, deleteNote);

export default router;
