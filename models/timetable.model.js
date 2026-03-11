import mongoose from 'mongoose';

const timetableSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        required: true
    },
    startTime: {
        type: String,
        required: true,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please add a valid start time in HH:mm format']
    },
    endTime: {
        type: String,
        required: true,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please add a valid end time in HH:mm format']
    },
    activity: {
        type: String,
        required: true,
        trim: true
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    notificationsEnabled: {
        type: Boolean,
        default: true
    },
    notificationOffsetMinutes: {
        type: Number,
        default: 0,
        min: 0,
        max: 120
    },
    lastNotificationKey: {
        type: String,
        default: null
    },
    lastNotifiedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

timetableSchema.index({ userId: 1, day: 1, startTime: 1 }, { unique: true });

const Timetable = mongoose.model('Timetable', timetableSchema);
export default Timetable;
