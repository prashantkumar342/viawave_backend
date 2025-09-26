import { Like } from "../models/likeModel.js";
import { ArticlePost, ImagePost, VideoPost } from "../models/postModel.js";
import { Logger } from "../utils/logger.js";
import { requireAuth } from "../utils/requireAuth.js";

const addIsLikedToPosts = async (posts, userId) => {
  if (!userId || posts.length === 0) {
    return posts.map(post => ({
      ...post,
      isLiked: false,
    }));
  }

  // Get all post IDs
  const postIds = posts.map(post => post.id);

  // Get all likes for these posts by the current user
  const userLikes = await Like.find({
    post: { $in: postIds },
    user: userId
  }).select('post');

  // Create a Set of liked post IDs for quick lookup
  const likedPostIds = new Set(userLikes.map(like => like.post.toString()));

  // Add isLiked field to each post
  return posts.map(post => ({
    ...post,
    isLiked: likedPostIds.has(post.id),
  }));
};
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

      const [articles, images, videos] = await Promise.all([
        ArticlePost.find({})
          .populate("author")
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .lean(),
        ImagePost.find({})
          .populate("author")
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .lean(),
        VideoPost.find({})
          .populate("author")
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .lean(),
      ]);

      let posts = [...articles, ...images, ...videos]
        .map((obj) => ({
          ...obj,
          id: obj._id.toString(),
          author: obj.author
            ? { ...obj.author, id: obj.author._id.toString() }
            : null,
          likesCount: obj.likesCount ?? 0,
          commentsCount: obj.commentsCount ?? 0,
          totalLikes: obj.likesCount ?? 0,
          totalComments: obj.commentsCount ?? 0,
          type: obj.title
            ? "ArticlePost"
            : obj.images
              ? "ImagePost"
              : "VideoPost",
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit); // final slice after merge

      // Add isLiked field to all posts
      const postsWithIsLiked = await addIsLikedToPosts(posts, currentUser?._id);

      return {
        success: true,
        message: "Home feed fetched successfully",
        statusCode: 200,
        posts: postsWithIsLiked,
      };
    } catch (error) {
      Logger.error("Get home feed error:", error);
      return {
        success: false,
        message: "Failed to fetch home feed",
        statusCode: 500,
        posts: [],
      };
    }
  },
}