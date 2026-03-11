import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: [true, 'Please add a subject'],
        lowercase: true,
        trim: true
    },
    year: {
        type: Number,
        required: [true, 'Please add a year']
    },
    question_number: {
        type: String,
        required: [true, 'Please add a question number']
    },
    question_type: {
        type: String,
        enum: ['theory', 'obj'],
        required: [true, 'Please add a question type']
    },
    exam_name: {
        type: String,
        enum: ['WAEC', 'NECO', 'JAMB'],
        required: [true, 'Please add an exam name']
    },
    exam_year: {
        type: String,
        required: [true, 'Please add an exam year']
    },
    question_text: {
        type: String,
        required: [true, 'Please add the question text']
    },
    options: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    correct_answer: {
        type: String,
        default: 'Not available'
    },
    explanation: {
        type: String,
        default: 'Not available'
    },
    images: {
        type: [String],
        default: []
    },
    topic: {
        type: String,
        default: 'Unknown'
    },
    source_url: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient filtering
questionSchema.index({ subject: 1, exam_name: 1, exam_year: 1, question_type: 1 });

const Question = mongoose.model('Question', questionSchema);
export default Question;
