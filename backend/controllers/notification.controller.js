import notificationService from '../services/notification.service.js';

class NotificationController {
  /**
   * @route   GET /api/notifications
   * @desc    Get notifications
   * @access  Private (Doctor/Family)
   */
  async getNotifications(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        unreadOnly: req.query.unreadOnly === 'true',
        type: req.query.type
      };
      
      const result = await notificationService.getNotifications(
        userId,
        userRole,
        options
      );
      
      res.status(200).json({
        success: true,
        data: result.notifications,
        pagination: result.pagination,
        unreadCount: result.unreadCount
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/notifications/unread-count
   * @desc    Get unread notification count
   * @access  Private (Doctor/Family)
   */
  async getUnreadCount(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      
      const count = await notificationService.getUnreadCount(userId, userRole);
      
      res.status(200).json({
        success: true,
        data: { count }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/notifications/:id/read
   * @desc    Mark notification as read
   * @access  Private (Doctor/Family)
   */
  async markAsRead(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      
      const notification = await notificationService.markAsRead(
        req.params.id,
        userId
      );
      
      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: notification
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/notifications/read-all
   * @desc    Mark all notifications as read
   * @access  Private (Doctor/Family)
   */
  async markAllAsRead(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      
      await notificationService.markAllAsRead(userId, userRole);
      
      res.status(200).json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/notifications/:id/archive
   * @desc    Archive notification
   * @access  Private (Doctor/Family)
   */
  async archiveNotification(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      
      const notification = await notificationService.archiveNotification(
        req.params.id,
        userId
      );
      
      res.status(200).json({
        success: true,
        message: 'Notification archived',
        data: notification
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/notifications/:id
   * @desc    Delete notification
   * @access  Private (Doctor/Family)
   */
  async deleteNotification(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      
      await notificationService.deleteNotification(req.params.id, userId);
      
      res.status(200).json({
        success: true,
        message: 'Notification deleted'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/notifications/recent
   * @desc    Get recent notifications (for dashboard)
   * @access  Private (Doctor/Family)
   */
  async getRecentNotifications(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      const limit = parseInt(req.query.limit) || 5;
      
      const notifications = await notificationService.getRecentNotifications(
        userId,
        userRole,
        limit
      );
      
      res.status(200).json({
        success: true,
        data: notifications
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/notifications/stats
   * @desc    Get notification statistics
   * @access  Private (Doctor/Family)
   */
  async getNotificationStats(req, res, next) {
    try {
      const userId = req.doctor?._id || req.family?._id;
      const userRole = req.userRole;
      
      const stats = await notificationService.getNotificationStats(userId, userRole);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new NotificationController();
