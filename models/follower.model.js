import mongoose from 'mongoose';

const followerSchema = new mongoose.Schema({
    followerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    followingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Prevent duplicate follows
followerSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

const Follower = mongoose.model('Follower', followerSchema);
export default Follower;
