import { notificationModel as Notification } from "../models/notificationModel"

export const createNotification = async (data) => {
  const notif = new Notification({
    userId: data.userId,
    type: data.type,
    source: data.source,
    title: data.title,
    description: data.description,
    imageUrl: data.imageUrl,
    action: data.action,
  });
  return await notif.save();
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


export const createSocialActivity = (userId, actorSource, title, description) =>
  createNotification({
    userId,
    type: 'SOCIAL_ACTIVITY',
    source: actorSource,
    title,
    description
  });

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