import { inngest } from '../inngest/routes.js';
import noteEventEmitter from '../utils/eventEmitter.js';
import Note from '../models/note.model.js';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Controller to trigger the Inngest note generation process
 * @param {Object} req 
 * @param {Object} res 
 */
export const generateNote = async (req, res) => {
    try {
        const { userRequest, currentHtml, onboardingData } = req.body;

        if (!userRequest) {
            return res.status(400).json({
                success: false,
                message: 'User request is required. Please provide instructions for the note.'
            });
        }

        // Send event to Inngest to trigger the asynchronous agent
        await inngest.send({
            name: 'api/note.requested',
            data: {
                input: {
                    userRequest,
                    currentHtml,
                    noteId: req.body.noteId
                },
                onboardingData: onboardingData || { userClass: "general learner" },
                userId: req.user.id
            }
        });

        // 202 Accepted is appropriate for long-running async tasks
        res.status(202).json({
            success: true,
            message: 'Note generation has started. You will receive updates via the stream.',
        });
    } catch (error) {
        console.error('Error triggering note generation:', error);
        res.status(500).json({
            success: false,
            message: 'A general error occurred while initiating note generation.'
        });
    }
};

/**
 * Controller to stream note generation progress via SSE
 * @param {Object} req 
 * @param {Object} res 
 */
export const streamNoteProgress = (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*' // Adjust as needed for security
    });

    const userId = req.user.id;

    const onProgress = (data) => {
        if (data.userId === userId) {
            res.write(`data: ${JSON.stringify({ message: data.message })}\n\n`);
        }
    };

    noteEventEmitter.on('progress', onProgress);

    // Send initial connection heartbeat
    res.write(`data: ${JSON.stringify({ message: 'Connected to progress stream' })}\n\n`);

    req.on('close', () => {
        noteEventEmitter.off('progress', onProgress);
    });
};

/**
 * Get all notes for the logged-in user
 * @param {Object} req 
 * @param {Object} res 
 */
export const getNotes = async (req, res) => {
    try {
        const notes = await Note.find({ userId: req.user.id }).populate('quizId').sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: notes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching notes'
        });
    }
};

export const deleteNote = async (req, res) => {
    try {
        const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Note deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting note'
        });
    }
};

/**
 * Toggle visibility of a note
 * @param {Object} req 
 * @param {Object} res 
 */
export const toggleNoteVisibility = async (req, res) => {
    try {
        const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        note.isPublic = !note.isPublic;
        await note.save();

        res.status(200).json({
            success: true,
            message: `Note is now ${note.isPublic ? 'public' : 'private'}`,
            isPublic: note.isPublic
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating visibility'
        });
    }
};

/**
 * Handle OpenAI chat and detect note generation intent
 * @param {Object} req 
 * @param {Object} res 
 */
export const chatForNotes = async (req, res) => {
    try {
        const { messages, onboardingData } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ success: false, message: 'Messages array is required' });
        }

        const userClass = onboardingData?.class || "student";
        const systemPrompt = `You are a helpful and friendly educational tutor assisting a ${userClass} level student. You can answer study questions, explain concepts, and help them learn. If the user explicitly asks to generate or create structured study notes on a specific topic, gracefully extract that topic and call the trigger_note_generation tool. Wait, if the user says they want to generate notes but does not provide a topic, gently ask them what topic they would like the notes to cover first. Do not call the tool unless a topic is clearly identified from the user's request.`;

        const apiMessages = [
            { role: "system", content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.message }))
        ];

        const tools = [
            {
                type: "function",
                function: {
                    name: "trigger_note_generation",
                    description: "Triggers the generation of structured study notes for a specific topic when requested by the user.",
                    parameters: {
                        type: "object",
                        properties: {
                            topic: {
                                type: "string",
                                description: "The specific topic for which the user wants to generate notes."
                            }
                        },
                        required: ["topic"]
                    }
                }
            }
        ];

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: apiMessages,
            tools: tools,
            tool_choice: "auto",
        });

        const responseMessage = completion.choices[0].message;

        // Check if the model wants to call a function
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            const toolCall = responseMessage.tool_calls[0];
            if (toolCall.function.name === 'trigger_note_generation') {
                const args = JSON.parse(toolCall.function.arguments);
                return res.status(200).json({
                    success: true,
                    intent: 'generate_notes',
                    topic: args.topic
                });
            }
        }

        // Otherwise, it's a normal chat response
        return res.status(200).json({
            success: true,
            intent: 'chat',
            message: responseMessage.content
        });

    } catch (error) {
        console.error('Error in chatForNotes:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during chat.',
            intent: 'error'
        });
    }
};

