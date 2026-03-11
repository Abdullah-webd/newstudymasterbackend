import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['note_creation', 'note_study', 'quiz_study', 'past_question_study', 'ai_chat', 'app_session'],
        required: true
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    duration: {
        type: Number, // in seconds
        default: 0
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['active', 'completed'],
        default: 'active'
    }
}, {
    timestamps: true
});

const Activity = mongoose.model('Activity', activitySchema);
export default Activity;
