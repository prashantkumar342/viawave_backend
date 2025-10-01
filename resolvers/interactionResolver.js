import { CommentLike } from "../models/commentLikeModel.js";
import { Comment } from "../models/commentModel.js"; // Add this import
import { Like } from "../models/likeModel.js";
import { Post } from "../models/postModel.js";
import { Logger } from "../utils/logger.js";
import { pubsub } from "../utils/pubsub.js";
import { requireAuth } from "../utils/requireAuth.js";

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
const postTopic = (postId) => `POST_UPDATED_${String(postId)}`;

export const interactionResolvers = {
  Mutation: {
    toggleLike: async (_, { postId }, context) => {
      try {
        const user = await requireAuth(context.req);

        const post = await Post.findById(postId).populate("author");
        if (!post) {
          return { success: false, message: "Post not found", statusCode: 404, post: null };
        }

        const existingLike = await Like.findOne({ post: postId, user: user._id });
        const isUnliking = !!existingLike;
        let message = "";

        if (isUnliking) {
          await existingLike.deleteOne();
          post.likesCount = Math.max(0, (post.likesCount || 0) - 1);
          message = "Like removed";
        } else {
          await Like.create({ post: postId, user: user._id });
          post.likesCount = (post.likesCount || 0) + 1;
          message = "Post liked";
        }

        await post.save();

        const postWithCounts = {
          ...post.toObject(),
          id: post._id.toString(),
          author: { ...post.author.toObject(), id: post.author._id.toString() },
          totalLikes: post.likesCount || 0,
          totalComments: post.commentsCount || 0,
          type: post.type || "Post",
        };

        // Publish WITHOUT isLiked - let the subscription resolver add it per user
        pubsub.publish(postTopic(post._id), {
          postUpdated: {
            post: postWithCounts, // No isLiked here
            action: isUnliking ? "UNLIKE" : "LIKE",
            like: { userId: user._id.toString() },
            totalLikes: post.likesCount || 0,
            updatedAt: new Date().toISOString(),
          },
        });

        // For the mutation response, add isLiked for the user who performed the action
        return {
          success: true,
          message,
          statusCode: 200,
          post: { ...postWithCounts, isLiked: !isUnliking }
        };
      } catch (error) {
        Logger.error("Toggle like error:", error);
        return { success: false, message: "Failed to toggle like", statusCode: 500, post: null };
      }
    },


    addComment: async (_, { postId, text, parentCommentId }, context) => {
      try {
        const user = await requireAuth(context.req);

        const createdComment = await Comment.create({
          post: postId,
          user: user._id,
          text,
          parentComment: parentCommentId || null,
        });

        await Post.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } });

        const post = await Post.findById(postId).populate("author");

        if (!post) {
          return {
            success: false,
            message: "Post not found",
            statusCode: 404,
            post: null
          };
        }

        // Publish a concise comment update for this post
        const populatedComment = await Comment.findById(createdComment._id).populate('user');

        pubsub.publish(postTopic(post._id), {
          postUpdated: {
            postId: post._id.toString(),
            action: "COMMENT_ADDED",
            comment: {
              id: populatedComment._id.toString(),
              text: populatedComment.text,
              parentCommentId: populatedComment.parentComment ? String(populatedComment.parentComment) : null,
              user: {
                ...populatedComment.user.toObject(),
                id: populatedComment.user._id.toString(),
              },
              createdAt: populatedComment.createdAt ? populatedComment.createdAt.toISOString() : new Date().toISOString()
            },
            totalComments: post.commentsCount || 0,
            updatedAt: new Date().toISOString()
          }
        });

        const postWithCounts = {
          ...post.toObject(),
          id: post._id.toString(),
          author: {
            ...post.author.toObject(),
            id: post.author._id.toString(),
          },
          totalLikes: post.likesCount || 0,
          totalComments: post.commentsCount || 0,
          type: post.type || 'Post',
        };

        // Add isLiked field
        const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

        return {
          success: true,
          message: "Comment added",
          statusCode: 201,
          post: postWithIsLiked,
        };
      } catch (error) {
        console.log(error)
        Logger.error("Add comment error:", error);
        return { success: false, message: "Failed to add comment", statusCode: 500, post: null };
      }
    },

    editComment: async (_, { commentId, text }, context) => {
      try {
        const user = await requireAuth(context.req);

        const comment = await Comment.findOne({ _id: commentId, user: user._id });
        if (!comment) {
          return { success: false, message: "Comment not found or unauthorized", statusCode: 404, post: null };
        }

        comment.text = text;
        await comment.save();

        const post = await Post.findById(comment.post).populate("author");

        if (!post) {
          return {
            success: false,
            message: "Post not found",
            statusCode: 404,
            post: null
          };
        }

        // Publish a concise comment update for this post
        pubsub.publish(postTopic(post._id), {
          postUpdated: {
            postId: post._id.toString(),
            action: "COMMENT_UPDATED",
            comment: {
              id: comment._id.toString(),
              text: comment.text,
              user: { id: user._id.toString(), name: user.username || user.name || null },
              updatedAt: comment.updatedAt ? comment.updatedAt.toISOString() : new Date().toISOString()
            },
            totalComments: post.commentsCount || 0,
            updatedAt: new Date().toISOString()
          }
        });

        const postWithCounts = {
          ...post.toObject(),
          id: post._id.toString(),
          author: {
            ...post.author.toObject(),
            id: post.author._id.toString(),
          },
          totalLikes: post.likesCount || 0,
          totalComments: post.commentsCount || 0,
          type: post.type || 'Post',
        };

        // Add isLiked field
        const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

        return {
          success: true,
          message: "Comment updated",
          statusCode: 200,
          post: postWithIsLiked,
        };
      } catch (error) {
        Logger.error("Edit comment error:", error);
        return { success: false, message: "Failed to edit comment", statusCode: 500, post: null };
      }
    },

    deleteComment: async (_, { commentId }, context) => {
      try {
        const user = await requireAuth(context.req);

        const comment = await Comment.findOne({ _id: commentId, user: user._id });
        if (!comment) {
          return { success: false, message: "Comment not found or unauthorized", statusCode: 404, post: null };
        }

        const postId = comment.post;

        await Comment.deleteOne({ _id: commentId });

        await Post.updateOne({ _id: postId }, { $inc: { commentsCount: -1 } });

        const post = await Post.findById(postId).populate("author");

        if (!post) {
          return {
            success: false,
            message: "Post not found",
            statusCode: 404,
            post: null
          };
        }

        // Publish a concise comment deletion update for this post
        pubsub.publish(postTopic(post._id), {
          postUpdated: {
            postId: post._id.toString(),
            action: "COMMENT_DELETED",
            comment: { id: commentId },
            totalComments: post.commentsCount || 0,
            updatedAt: new Date().toISOString()
          }
        });

        const postWithCounts = {
          ...post.toObject(),
          id: post._id.toString(),
          author: {
            ...post.author.toObject(),
            id: post.author._id.toString(),
          },
          totalLikes: post.likesCount || 0,
          totalComments: post.commentsCount || 0,
          type: post.type || 'Post',
        };

        // Add isLiked field
        const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

        return {
          success: true,
          message: "Comment deleted",
          statusCode: 200,
          post: postWithIsLiked,
        };
      } catch (error) {
        Logger.error("Delete comment error:", error);
        return { success: false, message: "Failed to delete comment", statusCode: 500, post: null };
      }
    },

    toggleCommentLike: async (_, { commentId }, context) => {
      try {
        const user = await requireAuth(context.req);

        const existingLike = await CommentLike.findOne({ comment: commentId, user: user._id });

        let message = "";
        if (existingLike) {
          await existingLike.deleteOne();
          message = "Comment like removed";
        } else {
          await CommentLike.create({ comment: commentId, user: user._id });
          message = "Comment liked";
        }

        const comment = await Comment.findById(commentId).populate('user');
        if (!comment) {
          return {
            success: false,
            message: "Comment not found",
            statusCode: 404,
          };
        }

        return {
          success: true,
          message,
          statusCode: 200,
        };
      } catch (error) {
        Logger.error("Toggle comment like error:", error);
        return {
          success: false,
          message: "Failed to toggle comment like",
          statusCode: 500
        };
      }
    }
  },
  Query: {
    getPostComments: async (_, { postId, offset = 0, limit = 10 }) => {
      try {
        const comments = await Comment.find({ post: postId, parentComment: null })
          .populate('user')
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit);

        const commentsWithReplies = await Promise.all(
          comments.map(async (comment) => {
            const replyCount = await Comment.countDocuments({ parentComment: comment._id });
            const likeCount = await CommentLike.countDocuments({ comment: comment._id });

            return {
              ...comment.toObject(),
              id: comment._id.toString(),
              user: {
                ...comment.user.toObject(),
                id: comment.user._id.toString(),
              },
              replyCount,
              likeCount,
            };
          })
        );

        return {
          success: true,
          message: 'Comments fetched successfully',
          statusCode: 200,
          comments: commentsWithReplies,
        };
      } catch (error) {
        Logger.error('Get post comments error:', error);
        return {
          success: false,
          message: 'Failed to fetch comments',
          statusCode: 500,
          comments: [],
        };
      }
    },

    getCommentReplies: async (_, { commentId, offset = 0, limit = 10 }) => {
      try {
        const replies = await Comment.find({ parentComment: commentId })
          .populate('user')
          .sort({ createdAt: 1 })
          .skip(offset)
          .limit(limit);

        const repliesWithLikes = await Promise.all(
          replies.map(async (reply) => {
            const likeCount = await CommentLike.countDocuments({ comment: reply._id });

            return {
              ...reply.toObject(),
              id: reply._id.toString(),
              user: {
                ...reply.user.toObject(),
                id: reply.user._id.toString(),
              },
              likeCount,
            };
          })
        );

        return {
          success: true,
          message: 'Replies fetched successfully',
          statusCode: 200,
          comments: repliesWithLikes,
        };
      } catch (error) {
        Logger.error('Get comment replies error:', error);
        return {
          success: false,
          message: 'Failed to fetch replies',
          statusCode: 500,
          comments: [],
        };
      }
    }
  },
  Subscription: {
    postUpdated: {
      subscribe: (_, { postId }, context) => {
        // Optional: Add authentication check
        if (!context.authenticated || !context.user) {
          throw new Error('Authentication required for subscription');
        }
        return pubsub.asyncIterableIterator(postTopic(postId));
      },
      resolve: async (payload, args, context) => {
        try {
          // Get the subscribed user
          const subscribedUserId = context.user?._id || context.user?.id;
          console.log("Subscription resolve for user:", subscribedUserId)

          // Clone the payload to avoid mutating the original
          const updatedPayload = { ...payload.postUpdated };

          // Check if this subscriber has liked the post
          if (updatedPayload.post) {
            // Check if the subscribed user has liked this post
            console.log("Checking isLiked for user:", subscribedUserId)
            const isLiked = subscribedUserId
              ? await Like.exists({ post: updatedPayload.post._id || updatedPayload.post.id, user: subscribedUserId })
              : false;
            console.log("isLiked:", !!isLiked)

            updatedPayload.post = {
              ...updatedPayload.post,
              isLiked: !!isLiked
            };
          }

          return updatedPayload;
        } catch (error) {
          Logger.error('Subscription resolve error:', error);
          // Return payload without isLiked on error
          return payload.postUpdated;
        }
      }
    },
  }
}