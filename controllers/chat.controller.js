import Chat from '../models/chat.model.js';
import User from '../models/user.model.js';
import Question from '../models/question.model.js';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * @desc    Create a new chat
 * @route   POST /api/v1/chats
 * @access  Private (Assumes auth middleware sets req.user)
 */
export const createChat = async (req, res) => {
    try {
        const { title, questionId } = req.body;
        const userId = req.user.id;

        const chatData = {
            userId,
            title: title || 'New Chat',
            messages: []
        };

        if (questionId) {
            chatData.questionId = questionId;
        }

        const chat = await Chat.create(chatData);

        res.status(201).json({
            success: true,
            data: chat
        });
    } catch (error) {
        console.error('Error creating chat:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating chat',
            error: error.message,
            stack: error.stack
        });
    }
};

/**
 * @desc    Get all chats for user
 * @route   GET /api/v1/chats
 * @access  Private
 */
export const getChats = async (req, res) => {
    try {
        const chats = await Chat.find({ userId: req.user.id }).sort({ updatedAt: -1 });

        res.status(200).json({
            success: true,
            count: chats.length,
            data: chats
        });
    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching chats'
        });
    }
};

/**
 * @desc    Get specific chat by ID
 * @route   GET /api/v1/chats/:id
 * @access  Private
 */
export const getChatById = async (req, res) => {
    try {
        const chat = await Chat.findOne({ _id: req.params.id, userId: req.user.id });

        if (!chat) {
            return res.status(404).json({
                success: false,
                message: 'Chat not found'
            });
        }

        res.status(200).json({
            success: true,
            data: chat
        });
    } catch (error) {
        console.error('Error fetching chat:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching chat'
        });
    }
};

/**
 * @desc    Send a message in a chat
 * @route   POST /api/v1/chats/:id/messages
 * @access  Private
 */
export const sendMessage = async (req, res) => {
    try {
        const { message } = req.body;
        const chatId = req.params.id;
        const userId = req.user.id;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        const chat = await Chat.findOne({ _id: chatId, userId });
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: 'Chat not found'
            });
        }

        // 1. Add user message to database
        chat.messages.push({ role: 'user', content: message });
        await chat.save();

        // Record Activity (simplified: ensure an active chat activity exists)
        import('../models/activity.model.js').then(async ({ default: Activity }) => {
            const activeActivity = await Activity.findOne({ userId, type: 'ai_chat', status: 'active' });
            if (!activeActivity) {
                await Activity.create({
                    userId,
                    type: 'ai_chat',
                    status: 'active',
                    startTime: Date.now(),
                    metadata: { chatId }
                });
            }
        });

        // 2. Prepare context for OpenAI
        const user = await User.findById(userId);
        const onboardingData = user?.onboarding;
        const userClass = onboardingData?.class || "student";

        let systemPrompt = `You are a helpful, friendly, and highly encouraging educational coach assisting a ${userClass} level student. 
Format your responses using beautiful markdown. Use clear headings, bullet points, bold text for emphasis, and emojis to keep the conversation engaging. Structure your answers in an extremely clean and readable way.`;

        if (chat.questionId) {
            const question = await Question.findById(chat.questionId);
            if (question) {
                systemPrompt += `\nOriginal Question Context:\n"${question.question_text}"\nCorrect Answer: "${question.correct_answer}"`;
            }
        }

        // Limit history for performance/context limits (last 10 messages)
        const history = chat.messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
        }));

        const messages = [
            { role: "system", content: systemPrompt },
            ...history
        ];

        // 3. Call OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
        });

        const assistantResponse = completion.choices[0].message.content;

        // 4. Add assistant response to database
        chat.messages.push({ role: 'assistant', content: assistantResponse });

        // Update title if it's the first message and still "New Chat"
        if (chat.title === 'New Chat' && chat.messages.length <= 3) {
            // Optional: Use AI to summarize title or just use first message
            chat.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
        }

        await chat.save();

        res.status(200).json({
            success: true,
            data: chat,
            assistantResponse,
            suggestions: [
                "Can you explain that more simply?",
                "Give me an example.",
                "I understand, let's move on."
            ]
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending message'
        });
    }
};
