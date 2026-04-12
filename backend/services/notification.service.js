import Notification from '../models/Notification.model.js';

class NotificationService {
  /**
   * Get notifications for a user
   */
  async getNotifications(userId, userRole, options = {}) {
    const { page = 1, limit = 20, unreadOnly = false, type = null } = options;
    
    const recipientModel = userRole === 'doctor' ? 'Doctor' : 'Family';
    
    const query = {
      recipient: userId,
      recipientModel,
      isArchived: false
    };

    if (unreadOnly) {
      query.isRead = false;
    }

    if (type) {
      query.type = type;
    }

    const total = await Notification.countDocuments(query);
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('patient', 'firstName lastName patientNumber');

    return {
      notifications,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      unreadCount: await Notification.getUnreadCount(userId, recipientModel)
    };
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId, userRole) {
    const recipientModel = userRole === 'doctor' ? 'Doctor' : 'Family';
    return Notification.getUnreadCount(userId, recipientModel);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw { status: 404, message: 'Notification not found' };
    }

    if (notification.recipient.toString() !== userId.toString()) {
      throw { status: 403, message: 'Not authorized to access this notification' };
    }

    await notification.markAsRead();

    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId, userRole) {
    const recipientModel = userRole === 'doctor' ? 'Doctor' : 'Family';

    await Notification.updateMany(
      {
        recipient: userId,
        recipientModel,
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    return { message: 'All notifications marked as read' };
  }

  /**
   * Archive notification
   */
  async archiveNotification(notificationId, userId) {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw { status: 404, message: 'Notification not found' };
    }

    if (notification.recipient.toString() !== userId.toString()) {
      throw { status: 403, message: 'Not authorized to access this notification' };
    }

    notification.isArchived = true;
    await notification.save();

    return notification;
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw { status: 404, message: 'Notification not found' };
    }

    if (notification.recipient.toString() !== userId.toString()) {
      throw { status: 403, message: 'Not authorized to delete this notification' };
    }

    await Notification.findByIdAndDelete(notificationId);

    return { message: 'Notification deleted successfully' };
  }

  /**
   * Create custom notification
   */
  async createNotification(data) {
    const notification = await Notification.create({
      recipient: data.recipientId,
      recipientModel: data.recipientModel,
      patient: data.patientId,
      type: data.type,
      priority: data.priority || 'medium',
      title: data.title,
      message: data.message,
      data: data.data || {}
    });

    return notification;
  }

  /**
   * Get notifications by type
   */
  async getNotificationsByType(userId, userRole, type, options = {}) {
    const { page = 1, limit = 20 } = options;
    const recipientModel = userRole === 'doctor' ? 'Doctor' : 'Family';

    const query = {
      recipient: userId,
      recipientModel,
      type,
      isArchived: false
    };

    const total = await Notification.countDocuments(query);
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('patient', 'firstName lastName patientNumber');

    return {
      notifications,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    };
  }

  /**
   * Get recent notifications (for dashboard)
   */
  async getRecentNotifications(userId, userRole, limit = 5) {
    const recipientModel = userRole === 'doctor' ? 'Doctor' : 'Family';
    return Notification.getRecent(userId, recipientModel, limit);
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId, userRole) {
    const recipientModel = userRole === 'doctor' ? 'Doctor' : 'Family';
    
    const stats = await Notification.aggregate([
      {
        $match: {
          recipient: userId,
          recipientModel,
          isArchived: false
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          }
        }
      }
    ]);

    const totalUnread = await Notification.getUnreadCount(userId, recipientModel);
    const urgentUnread = await Notification.countDocuments({
      recipient: userId,
      recipientModel,
      isRead: false,
      priority: 'urgent'
    });

    return {
      byType: stats,
      totalUnread,
      urgentUnread
    };
  }
}

export default new NotificationService();
