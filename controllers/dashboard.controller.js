import Activity from '../models/activity.model.js';
import Exam from '../models/exam.model.js';
import User from '../models/user.model.js';
import Note from '../models/note.model.js';
import Quiz from '../models/quiz.model.js';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * @desc    Get dashboard information (recent activity, performance, motivation)
 * @route   GET /api/v1/dashboard
 * @access  Private
 */
export const getDashboardInfo = async (req, res) => {
    try {
        const mongoose = (await import('mongoose')).default;
        const userIdString = req.user.id || req.user._id.toString();
        const userObjectId = new mongoose.Types.ObjectId(userIdString);

        // 1. Fetch Recent Activity (last 5)
        const recentActivity = await Activity.find({ userId: userObjectId })
            .sort({ createdAt: -1 })
            .limit(5);

        // Calculate Study Hours from duration (stored in seconds)
        const activityAgg = await Activity.aggregate([
            { $match: { userId: userObjectId } },
            { $group: { _id: null, totalDuration: { $sum: '$duration' } } }
        ]);
        const totalSecs = activityAgg.length > 0 ? activityAgg[0].totalDuration : 0;
        let studyHours = totalSecs / 3600;
        let displayHours = "0.0";
        if (totalSecs > 0) {
            displayHours = studyHours < 0.1 ? "0.1" : studyHours.toFixed(1);
        }

        // Calculate Notes Generated
        const notesGenerated = await Note.countDocuments({ userId: userObjectId });

        // Calculate Quizzes Completed
        const quizzesCompleted = await Quiz.countDocuments({ userId: userObjectId, status: 'completed' });

        // Calculate Past Questions Practiced
        const pastQuestionsPracticed = await Activity.countDocuments({ userId: userObjectId, type: 'past_question_study', status: 'completed' });

        // Calculate 7 Days Study Trend
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const trendAggr = await Activity.aggregate([
            {
                $match: {
                    userId: userObjectId,
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalDuration: { $sum: "$duration" }
                }
            }
        ]);

        const studyTrend = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

            const foundNode = trendAggr.find(t => t._id === dateStr);
            const hours = foundNode ? (foundNode.totalDuration / 3600) : 0;

            studyTrend.push({
                day: dayName,
                hours: Number(hours.toFixed(1))
            });
        }

        // Calculate Questions Practiced & Performance
        const exams = await Exam.find({ userId: userObjectId, status: 'completed' });
        const completedQuizzes = await Quiz.find({ userId: userObjectId, status: 'completed' });

        let performance = {
            overallAverage: 0,
            strongSubject: null,
            weakSubject: null,
            subjectStats: {}
        };

        let totalQuestionsPracticed = 0;
        const subjectData = {};
        let totalScore = 0;

        if (exams.length > 0) {
            exams.forEach(exam => {
                const subj = exam.subject.toLowerCase();
                if (!subjectData[subj]) {
                    subjectData[subj] = { score: 0, count: 0, total: 0 };
                }
                subjectData[subj].score += exam.score || 0;
                subjectData[subj].total += exam.totalQuestions || 0;
                subjectData[subj].count += 1;

                totalScore += exam.score || 0;
                totalQuestionsPracticed += exam.totalQuestions || 0;
            });
        }

        if (completedQuizzes.length > 0) {
            completedQuizzes.forEach(quiz => {
                const subj = 'quizzes';
                if (!subjectData[subj]) {
                    subjectData[subj] = { score: 0, count: 0, total: 0 };
                }
                subjectData[subj].score += quiz.score || 0;
                subjectData[subj].total += quiz.questions ? quiz.questions.length : 0;
                subjectData[subj].count += 1;

                totalScore += quiz.score || 0;
                totalQuestionsPracticed += quiz.questions ? quiz.questions.length : 0;
            });
        }

        if (Object.keys(subjectData).length > 0) {
            performance.overallAverage = totalQuestionsPracticed > 0 ? (totalScore / totalQuestionsPracticed) * 100 : 0;

            let highest = -1;
            let lowest = 101;

            for (const [subj, data] of Object.entries(subjectData)) {
                if (data.total > 0) {
                    const avg = (data.score / data.total) * 100;
                    performance.subjectStats[subj] = avg;

                    if (avg > highest) {
                        highest = avg;
                        performance.strongSubject = subj;
                    }
                    if (avg < lowest) {
                        lowest = avg;
                        performance.weakSubject = subj;
                    }
                }
            }
        }

        // 3. AI Motivation
        const user = await User.findById(userIdString);
        const userClass = user?.onboarding?.class || 'student';

        let aiPrompt = `Generate a short, powerful, and highly encouraging motivation message (max 3 sentences) for a ${userClass} level student named ${user.username}.`;

        if (performance.weakSubject) {
            aiPrompt += ` They are doing great but could use some encouragement in ${performance.weakSubject}.`;
        }

        if (recentActivity.length > 0) {
            aiPrompt += ` They have been active recently with activities like ${recentActivity.map(a => a.type.replace('_', ' ')).join(', ')}.`;
        } else {
            aiPrompt += ` They haven't been very active lately, so give them a nudge to start studying!`;
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are an inspiring educational mentor." },
                { role: "user", content: aiPrompt }
            ],
        });

        const motivation = completion.choices[0].message.content;

        res.status(200).json({
            success: true,
            data: {
                user: {
                    username: user.username,
                    class: userClass
                },
                recentActivity,
                overallStats: {
                    examsCompleted: exams.length,
                    totalQuestionsPracticed: totalQuestionsPracticed,
                    notesGenerated,
                    studyHours: displayHours,
                    quizzesCompleted,
                    pastQuestionsPracticed
                },
                studyTrend,
                performance: {
                    overallAverage: performance.overallAverage.toFixed(2),
                    strongSubject: performance.strongSubject,
                    weakSubject: performance.weakSubject,
                    subjectStats: performance.subjectStats
                },
                motivation
            }
        });

    } catch (error) {
        console.error('Error fetching dashboard info:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard information'
        });
    }
};
