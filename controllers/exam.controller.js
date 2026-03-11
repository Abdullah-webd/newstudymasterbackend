import Exam from '../models/exam.model.js';
import Question from '../models/question.model.js';
import Activity from '../models/activity.model.js';

/**
 * @desc    Generate a new exam
 * @route   POST /api/v1/exams/generate
 * @access  Private
 */
export const generateExam = async (req, res) => {
    try {
        console.log('Generating Exam with body:', req.body);
        const { subject, exam_name, question_type, year, size = 50 } = req.body;
        const userId = req.user.id;

        if (!subject || !exam_name || !question_type) {
            return res.status(400).json({
                success: false,
                message: 'Subject, exam name, and question type are required'
            });
        }

        const matchQuery = {
            subject: subject.toLowerCase(),
            exam_name: exam_name.toUpperCase(),
            question_type: question_type.toLowerCase()
        };

        if (year) {
            matchQuery.year = Number(year);
        }

        const sampleSize = Math.max(1, Number(size) || 50);

        // Fetch questions matching the criteria
        const questions = await Question.aggregate([
            { $match: matchQuery },
            { $sample: { size: sampleSize } }
        ]);

        console.log(`Found ${questions.length} questions for criteria:`, matchQuery);

        if (questions.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No questions found for the selected criteria'
            });
        }

        const examQuestions = questions.map(q => ({
            questionId: q._id,
            userAnswer: null,
            isCorrect: false
        }));

        const exam = await Exam.create({
            userId,
            subject: subject.toLowerCase(),
            exam_name: exam_name.toUpperCase(),
            question_type: question_type.toLowerCase(),
            questions: examQuestions,
            totalQuestions: questions.length,
            status: 'ongoing'
        });

        // Start Activity tracking
        await Activity.create({
            userId,
            type: 'past_question_study',
            metadata: { examId: exam._id, subject: exam.subject },
            status: 'active',
            startTime: Date.now()
        });

        console.log('Exam created successfully:', exam._id);

        // We need the full question data for the frontend
        const populatedExam = await Exam.findById(exam._id).populate('questions.questionId');

        res.status(201).json({
            success: true,
            data: populatedExam
        });
    } catch (error) {
        console.error('Error generating exam:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error generating exam'
        });
    }
};

/**
 * @desc    Submit exam answers and mark
 * @route   POST /api/v1/exams/:id/submit
 * @access  Private
 */
/**
 * @desc    Submit objective exam answers and mark
 * @route   POST /api/v1/exams/:id/submit-objective
 * @access  Private
 */
export const submitObjectiveExam = async (req, res) => {
    try {
        const { answers } = req.body;
        const examId = req.params.id;
        const userId = req.user.id;

        const exam = await Exam.findOne({ _id: examId, userId }).populate('questions.questionId');

        if (!exam || exam.question_type !== 'obj') {
            return res.status(404).json({
                success: false,
                message: 'Objective exam session not found'
            });
        }

        if (exam.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Exam has already been submitted'
            });
        }

        let score = 0;
        const wrongQuestions = [];

        exam.questions.forEach((eq) => {
            const submittedAnswer = answers.find(a => a.questionId === eq.questionId._id.toString());
            if (submittedAnswer) {
                eq.userAnswer = submittedAnswer.userAnswer;
                if (submittedAnswer.userAnswer === eq.questionId.correct_answer) {
                    eq.isCorrect = true;
                    score++;
                } else {
                    eq.isCorrect = false;
                    wrongQuestions.push({
                        id: eq.questionId._id,
                        text: eq.questionId.question_text,
                        options: eq.questionId.options,
                        correct: eq.questionId.correct_answer,
                        user: eq.userAnswer
                    });
                }
            }
        });

        const openai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY });

        if (wrongQuestions.length > 0) {
            const feedbackPrompt = `
                The user got the following objective questions wrong in a ${exam.subject} exam.
                For each question, provide:
                1. A brief explanation of why the user's answer is wrong.
                2. A detailed explanation of the correct concept.
                
                QUESTIONS DATA:
                ${JSON.stringify(wrongQuestions)}
                
                Respond ONLY with a JSON object where keys are question IDs and values are objects containing "wrongReason" and "correctExplanation".
            `;

            const feedbackRes = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "system", content: "You are an expert tutor." }, { role: "user", content: feedbackPrompt }],
                response_format: { type: "json_object" }
            });

            const parsedFeedback = JSON.parse(feedbackRes.choices[0].message.content);
            exam.questions.forEach(eq => {
                const feedback = parsedFeedback[eq.questionId._id.toString()];
                if (feedback) {
                    eq.aiFeedback = feedback;
                }
            });
        }

        exam.score = score;
        exam.status = 'completed';
        exam.completedAt = Date.now();
        await exam.save();

        await recordActivityStop(userId, exam._id, score);

        res.status(200).json({
            success: true,
            data: exam
        });
    } catch (error) {
        console.error('Error submitting objective exam:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting objective exam'
        });
    }
};

/**
 * @desc    Submit theory exam answers and mark via AI
 * @route   POST /api/v1/exams/:id/submit-theory
 * @access  Private
 */
export const submitTheoryExam = async (req, res) => {
    try {
        const { answers } = req.body;
        const examId = req.params.id;
        const userId = req.user.id;

        const exam = await Exam.findOne({ _id: examId, userId }).populate('questions.questionId');

        if (!exam || exam.question_type !== 'theory') {
            return res.status(404).json({
                success: false,
                message: 'Theory exam session not found'
            });
        }

        if (exam.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Exam has already been submitted'
            });
        }

        const theoryQuestions = [];
        exam.questions.forEach((eq) => {
            const submittedAnswer = answers.find(a => a.questionId === eq.questionId._id.toString());
            if (submittedAnswer) {
                eq.userAnswer = submittedAnswer.userAnswer;
                theoryQuestions.push({
                    id: eq.questionId._id,
                    text: eq.questionId.question_text,
                    user: eq.userAnswer
                });
            }
        });

        const openai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY });

        let totalTheoryScore = 0;
        if (theoryQuestions.length > 0) {
            const markingPrompt = `
                Mark the following theory answers for a ${exam.subject} exam.
                For each, determine if it is correct (full marks), partially correct, or incorrect.
                Provide feedback and the ideal model answer.
                
                QUESTIONS DATA:
                ${JSON.stringify(theoryQuestions)}
                
                Respond ONLY with a JSON object where keys are question IDs and values are objects containing "isCorrect" (boolean), "score" (number, 0 to 1), "feedback", and "modelAnswer".
            `;

            const markingRes = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "system", content: "You are a fair and educational grader." }, { role: "user", content: markingPrompt }],
                response_format: { type: "json_object" }
            });

            const parsedMarking = JSON.parse(markingRes.choices[0].message.content);
            exam.questions.forEach(eq => {
                const result = parsedMarking[eq.questionId._id.toString()];
                if (result) {
                    eq.isCorrect = result.isCorrect;
                    eq.aiFeedback = result;
                    if (result.isCorrect) totalTheoryScore += (result.score || 1);
                }
            });
        }

        exam.score = totalTheoryScore;
        exam.status = 'completed';
        exam.completedAt = Date.now();
        await exam.save();

        await recordActivityStop(userId, exam._id, totalTheoryScore);

        res.status(200).json({
            success: true,
            data: exam
        });
    } catch (error) {
        console.error('Error submitting theory exam:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting theory exam'
        });
    }
};

/**
 * Helper to record activity stop
 */
const recordActivityStop = async (userId, examId, score) => {
    const activity = await Activity.findOne({
        userId,
        type: 'past_question_study',
        status: 'active',
        'metadata.examId': examId
    }).sort({ startTime: -1 });

    if (activity) {
        const endTime = Date.now();
        const duration = Math.floor((endTime - activity.startTime) / 1000);
        activity.endTime = endTime;
        activity.duration = duration;
        activity.status = 'completed';
        await activity.save();

        const { default: User } = await import('../models/user.model.js');
        const user = await User.findById(userId);
        if (user) {
            user.studyStats.totalStudyTime += duration;
            user.studyStats.lastActivity = endTime;
            user.studyStats.activityCounts.past_question_study += 1;
            await user.save();
        }
    }
};

/**
 * @desc    Get exam history for user
 * @route   GET /api/v1/exams/history
 * @access  Private
 */
export const getExamHistory = async (req, res) => {
    try {
        const history = await Exam.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .populate('questions.questionId');

        res.status(200).json({
            success: true,
            count: history.length,
            data: history
        });
    } catch (error) {
        console.error('Error fetching exam history:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching exam history'
        });
    }
};
