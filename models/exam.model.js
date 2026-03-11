import mongoose from 'mongoose';

const examQuestionSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true
    },
    userAnswer: {
        type: String,
        default: null
    },
    isCorrect: {
        type: Boolean,
        default: false
    },
    aiFeedback: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
});

const examSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true,
        lowercase: true
    },
    exam_name: {
        type: String,
        enum: ['JAMB', 'NECO', 'WAEC'],
        required: true
    },
    question_type: {
        type: String,
        enum: ['obj', 'theory'],
        required: true
    },
    questions: [examQuestionSchema],
    score: {
        type: Number,
        default: 0
    },
    totalQuestions: {
        type: Number,
        default: 60
    },
    status: {
        type: String,
        enum: ['ongoing', 'completed'],
        default: 'ongoing'
    },
    completedAt: {
        type: Date
    }
}, {
    timestamps: true
});

const Exam = mongoose.model('Exam', examSchema);
export default Exam;
