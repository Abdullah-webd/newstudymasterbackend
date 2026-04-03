import mongoose from 'mongoose';

const gameAttemptSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    timeTaken: {
        type: Number,
        required: true // in milliseconds
    },
    correctCount: {
        type: Number,
        required: true,
        default: 0
    },
    totalShapes: {
        type: Number,
        default: 10
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for leaderboard performance
gameAttemptSchema.index({ timeTaken: 1 });
gameAttemptSchema.index({ createdAt: -1 });

const GameAttempt = mongoose.model('GameAttempt', gameAttemptSchema);
export default GameAttempt;
