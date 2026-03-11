import Question from '../models/question.model.js';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * @desc    Get filtered past questions
 * @route   GET /api/v1/questions
 * @access  Public
 */
export const getQuestions = async (req, res) => {
    try {
        const { subject, year, exam_name, question_type, limit, page = 1 } = req.query;

        const query = {};
        if (subject) query.subject = subject.toLowerCase();
        if (year) query.year = Number(year);
        if (exam_name) query.exam_name = exam_name.toUpperCase();
        if (question_type) query.question_type = question_type;

        const questionsQuery = Question.find(query).sort({ year: -1 });

        // Only apply limit/skip if limit is explicitly provided
        if (limit) {
            const skip = (page - 1) * Number(limit);
            questionsQuery.limit(Number(limit)).skip(skip);
        }

        const questions = await questionsQuery;
        const total = await Question.countDocuments(query);

        res.status(200).json({
            success: true,
            count: questions.length,
            pagination: {
                total,
                page: Number(page),
                pages: limit ? Math.ceil(total / limit) : 1
            },
            data: questions
        });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching questions'
        });
    }
};

/**
 * @desc    Get unique filter options (subjects, years, exam names)
 * @route   GET /api/v1/questions/filters
 * @access  Public
 */
export const getFilterOptions = async (req, res) => {
    try {
        const { subject } = req.query;
        const query = {};
        if (subject) {
            query.subject = subject.toLowerCase();
        }

        const subjects = await Question.distinct('subject');
        const years = await Question.distinct('year', query);
        const examNames = await Question.distinct('exam_name', query);
        const questionTypes = await Question.distinct('question_type', query);

        res.status(200).json({
            success: true,
            data: {
                subjects: subjects.sort(),
                years: years.sort((a, b) => b - a),
                examNames: examNames.sort(),
                questionTypes: questionTypes.sort()
            }
        });
    } catch (error) {
        console.error('Error fetching filter options:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching filter options'
        });
    }
};

/**
 * @desc    Get AI explanation for a question (Direct OpenAI call)
 * @route   POST /api/v1/questions/explain
 * @access  Public
 */
export const explainQuestion = async (req, res) => {
    try {
        const { questionData, selected_answer, onboardingData } = req.body;

        if (!questionData) {
            return res.status(400).json({
                success: false,
                message: 'Question data is required'
            });
        }

        const userClass = onboardingData?.userClass || "student";
        const isObjective = questionData.question_type === 'obj';

        const prompt = `
            You are an expert tutor. Explain the following ${questionData.exam_name} ${questionData.subject} question to a ${userClass} level student.
            
            QUESTION:
            "${questionData.question_text}"
            
            ${isObjective ? `OPTIONS: ${JSON.stringify(questionData.options)}` : ''}
            CORRECT ANSWER: "${questionData.correct_answer}"
            ${selected_answer ? `USER'S SELECTED ANSWER: "${selected_answer}"` : ''}
            
            RULES:
            1. Use Markdown headers (###) for sections.
            2. Use bold text (**text**) for emphasis.
            3. Use LaTeX for ALL mathematical expressions ($...$ for inline, $$...$$ for block).
            4. Be friendly, encouraging, and easy to understand.
            5. Break down complex concepts into simple steps.
            6. Focus on the "why" so the student learns the concept.
            
            Tone: Friendly and Educational.
            Format: Return a clear, multi-paragraph Markdown response.
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a specialized academic tutor who communicates using clean Markdown and LaTeX." },
                { role: "user", content: prompt }
            ],
        });

        const explanation = completion.choices[0].message.content;

        res.status(200).json({
            success: true,
            explanation,
            questionId: questionData._id,
            suggestions: [
                "I don't understand this part, can you explain further?",
                "Can you give me another example similar to this?",
                "What are the key concepts I should know for this topic?"
            ]
        });
    } catch (error) {
        console.error('Error in direct explanation:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error generating explanation'
        });
    }
};

/**
 * @desc    Continue follow-up explanation chat (Direct OpenAI call)
 * @route   POST /api/v1/questions/follow-up
 * @access  Public
 */
export const followUpExplanation = async (req, res) => {
    try {
        const { message, history, questionData, onboardingData } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        const userClass = onboardingData?.userClass || "student";

        // Build message history for context
        const apiMessages = [
            { role: "system", content: `You are an expert tutor helping a ${userClass} level student. Communicate using clean Markdown and LaTeX ($...$ for inline, $$...$$ for block).` },
        ];

        // Add history (limit to last 10 to keep context window clean)
        if (history && Array.isArray(history)) {
            history.slice(-10).forEach(msg => {
                apiMessages.push({ role: msg.role, content: msg.content });
            });
        }

        const prompt = `
            ${questionData ? `ORIGINAL QUESTION: "${questionData.question_text}"\nCORRECT ANSWER: "${questionData.correct_answer}"` : ''}
            
            STUDENT'S FOLLOW-UP:
            "${message}"
            
            RULES:
            1. Answer the student's specific concern clearly.
            2. Stay friendly and patient.
            3. Use LaTeX for ALL math.
        `;

        apiMessages.push({ role: "user", content: prompt });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: apiMessages,
        });

        const response = completion.choices[0].message.content;

        res.status(200).json({
            success: true,
            response,
            suggestions: [
                "Explain it in simpler terms.",
                "Show me the steps again.",
                "I'm ready for the next question."
            ]
        });
    } catch (error) {
        console.error('Error in direct follow-up:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error generating follow-up response'
        });
    }
};

/**
 * @desc    Generate AI answer for a theory question
 * @route   POST /api/v1/questions/generate-answer
 * @access  Private
 */
export const generateAnswer = async (req, res) => {
    try {
        const { questionData } = req.body;

        if (!questionData) {
            return res.status(400).json({
                success: false,
                message: 'Question data is required'
            });
        }

        const prompt = `
            You are an expert academic tutor. Provide a comprehensive and well-formatted answer to the following ${questionData.exam_name} ${questionData.subject} theory question.
            
            QUESTION:
            "${questionData.question_text}"
            
            FORMATTING RULES:
            - Use Markdown headers (###) for sections.
            - Use bold text (**text**) for emphasis.
            - Use LaTeX for ALL mathematical expressions, formulas, and symbols.
            - CRITICAL: Use single dollar signs ($...$) for inline math (e.g., $x^2 + y^2 = r^2$).
            - CRITICAL: Use double dollar signs ($$...$$) for block math/equations on new lines.
            - Provide clear, step-by-step explanations.
            - Keep the tone professional, encouraging, and academic.
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a specialized academic tutor who communicates using clean Markdown and LaTeX." },
                { role: "user", content: prompt }
            ],
        });

        const answer = completion.choices[0].message.content;

        res.status(200).json({
            success: true,
            answer
        });
    } catch (error) {
        console.error('Error generating AI answer:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error generating AI answer'
        });
    }
};
