import { Like } from "../models/likeModel.js";

export const addIsLikedToPost = async (post, userId) => {
  if (!userId) {
    return { ...post, isLiked: false };
  }

  // ✅ Safer check: handle both id and _id
  const postId = post.id || post._id?.toString();

  // ✅ If called from toggleLike, you could pass isLiked directly
  // but for general cases we still check DB
  const isLiked = await Like.exists({ post: postId, user: userId });

  return { ...post, isLiked: !!isLiked };
};


// Helper function to add isLiked field to multiple posts
export const addIsLikedToPosts = async (posts, userId) => {
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