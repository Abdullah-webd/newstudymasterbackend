import User from '../models/user.model.js';

// @desc    Get current authenticated user
// @route   GET /api/v1/user/me
// @access  Private
export const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Onboarding user (Update optional fields)
// @route   PUT /api/v1/user/onboarding
// @access  Private
export const onboardingUser = async (req, res, next) => {
    try {
        const { class: userClass, bestSubject, weakSubject, schoolName, age, goal } = req.body;

        const updateData = {};
        if (userClass !== undefined) updateData['onboarding.class'] = userClass;
        if (bestSubject !== undefined) updateData['onboarding.bestSubject'] = bestSubject;
        if (weakSubject !== undefined) updateData['onboarding.weakSubject'] = weakSubject;
        if (schoolName !== undefined) updateData['onboarding.schoolName'] = schoolName;
        if (age !== undefined) updateData['onboarding.age'] = age;
        if (goal !== undefined) updateData['onboarding.goal'] = goal;

        const completed = Boolean(
            String(userClass || '').trim() &&
            String(schoolName || '').trim() &&
            String(goal || '').trim()
        );
        if (completed) {
            updateData.onboardingCompleted = true;
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
