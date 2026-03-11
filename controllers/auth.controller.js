import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail.js';

// @desc    Register user (Manual Email Signup)
// @route   POST /api/v1/auth/register
// @access  Public
export const registerUser = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const userId = `U-${uuidv4().substring(0, 8)}`;
        const subscriptionId = `S-${uuidv4().substring(0, 8)}`;

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        const user = await User.create({
            username,
            email,
            password,
            userId,
            subscriptionId,
            otp,
            otpExpires,
            isEmailVerified: false
        });

        try {
            // Send Welcome Email
            await sendEmail({
                email: user.email,
                subject: 'Welcome to StudyMaster!',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: #2563eb;">Welcome to StudyMaster, ${username}!</h1>
                        <p style="font-size: 16px; color: #333; line-height: 1.6;">
                            We're excited to have you on board! StudyMaster is designed to help you excel in your studies with AI-powered notes, past questions, and personalized study plans.
                        </p>
                        <p style="font-size: 16px; color: #333; line-height: 1.6;">
                            To get started, please use the OTP below to verify your email address.
                        </p>
                        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otp}</span>
                        </div>
                        <p style="font-size: 14px; color: #666;">
                            This OTP will expire in 10 minutes. If you did not sign up for StudyMaster, please ignore this email.
                        </p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">
                            © 2026 StudyMaster. All rights reserved.
                        </p>
                    </div>
                `
            });
        } catch (err) {
            console.error('Email sending failed:', err);
        }

        return res.status(201).json({
            success: true,
            message: 'User registered. Please verify your email with the OTP sent.',
            data: {
                userId: user.userId,
                email: user.email
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Register / Login with Google (Real Verification)
// @route   POST /api/v1/auth/google
// @access  Public
export const registerWithGoogle = async (req, res, next) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ success: false, message: 'Google ID Token is required' });
        }

        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        let user = await User.findOne({ email });

        if (!user) {
            // First time registration
            const userId = `U-${uuidv4().substring(0, 8)}`;
            const subscriptionId = `S-${uuidv4().substring(0, 8)}`;

            user = await User.create({
                username: name || email.split('@')[0],
                email,
                googleId,
                userId,
                subscriptionId,
                isEmailVerified: true,
                subscription: {
                    plan: '1-day-free-trial',
                    expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            });
        } else {
            // If the user existed but didn’t register with Google before, add their googleId.
            let updated = false;
            if (!user.googleId) {
                user.googleId = googleId;
                updated = true;
            }

            // Always set isEmailVerified = true for Google users
            if (!user.isEmailVerified) {
                user.isEmailVerified = true;
                updated = true;
            }

            if (updated) {
                await user.save();
            }
        }

        return sendTokenResponse(user, 200, res);
    } catch (err) {
        console.error('Google Auth Error:', err);
        return res.status(401).json({ success: false, message: 'Invalid Google ID Token: ' + err.message });
    }
};

// @desc    Login user (Email + Password)
// @route   POST /api/v1/auth/login
// @access  Public
export const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.isEmailVerified === false) {
            // Trigger OTP resend
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpires = Date.now() + 10 * 60 * 1000;

            user.otp = otp;
            user.otpExpires = otpExpires;
            await user.save();

            try {
                await sendEmail({
                    email: user.email,
                    subject: 'Verify your StudyMaster account',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                            <h2 style="color: #2563eb;">Verify your Email</h2>
                            <p style="font-size: 16px; color: #333; line-height: 1.6;">
                                You recently tried to sign in to StudyMaster, but your email is not yet verified. Please use the OTP below to complete your verification.
                            </p>
                            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                                <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otp}</span>
                            </div>
                            <p style="font-size: 14px; color: #666;">
                                This OTP will expire in 10 minutes.
                            </p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="font-size: 12px; color: #999; text-align: center;">
                                © 2026 StudyMaster. All rights reserved.
                            </p>
                        </div>
                    `
                });
            } catch (err) {
                console.error('Email sending failed:', err);
            }

            return res.status(401).json({
                success: false,
                message: 'User has not verified their email. A new OTP has been sent.',
                needsVerification: true,
                email: user.email
            });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        return sendTokenResponse(user, 200, res);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Verify OTP
// @route   POST /api/v1/auth/verify-otp
// @access  Public
export const verifyOTP = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        user.isEmailVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully'
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Resend OTP
// @route   POST /api/v1/auth/resend-otp
// @access  Public
export const resendOTP = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Please provide an email' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        try {
            await sendEmail({
                email: user.email,
                subject: 'Your new StudyMaster OTP',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #2563eb;">Email Verification OTP</h2>
                        <p style="font-size: 16px; color: #333; line-height: 1.6;">
                            As requested, here is your new OTP for email verification.
                        </p>
                        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otp}</span>
                        </div>
                        <p style="font-size: 14px; color: #666;">
                            This OTP will expire in 10 minutes.
                        </p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">
                            © 2026 StudyMaster. All rights reserved.
                        </p>
                    </div>
                `
            });
        } catch (err) {
            console.error('Email sending failed:', err);
            return res.status(500).json({ success: false, message: 'Could not send email' });
        }

        return res.status(200).json({
            success: true,
            message: 'OTP resent successfully'
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Forgot Password - Send reset link
// @route   POST /api/v1/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User does not exist in the database, please check email address properly' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(20).toString('hex');

        // Hash token and set to resetPasswordToken field
        user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Set expire
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

        await user.save();

        // Create reset url
        // In local dev, it would be http://localhost:3000/auth/reset-password/${resetToken}
        // Use an environment variable for the client URL if possible
        const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/reset-password/${resetToken}`;

        const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a put request to: \n\n ${resetUrl}`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Reset your StudyMaster password',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #2563eb;">Password Reset Request</h2>
                        <p style="font-size: 16px; color: #333; line-height: 1.6;">
                            You are receiving this email because you (or someone else) recently requested to reset your StudyMaster password.
                        </p>
                        <p style="font-size: 16px; color: #333; line-height: 1.6;">
                            Please click the button below to set a new password:
                        </p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
                        </div>
                        <p style="font-size: 14px; color: #666;">
                            If you did not request this, please ignore this email and your password will remain unchanged.
                        </p>
                        <p style="font-size: 14px; color: #666;">
                            This link will expire in 10 minutes.
                        </p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">
                            © 2026 StudyMaster. All rights reserved.
                        </p>
                    </div>
                `
            });

            res.status(200).json({ success: true, data: 'Email sent' });
        } catch (err) {
            console.error(err);
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;

            await user.save();

            return res.status(500).json({ success: false, message: 'Email could not be sent' });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Reset Password
// @route   PUT /api/v1/auth/reset-password/:resettoken
// @access  Public
export const resetPassword = async (req, res, next) => {
    try {
        // Get hashed token
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.resettoken)
            .digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        // Set new password
        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        return sendTokenResponse(user, 200, res);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Change Password (authenticated user)
// @route   PUT /api/v1/settings/change-password
// @access  Private
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide current and new password' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user._id).select('+password');

        if (!user.password) {
            return res.status(400).json({ success: false, message: 'Password change is not available for Google-authenticated accounts' });
        }

        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        return res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

const sendTokenResponse = (user, statusCode, res) => {
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });

    const userData = {
        _id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        subscriptionId: user.subscriptionId,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        subscription: user.subscription,
        onboarding: user.onboarding
    };

    return res.status(statusCode).json({
        success: true,
        token,
        user: userData
    });
};
