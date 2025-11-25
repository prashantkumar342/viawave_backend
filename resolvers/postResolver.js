import mongoose from 'mongoose';

import { deleteFile } from '../middlewares/upload.js';
import { CommentLike } from '../models/commentLikeModel.js';
import { Comment } from '../models/commentModel.js';
import { Like } from '../models/likeModel.js';
import { Post } from '../models/postModel.js';
import { normalizeKey } from '../services/posts.service.js';
import { Logger } from '../utils/logger.js';
import { getPresignedUrl } from '../utils/presignedUrl.js';
import { requireAuth } from '../utils/requireAuth.js';

export const postResolvers = {
  Query: {
    // ------------------GET MY POSTS------------------
    getMyPosts: async (_, { offset = 0, limit = 10 }, context) => {
      try {
        const user = await requireAuth(context.req);

        const posts = await Post.aggregate([
          { $match: { author: user._id } },
          { $sort: { createdAt: -1 } },
          { $skip: offset },
          { $limit: limit },

          // Populate author
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
            },
          },
          { $unwind: '$author' },

          // Lookup if current user liked each post
          {
            $lookup: {
              from: 'likes',
              let: { postId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$post', '$$postId'] },
                        { $eq: ['$user', user._id] },
                      ],
                    },
                  },
                },
              ],
              as: 'likedByUser',
            },
          },

          { $addFields: { isLiked: { $gt: [{ $size: '$likedByUser' }, 0] } } },
          { $project: { likedByUser: 0 } },
        ]);

        if (posts && posts.length > 0) {
          // caches to avoid signing/generating same key multiple times in single request
          const presignCache = new Map();
          const thumbCache = new Map();

          // helper to determine whether URL looks already absolute
          const isAbsoluteUrl = (u) => {
            if (!u || typeof u !== 'string') return false;
            return /^https?:\/\//i.test(u);
          };

          // choose expiry as needed (seconds)
          const PRESIGN_EXPIRES = 60 * 60; // 1 hour — adjust if you want shorter/longer

          // sign all posts in parallel (but keep per-media parallelism)
          await Promise.all(
            posts.map(async (post) => {
              if (!Array.isArray(post.media) || post.media.length === 0) return;

              await Promise.all(
                post.media.map(async (m) => {
                  if (!m || !m.url) return;

                  // if already absolute, leave it (but still may want thumbnail handling)
                  if (isAbsoluteUrl(m.url)) {
                    // If thumbnailUrl present and absolute, leave. If missing and video, try to generate? (skip for external assets)
                    if (m.thumbnailUrl && !isAbsoluteUrl(m.thumbnailUrl)) {
                      // presign thumbnail key if present and not absolute
                      const tKey = normalizeKey(m.thumbnailUrl);
                      if (thumbCache.has(tKey)) {
                        m.thumbnailUrl = thumbCache.get(tKey);
                      } else {
                        try {
                          const presignedThumb = await getPresignedUrl(
                            tKey,
                            PRESIGN_EXPIRES
                          );
                          thumbCache.set(tKey, presignedThumb);
                          m.thumbnailUrl = presignedThumb;
                        } catch (err) {
                          console.error(
                            'Presign thumbnail error for key',
                            tKey,
                            err
                          );
                          m.thumbnailUrl = null;
                        }
                      }
                    } else {
                      m.thumbnailUrl = m.thumbnailUrl || null;
                    }
                    return;
                  }

                  // normalize key: remove leading slash if any
                  let key = m.url;
                  if (key.startsWith('/')) key = key.slice(1);
                  key = normalizeKey(key); // ensure consistent form

                  // === presign main URL if not absolute ===
                  if (m.type === 'video') {
                    //ignore
                  } else {
                    if (presignCache.has(key)) {
                      m.url = presignCache.get(key);
                    } else {
                      try {
                        const signed = await getPresignedUrl(
                          key,
                          PRESIGN_EXPIRES
                        );
                        presignCache.set(key, signed);
                        m.url = signed;
                      } catch (err) {
                        console.error('Presign error for key', key, err);
                        // leave original key so client can request presign endpoint if needed
                      }
                    }
                  }

                  // === handle thumbnailUrl ===
                  // 1) If DB already has thumbnail key (m.thumbnailUrl truthy string)
                  if (
                    m.thumbnailUrl &&
                    typeof m.thumbnailUrl === 'string' &&
                    m.thumbnailUrl.trim() !== ''
                  ) {
                    let thumbKey = m.thumbnailUrl;
                    if (thumbKey.startsWith('/')) thumbKey = thumbKey.slice(1);
                    thumbKey = normalizeKey(thumbKey);

                    if (thumbCache.has(thumbKey)) {
                      m.thumbnailUrl = thumbCache.get(thumbKey);
                    } else {
                      try {
                        const signedThumb = await getPresignedUrl(
                          thumbKey,
                          PRESIGN_EXPIRES
                        );
                        thumbCache.set(thumbKey, signedThumb);
                        m.thumbnailUrl = signedThumb;
                      } catch (err) {
                        console.error(
                          'Presign thumbnail error for key',
                          thumbKey,
                          err
                        );
                        m.thumbnailUrl = null;
                      }
                    }
                  } else {
                    // image but no thumbnail stored -> set null (client may display scaled image)
                    m.thumbnailUrl = null;
                  }
                })
              );
            })
          );
        }

        return {
          success: true,
          message: 'My posts fetched successfully',
          statusCode: 200,
          posts,
        };
      } catch (error) {
        Logger.error('Get my posts error:', error);
        return {
          success: false,
          message: 'Failed to fetch your posts',
          statusCode: 500,
          posts: [],
        };
      }
    },

    // ------------------GET USER POSTS------------------
    getUserPosts: async (_, { userId, offset = 0, limit = 10 }, context) => {
      try {
        const currentUser = await requireAuth(context.req);

        // If userId is not provided, default to currentUser
        const targetUserId = userId || currentUser._id;

        const posts = await Post.aggregate([
          {
            $match: { author: new mongoose.Types.ObjectId(targetUserId) },
          },
          { $sort: { createdAt: -1 } },
          { $skip: offset },
          { $limit: limit },

          // Populate author
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
            },
          },
          { $unwind: '$author' },

          // Check if the logged-in user liked this post
          {
            $lookup: {
              from: 'likes',
              let: { postId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$post', '$$postId'] },
                        { $eq: ['$user', currentUser._id] },
                      ],
                    },
                  },
                },
              ],
              as: 'likedByUser',
            },
          },

          // Add `isLiked` field
          {
            $addFields: {
              isLiked: { $gt: [{ $size: '$likedByUser' }, 0] },
            },
          },

          // Clean up fields
          {
            $project: {
              likedByUser: 0,
            },
          },
        ]);

        if (posts && posts.length > 0) {
          // caches to avoid signing/generating same key multiple times in single request
          const presignCache = new Map();
          const thumbCache = new Map();

          // helper to determine whether URL looks already absolute
          const isAbsoluteUrl = (u) => {
            if (!u || typeof u !== 'string') return false;
            return /^https?:\/\//i.test(u);
          };

          // choose expiry as needed (seconds)
          const PRESIGN_EXPIRES = 60 * 60; // 1 hour — adjust if you want shorter/longer

          // sign all posts in parallel (but keep per-media parallelism)
          await Promise.all(
            posts.map(async (post) => {
              if (!Array.isArray(post.media) || post.media.length === 0) return;

              await Promise.all(
                post.media.map(async (m) => {
                  if (!m || !m.url) return;

                  // if already absolute, leave it (but still may want thumbnail handling)
                  if (isAbsoluteUrl(m.url)) {
                    // If thumbnailUrl present and absolute, leave. If missing and video, try to generate? (skip for external assets)
                    if (m.thumbnailUrl && !isAbsoluteUrl(m.thumbnailUrl)) {
                      // presign thumbnail key if present and not absolute
                      const tKey = normalizeKey(m.thumbnailUrl);
                      if (thumbCache.has(tKey)) {
                        m.thumbnailUrl = thumbCache.get(tKey);
                      } else {
                        try {
                          const presignedThumb = await getPresignedUrl(
                            tKey,
                            PRESIGN_EXPIRES
                          );
                          thumbCache.set(tKey, presignedThumb);
                          m.thumbnailUrl = presignedThumb;
                        } catch (err) {
                          console.error(
                            'Presign thumbnail error for key',
                            tKey,
                            err
                          );
                          m.thumbnailUrl = null;
                        }
                      }
                    } else {
                      m.thumbnailUrl = m.thumbnailUrl || null;
                    }
                    return;
                  }

                  // normalize key: remove leading slash if any
                  let key = m.url;
                  if (key.startsWith('/')) key = key.slice(1);
                  key = normalizeKey(key); // ensure consistent form

                  // === presign main URL if not absolute ===
                  if (m.type === 'video') {
                    //ignore
                  } else {
                    if (presignCache.has(key)) {
                      m.url = presignCache.get(key);
                    } else {
                      try {
                        const signed = await getPresignedUrl(
                          key,
                          PRESIGN_EXPIRES
                        );
                        presignCache.set(key, signed);
                        m.url = signed;
                      } catch (err) {
                        console.error('Presign error for key', key, err);
                        // leave original key so client can request presign endpoint if needed
                      }
                    }
                  }

                  // === handle thumbnailUrl ===
                  // 1) If DB already has thumbnail key (m.thumbnailUrl truthy string)
                  if (
                    m.thumbnailUrl &&
                    typeof m.thumbnailUrl === 'string' &&
                    m.thumbnailUrl.trim() !== ''
                  ) {
                    let thumbKey = m.thumbnailUrl;
                    if (thumbKey.startsWith('/')) thumbKey = thumbKey.slice(1);
                    thumbKey = normalizeKey(thumbKey);

                    if (thumbCache.has(thumbKey)) {
                      m.thumbnailUrl = thumbCache.get(thumbKey);
                    } else {
                      try {
                        const signedThumb = await getPresignedUrl(
                          thumbKey,
                          PRESIGN_EXPIRES
                        );
                        thumbCache.set(thumbKey, signedThumb);
                        m.thumbnailUrl = signedThumb;
                      } catch (err) {
                        console.error(
                          'Presign thumbnail error for key',
                          thumbKey,
                          err
                        );
                        m.thumbnailUrl = null;
                      }
                    }
                  } else {
                    // image but no thumbnail stored -> set null (client may display scaled image)
                    m.thumbnailUrl = null;
                  }
                })
              );
            })
          );
        }

        return {
          success: true,
          message: 'User posts fetched successfully',
          statusCode: 200,
          posts,
        };
      } catch (error) {
        Logger.error('Get user posts error:', error);
        return {
          success: false,
          message: 'Failed to fetch user posts',
          statusCode: 500,
          posts: [],
        };
      }
    },

    // ------------------GET POST BY ID------------------
    getPostById: async (_, { postId }, context) => {
      try {
        const user = await requireAuth(context.req);

        const posts = await Post.aggregate([
          { $match: { _id: new mongoose.Types.ObjectId(postId) } },

          // Populate author
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
            },
          },
          { $unwind: '$author' },

          // Lookup if current user liked
          {
            $lookup: {
              from: 'likes',
              let: { postId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$post', '$$postId'] },
                        { $eq: ['$user', user._id] },
                      ],
                    },
                  },
                },
              ],
              as: 'likedByUser',
            },
          },

          { $addFields: { isLiked: { $gt: [{ $size: '$likedByUser' }, 0] } } },
          { $project: { likedByUser: 0 } },
        ]);

        if (!posts.length) {
          return {
            success: false,
            message: 'Post not found',
            statusCode: 404,
            post: null,
          };
        }

        if (posts && posts.length > 0) {
          // caches to avoid signing/generating same key multiple times in single request
          const presignCache = new Map();
          const thumbCache = new Map();

          // helper to determine whether URL looks already absolute
          const isAbsoluteUrl = (u) => {
            if (!u || typeof u !== 'string') return false;
            return /^https?:\/\//i.test(u);
          };

          // choose expiry as needed (seconds)
          const PRESIGN_EXPIRES = 60 * 60; // 1 hour — adjust if you want shorter/longer

          // sign all posts in parallel (but keep per-media parallelism)
          await Promise.all(
            posts.map(async (post) => {
              if (!Array.isArray(post.media) || post.media.length === 0) return;

              await Promise.all(
                post.media.map(async (m) => {
                  if (!m || !m.url) return;

                  // if already absolute, leave it (but still may want thumbnail handling)
                  if (isAbsoluteUrl(m.url)) {
                    // If thumbnailUrl present and absolute, leave. If missing and video, try to generate? (skip for external assets)
                    if (m.thumbnailUrl && !isAbsoluteUrl(m.thumbnailUrl)) {
                      // presign thumbnail key if present and not absolute
                      const tKey = normalizeKey(m.thumbnailUrl);
                      if (thumbCache.has(tKey)) {
                        m.thumbnailUrl = thumbCache.get(tKey);
                      } else {
                        try {
                          const presignedThumb = await getPresignedUrl(
                            tKey,
                            PRESIGN_EXPIRES
                          );
                          thumbCache.set(tKey, presignedThumb);
                          m.thumbnailUrl = presignedThumb;
                        } catch (err) {
                          console.error(
                            'Presign thumbnail error for key',
                            tKey,
                            err
                          );
                          m.thumbnailUrl = null;
                        }
                      }
                    } else {
                      m.thumbnailUrl = m.thumbnailUrl || null;
                    }
                    return;
                  }

                  // normalize key: remove leading slash if any
                  let key = m.url;
                  if (key.startsWith('/')) key = key.slice(1);
                  key = normalizeKey(key); // ensure consistent form

                  // === presign main URL if not absolute ===
                  if (m.type === 'video') {
                    //ignore
                  } else {
                    if (presignCache.has(key)) {
                      m.url = presignCache.get(key);
                    } else {
                      try {
                        const signed = await getPresignedUrl(
                          key,
                          PRESIGN_EXPIRES
                        );
                        presignCache.set(key, signed);
                        m.url = signed;
                      } catch (err) {
                        console.error('Presign error for key', key, err);
                        // leave original key so client can request presign endpoint if needed
                      }
                    }
                  }

                  // === handle thumbnailUrl ===
                  // 1) If DB already has thumbnail key (m.thumbnailUrl truthy string)
                  if (
                    m.thumbnailUrl &&
                    typeof m.thumbnailUrl === 'string' &&
                    m.thumbnailUrl.trim() !== ''
                  ) {
                    let thumbKey = m.thumbnailUrl;
                    if (thumbKey.startsWith('/')) thumbKey = thumbKey.slice(1);
                    thumbKey = normalizeKey(thumbKey);

                    if (thumbCache.has(thumbKey)) {
                      m.thumbnailUrl = thumbCache.get(thumbKey);
                    } else {
                      try {
                        const signedThumb = await getPresignedUrl(
                          thumbKey,
                          PRESIGN_EXPIRES
                        );
                        thumbCache.set(thumbKey, signedThumb);
                        m.thumbnailUrl = signedThumb;
                      } catch (err) {
                        console.error(
                          'Presign thumbnail error for key',
                          thumbKey,
                          err
                        );
                        m.thumbnailUrl = null;
                      }
                    }
                  } else {
                    // image but no thumbnail stored -> set null (client may display scaled image)
                    m.thumbnailUrl = null;
                  }
                })
              );
            })
          );
        }

        return {
          success: true,
          message: 'Post fetched successfully',
          statusCode: 200,
          post: posts[0],
        };
      } catch (error) {
        Logger.error('Get post by ID error:', error);
        return {
          success: false,
          message: 'Failed to fetch post',
          statusCode: 500,
          post: null,
        };
      }
    },
  },

  Mutation: {
    // ------------------DELETE POST------------------
    deletePost: async (_, { postId }, context) => {
      try {
        const user = await requireAuth(context.req);
        const post = await Post.findById(postId);

        if (!post) {
          return {
            success: false,
            message: 'Post not found',
            statusCode: 404,
          };
        }

        if (post.author.toString() !== user._id.toString()) {
          return {
            success: false,
            message: 'Unauthorized to delete this post',
            statusCode: 403,
          };
        }

        // Delete media files if exist
        try {
          if (post.media?.length) {
            for (const item of post.media) {
              await deleteFile(item.url);
              if (item.thumbnailUrl) await deleteFile(item.thumbnailUrl);
            }
          }
        } catch (fileError) {
          Logger.warn('Could not delete post files:', fileError);
        }

        await Promise.all([
          Like.deleteMany({ post: postId }),
          Comment.deleteMany({ post: postId }),
          CommentLike.deleteMany({ post: postId }),
          Post.deleteOne({ _id: postId }),
        ]);

        return {
          success: true,
          message: 'Post deleted successfully',
          statusCode: 200,
        };
      } catch (error) {
        Logger.error('Delete post error:', error);
        return {
          success: false,
          message: 'Failed to delete post',
          statusCode: 500,
        };
      }
    },
  },
};
