import { Post } from '../models/postModel.js';
import { normalizeKey } from '../services/posts.service.js';
import { Logger } from '../utils/logger.js';
import { getPresignedUrl } from '../utils/presignedUrl.js';
import { requireAuth } from '../utils/requireAuth.js';

export const feedResolvers = {
  getHomeFeed: async (_, { offset = 0, limit = 10 }, context) => {
    try {
      // Get current user for isLiked field (if authenticated)
      let currentUser = null;
      try {
        currentUser = await requireAuth(context.req);
      } catch (error) {
        return {
          success: false,
          message: error,
          statusCode: 500,
          posts: [],
        };
      }

      const postsWithExtras = await Post.aggregate([
        { $sort: { createdAt: -1 } },
        { $skip: offset },
        { $limit: limit },
        // Populate author
        {
          $lookup: {
            from: 'users', // name of the User collection
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' }, // Convert author array to object
        // Lookup in Likes collection to check if the current user liked the post
        {
          $lookup: {
            from: 'likes', // the name of your Like collection in MongoDB
            let: { postId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$post', '$$postId'] },
                      { $eq: ['$user', currentUser?._id] },
                    ],
                  },
                },
              },
              { $project: { _id: 1 } },
            ],
            as: 'likedByUser',
          },
        },

        // Add the isLiked field based on whether likedByUser array is empty
        {
          $addFields: {
            isLiked: { $gt: [{ $size: '$likedByUser' }, 0] },
          },
        },

        // Optional: remove the temporary likedByUser array
        { $project: { likedByUser: 0 } },
      ]);

      if (postsWithExtras && postsWithExtras.length > 0) {
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
          postsWithExtras.map(async (post) => {
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
        message: 'Home feed fetched successfully',
        statusCode: 200,
        posts: postsWithExtras,
      };
    } catch (error) {
      Logger.error('Get home feed error:', error);
      return {
        success: false,
        message: 'Failed to fetch home feed',
        statusCode: 500,
        posts: [],
      };
    }
  },
};
