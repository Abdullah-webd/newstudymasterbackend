import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Please add a username'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    phoneNumber: {
        type: String,
        default: ''
    },
    password: {
        type: String,
        required: function () { return !this.googleId; }, // Only required if not Google login
        minlength: 6,
        select: false
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    otp: {
        type: String
    },
    otpExpires: {
        type: Date
    },
    userId: {
        type: String,
        unique: true,
        required: true
    },
    subscriptionId: {
        type: String,
        unique: true,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    // Onboarding fields
    onboarding: {
        class: String,
        bestSubject: String,
        weakSubject: String,
        schoolName: String,
        age: Number,
        goal: String,
        phoneNumber: String
    },
    onboardingCompleted: {
        type: Boolean,
        default: false
    },
    contactedByAdmin: {
        type: Boolean,
        default: false
    },
    // Subscription fields
    subscription: {
        plan: {
            type: String,
            default: '1-day-free-trial'
        },
        expirationDate: {
            type: Date,
            default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day from now
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    // Activity and Study Behavior tracking
    studyStats: {
        totalStudyTime: {
            type: Number,
            default: 0 // In seconds
        },
        lastActivity: {
            type: Date
        },
        activityCounts: {
            note_creation: { type: Number, default: 0 },
            note_study: { type: Number, default: 0 },
            quiz_study: { type: Number, default: 0 },
            past_question_study: { type: Number, default: 0 },
            ai_chat: { type: Number, default: 0 }
        }
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    avatar: {
        type: String,
        default: ''
    },
    bio: {
        type: String,
        default: ''
    },
    fcmTokens: [{
        token: {
            type: String,
            required: true
        },
        platform: {
            type: String,
            default: 'web'
        },
        deviceName: {
            type: String,
            default: ''
        },
        lastSeenAt: {
            type: Date,
            default: Date.now
        }
    }]
});

userSchema.index(
    { _id: 1, 'fcmTokens.token': 1 },
    { unique: true, sparse: true }
);

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
