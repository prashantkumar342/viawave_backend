import { Notification } from "../models/notificationModel.js";
import { pushNotifications } from "./pushNotifications.service.js";
import { decrementUnread, incrementUnread } from './userUnreads.services.js';

const { sendToUser } = pushNotifications();

export const createNotification = async (data) => {
  try {
    const notif = new Notification({
      userId: data.userId,
      type: data.type,
      source: data.source,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      action: data.action,
    });

    await notif.save();
    await incrementUnread(data.userId, 'notifications', 1);
    // Send push notification if user ID and message exist
    if (data.userId && data.title) {
      await sendToUser(data.userId, data.title, data.description);
    }

    return notif;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export const createPromotional = (userId, title, description, actionLabel, actionUrl) =>
  createNotification({
    userId,
    type: 'PROMOTIONAL',
    title,
    description,
    action: { label: actionLabel, url: actionUrl }
  });

export const createJobOpportunity = (userId, companySource, title, description, actionLabel, actionUrl) =>
  createNotification({
    userId,
    type: 'JOB_OPPORTUNITY',
    source: companySource,
    title,
    description,
    action: { label: actionLabel, url: actionUrl }
  });

export const createContentRecommendation = (userId, publisherSource, title, imageUrl) =>
  createNotification({
    userId,
    type: 'CONTENT_RECOMMENDATION',
    source: publisherSource,
    title,
    imageUrl
  });

export const createSocialActivity = (userId, actorId, actorName, actorAvatar, title, description, actionLabel, actionUrl) =>
  createNotification({
    userId,
    type: 'SOCIAL_ACTIVITY',
    source: {
      id: actorId,
      name: actorName,
      avatarUrl: actorAvatar
    },
    title,
    description,
    action: { label: actionLabel, url: actionUrl }
  });

// Delete notification by user and actor (for link request withdrawals)
export const deleteLinkRequestNotification = async (userId, actorId) => {
  try {
    const deletedNotification = await Notification.findOne({
      userId: userId,
      type: 'SOCIAL_ACTIVITY',
      'source.id': actorId,
      title: 'New Link Request'
    });

    if (!deletedNotification) {
      return null;
    }

    // ✅ Decrement unread count if it was unread
    if (deletedNotification.status === 'UNREAD') {
      await decrementUnread(userId, 'notifications', 1);
    }

    await deletedNotification.deleteOne();

    const notificationObj = deletedNotification.toObject();
    return {
      ...notificationObj,
      id: notificationObj._id.toString(),
      notificationUpdate: "DELETE"
    };
  } catch (error) {
    console.error('Error deleting link request notification:', error);
    throw error;
  }
};



export const createPersonalizedSuggestion = (userId, curatorSource, title) =>
  createNotification({
    userId,
    type: 'PERSONALIZED_SUGGESTION',
    source: curatorSource,
    title
  });

export const createProfileActivity = (userId, title, description, actionLabel, actionUrl) =>
  createNotification({
    userId,
    type: 'PROFILE_ACTIVITY',
    title,
    description,
    action: actionLabel && actionUrl ? { label: actionLabel, url: actionUrl } : undefined
  });

// Updated to use offset instead of skip
export const getNotifications = async (userId, limit, offset, status = null) => {
  try {
    const filter = { userId };
    if (status) filter.status = status;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit || 20)
      .skip(offset || 0) // MongoDB still uses skip internally, but we call it offset in our API
      .lean();

    // Add id field as string for each notification (for GraphQL)
    return notifications.map(n => ({
      ...n,
      id: n._id.toString(),
      userId: n.userId ? n.userId.toString() : null,
      source: n.source
        ? { ...n.source, id: n.source.id ? n.source.id.toString() : null }
        : undefined
    }));
  } catch (error) {
    console.error("Error fetching notifications", error);
    throw error;
  }
};

export const markAsRead = async (notificationId, userId) => {
  try {
    const result = await Notification.findByIdAndUpdate(notificationId, { $set: { status: 'READ' } })
    if (result.modifiedCount > 0) {
      await decrementUnread(userId, 'notifications', result.modifiedCount);
    }
    return { ...result.toObject(), notificationUpdate: 'READ' };
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
};

export const markAllAsRead = async (userId) => {
  try {
    const result = await Notification.updateMany(
      { userId: userId, status: 'UNREAD' },
      { $set: { status: 'READ' } }
    );
    if (result.modifiedCount > 0) {
      await decrementUnread(userId, 'notifications', result.modifiedCount);
    }
    return result;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

export const deleteNotification = async (notificationId, userId) => {
  try {
    // 🔍 Find and delete in one step — returns the deleted document!
    const deletedNotification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId: userId,
    });

    if (!deletedNotification) {
      throw new Error('Notification not found or already deleted');
    }

    // ✅ Decrement unread count if the deleted notification was unread
    if (deletedNotification.status === 'UNREAD') {
      await decrementUnread(userId, 'notifications', 1);
    }

    // ✅ Optionally add your custom field (like notificationUpdate)
    return {
      ...deletedNotification.toObject(),
      notificationUpdate: 'DELETED',
    };
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    throw error;
  }
};


export const deleteAllNotifications = async (userId) => {
  try {
    const unreadCount = await Notification.countDocuments({
      userId: userId,
      status: 'UNREAD'
    });
    const result = await Notification.deleteMany({ userId });
    if (unreadCount > 0) {
      await decrementUnread(userId, 'notifications', unreadCount);
    }
    return result;
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    throw error;
  }
};

export const getUnreadCount = async (userId) => {
  try {
    const count = await Notification.countDocuments({
      userId: userId,
      status: 'UNREAD'
    });

    return count;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
};