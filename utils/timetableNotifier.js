import Timetable from '../models/timetable.model.js';
import User from '../models/user.model.js';
import { getMessagingClient } from '../config/firebaseAdmin.js';

const CHECK_INTERVAL_MS = 60 * 1000;
let workerStarted = false;

const getZonedParts = (date, timezone) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(date);
    const read = (type) => parts.find((part) => part.type === type)?.value || '';

    return {
        weekday: read('weekday'),
        year: read('year'),
        month: read('month'),
        day: read('day'),
        hour: read('hour'),
        minute: read('minute')
    };
};

const toTotalMinutes = (hhmm) => {
    const [hour, minute] = hhmm.split(':').map(Number);
    return (hour * 60) + minute;
};

const fromTotalMinutes = (minutes) => {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const hour = String(Math.floor(normalized / 60)).padStart(2, '0');
    const minute = String(normalized % 60).padStart(2, '0');
    return `${hour}:${minute}`;
};

const buildNotificationKey = (parts, triggerHHmm) => {
    return `${parts.year}-${parts.month}-${parts.day}-${triggerHHmm}`;
};

const removeBadTokens = async (userId, badTokens) => {
    if (!badTokens.length) return;
    await User.updateOne(
        { _id: userId },
        {
            $pull: {
                fcmTokens: { token: { $in: badTokens } }
            }
        }
    );
};

const sendForEntry = async (entry, tokens, currentKey, triggerHHmm) => {
    const messaging = getMessagingClient();
    if (!messaging || tokens.length === 0) {
        return false;
    }

    const link = process.env.FRONTEND_URL || 'http://localhost:3000/timetable';
    const response = await messaging.sendEachForMulticast({
        tokens,
        data: {
            type: 'timetable',
            entryId: String(entry._id),
            day: entry.day,
            startTime: entry.startTime,
            triggerTime: triggerHHmm,
            title: 'Timetable Reminder',
            body: `${entry.activity} starts at ${entry.startTime}`,
            link
        },
        webpush: {
            fcmOptions: {
                link
            }
        }
    });

    const badTokens = [];
    response.responses.forEach((result, index) => {
        if (!result.success) {
            const code = result.error?.code || '';
            console.error('FCM timetable failure:', {
                token: tokens[index],
                code,
                message: result.error?.message
            });
            if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
                badTokens.push(tokens[index]);
            }
        }
    });

    await removeBadTokens(entry.userId, badTokens);

    if (response.successCount > 0) {
        await Timetable.updateOne(
            { _id: entry._id },
            {
                $set: {
                    lastNotificationKey: currentKey,
                    lastNotifiedAt: new Date()
                }
            }
        );
        return true;
    }

    return false;
};

const runCheck = async () => {
    const messaging = getMessagingClient();
    if (!messaging) return;

    const now = new Date();
    const entries = await Timetable.find({ notificationsEnabled: true }).lean();
    if (entries.length === 0) return;

    const userIds = [...new Set(entries.map((entry) => String(entry.userId)))];
    const users = await User.find({ _id: { $in: userIds } }, { fcmTokens: 1 }).lean();
    const tokenByUser = new Map(
        users.map((user) => [
            String(user._id),
            (user.fcmTokens || []).map((tokenInfo) => tokenInfo.token).filter(Boolean)
        ])
    );

    for (const entry of entries) {
        const timezone = entry.timezone || 'UTC';
        const parts = getZonedParts(now, timezone);
        if (parts.weekday !== entry.day) {
            continue;
        }

        const currentHHmm = `${parts.hour}:${parts.minute}`;
        const triggerMinutes = toTotalMinutes(entry.startTime) - (entry.notificationOffsetMinutes || 0);
        const triggerHHmm = fromTotalMinutes(triggerMinutes);

        if (currentHHmm !== triggerHHmm) {
            continue;
        }

        const currentKey = buildNotificationKey(parts, triggerHHmm);
        if (entry.lastNotificationKey === currentKey) {
            continue;
        }

        const tokens = tokenByUser.get(String(entry.userId)) || [];
        await sendForEntry(entry, tokens, currentKey, triggerHHmm);
    }
};

export const startTimetableNotifier = () => {
    if (workerStarted) return;
    workerStarted = true;

    runCheck().catch((err) => {
        console.error('Timetable notifier run failed:', err.message);
    });

    setInterval(() => {
        runCheck().catch((err) => {
            console.error('Timetable notifier run failed:', err.message);
        });
    }, CHECK_INTERVAL_MS);
};
