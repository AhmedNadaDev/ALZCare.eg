import express from 'express';
import notificationController from '../controllers/notification.controller.js';
import { protectDoctorOrFamily } from '../middlewares/familyAuth.middleware.js';

const router = express.Router();

// All routes require authentication (doctor or family)
router.use(protectDoctorOrFamily);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.get('/recent', notificationController.getRecentNotifications);
router.get('/stats', notificationController.getNotificationStats);

router.put('/read-all', notificationController.markAllAsRead);
router.put('/:id/read', notificationController.markAsRead);
router.put('/:id/archive', notificationController.archiveNotification);

router.delete('/:id', notificationController.deleteNotification);

export default router;
