import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String, // HTML content
        required: true
    },
    tag: {
        type: String,
        default: 'General'
    },
    chatHistory: {
        type: Array,
        default: []
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    quizId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz'
    }
}, {
    timestamps: true
});

const Note = mongoose.model('Note', noteSchema);
export default Note;
