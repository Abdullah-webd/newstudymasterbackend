import Quiz from '../models/quiz.model.js';
import Activity from '../models/activity.model.js';
import User from '../models/user.model.js';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * @desc    Get all saved quizzes for user
 * @route   GET /api/v1/quizzes
 * @access  Private
 */
export const getQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ userId: req.user.id }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: quizzes.length,
            data: quizzes
        });
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching quizzes'
        });
    }
};

/**
 * @desc    Get specific quiz by ID
 * @route   GET /api/v1/quizzes/:id
 * @access  Private
 */
export const getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findOne({ _id: req.params.id, userId: req.user.id });

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        res.status(200).json({
            success: true,
            data: quiz
        });
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching quiz'
        });
    }
};

/**
 * @desc    Submit quiz results (mark as completed and save score for dashboard)
 * @route   POST /api/v1/quizzes/:id/submit
 * @access  Private
 */
export const submitQuiz = async (req, res) => {
    try {
        const { score, totalQuestions, timeSpent } = req.body;
        const userId = req.user.id;
        const quizId = req.params.id;

        const quiz = await Quiz.findOne({ _id: quizId, userId });
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        quiz.score = score;
        quiz.status = 'completed';
        await quiz.save();

        // Save completed activity log
        try {
            const activity = await Activity.findOne({
                userId,
                type: 'quiz_study',
                status: 'active'
            }).sort({ startTime: -1 });

            if (activity) {
                const endTime = Date.now();
                const duration = timeSpent || Math.floor((endTime - activity.startTime) / 1000);
                activity.endTime = endTime;
                activity.duration = duration;
                activity.status = 'completed';
                activity.metadata = { ...activity.metadata, score, total: totalQuestions };
                await activity.save();

                const user = await User.findById(userId);
                if (user) {
                    user.studyStats.totalStudyTime += duration;
                    user.studyStats.lastActivity = endTime;
                    user.studyStats.activityCounts.quiz_study += 1;
                    await user.save();
                }
            } else {
                // Create a completed activity even if start was not tracked
                await Activity.create({
                    userId,
                    type: 'quiz_study',
                    status: 'completed',
                    startTime: new Date(Date.now() - (timeSpent || 0) * 1000),
                    endTime: new Date(),
                    duration: timeSpent || 0,
                    metadata: { score, total: totalQuestions, noteTitle: quiz.noteTitle }
                });

                const user = await User.findById(userId);
                if (user) {
                    user.studyStats.totalStudyTime += (timeSpent || 0);
                    user.studyStats.lastActivity = Date.now();
                    user.studyStats.activityCounts.quiz_study += 1;
                    await user.save();
                }
            }
        } catch (activityError) {
            console.error('Activity tracking error (non-fatal):', activityError);
        }

        res.status(200).json({
            success: true,
            data: quiz
        });
    } catch (error) {
        console.error('Error submitting quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting quiz'
        });
    }
};

/**
 * @desc    Get AI explanation for a specific quiz question
 * @route   POST /api/v1/quizzes/explain
 * @access  Private
 */
export const explainQuizQuestion = async (req, res) => {
    try {
        const { question, option, noteContent } = req.body;

        if (!question || !option) {
            return res.status(400).json({
                success: false,
                message: 'Question and selected option are required'
            });
        }

        const prompt = `
            You are an expert tutor. A student didn't understand why their answer was wrong or wants more detail on a quiz question.
            
            QUESTION: "${question.question}"
            THEIR SELECTED OPTION: "${option}"
            CORRECT ANSWER: "${question.correctAnswer}"
            BASE EXPLANATION: "${question.explanation}"
            
            ${noteContent ? `CONTEXT FROM NOTES: ${noteContent.substring(0, 1000)}` : ''}
            
            Please provide a friendly, encouraging, and detailed explanation. 
            Break down why the correct answer is right and why the student's chosen option might have been a common mistake or how it differs from the correct concept.
            Keep it conversational and helpful.
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });

        res.status(200).json({
            success: true,
            explanation: response.choices[0].message.content
        });
    } catch (error) {
        console.error('Error in AI explanation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get AI explanation'
        });
    }
};
