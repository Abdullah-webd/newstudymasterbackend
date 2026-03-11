import express from 'express';
import {
    saveTimetable,
    getTimetable,
    deleteTimetableEntry,
    upsertTimetableEntry,
    registerDeviceToken,
    unregisterDeviceToken,
    sendTestNotification,
    clearDeviceTokens
} from '../controllers/timetable.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router
    .route('/')
    .post(saveTimetable)
    .get(getTimetable);

router
    .route('/entry')
    .put(upsertTimetableEntry);

router
    .route('/device-token')
    .post(registerDeviceToken)
    .delete(unregisterDeviceToken);

router
    .route('/test-notification')
    .post(sendTestNotification);

router
    .route('/clear-tokens')
    .post(clearDeviceTokens);

router
    .route('/:id')
    .delete(deleteTimetableEntry);

export default router;
