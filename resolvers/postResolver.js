// // Updated postResolver.js - Modified to include isLiked field
// import fs from 'fs';
// import path from 'path';;
// import { Like } from '../models/likeModel.js';
// import { ArticlePost, ImagePost, VideoPost } from '../models/postModel.js';
// import { User } from '../models/userModel.js';
// import { Logger } from '../utils/logger.js';
// import { requireAuth } from '../utils/requireAuth.js';
// import { CommentLike } from '../models/commentLikeModel.js';
// import { deleteFile } from '../middlewares/upload.js';
// import { addIsLikedToPost, addIsLikedToPosts } from '../helpers/post-response-other.js';


// const saveBase64AsFile = async (base64Data, username) => {
//   try {
//     // Extract base64 data and determine file extension
//     const matches = base64Data.match(/^data:image\/([a-zA-Z]*);base64,(.+)$/);
//     if (!matches) {
//       throw new Error('Invalid base64 image format');
//     }

//     const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
//     const data = matches[2];

//     // Create filename with username
//     const filename = `${username}_${Date.now()}.${extension}`;

//     // Ensure directory exists
//     const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'posts', 'images');
//     if (!fs.existsSync(uploadsDir)) {
//       fs.mkdirSync(uploadsDir, { recursive: true });
//     }

//     // Save file
//     const filePath = path.join(uploadsDir, filename);
//     fs.writeFileSync(filePath, data, 'base64');

//     return `/uploads/posts/images/${filename}`;
//   } catch (error) {
//     Logger.error('Error saving base64 image:', error);
//     throw new Error('Failed to save image');
//   }
// };

// export const postResolvers = {
//   Mutation: {
//     // Create a new Article Post
//     createArticlePost: async (_, { title, content, image, imageFile, caption, tags }, context) => {
//       const user = await requireAuth(context.req);

//       if (!title) {
//         throw new Error("400: Title is required for an Article post");
//       }

//       if (!content && !image && !imageFile) {
//         throw new Error("400: Either content text or content image is required for an Article post");
//       }

//       let coverImage = null;

//       // Handle base64 imageFile
//       if (imageFile) {
//         const username = user.username || user.name || 'user';
//         coverImage = await saveBase64AsFile(imageFile, username);
//       }

//       // Prefer uploaded path if provided
//       if (image) {
//         coverImage = image;
//       }

//       const article = await ArticlePost.create({
//         author: user._id,
//         title,
//         image: coverImage || "",
//         caption: caption || "",
//         tags: tags || [],
//         content: content || "",   // save text content if provided
//       });

//       const populatedArticle = await ArticlePost.findById(article._id).populate("author");

//       const postWithCounts = {
//         ...populatedArticle.toObject(),
//         id: populatedArticle._id.toString(),
//         author: {
//           ...populatedArticle.author.toObject(),
//           id: populatedArticle.author._id.toString(),
//         },
//         totalLikes: populatedArticle.likesCount || 0,
//         totalComments: populatedArticle.commentsCount || 0,
//         type: "ArticlePost",
//       };

//       const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

//       return {
//         success: true,
//         message: "Article post created successfully",
//         statusCode: 201,
//         post: postWithIsLiked,
//       };
//     },

//     // Create a new Image Post - Now expects uploaded image paths
//     createImagePost: async (_, { images, caption, tags }, context) => {
//       try {
//         const user = await requireAuth(context.req);

//         if (!images || images.length === 0) {
//           throw new Error("400: At least one image path is required for an Image post");
//         }

//         // Validate that all image paths are properly formatted
//         const validImagePaths = images.filter(img =>
//           img && img.startsWith('/uploads/posts/images/')
//         );

//         if (validImagePaths.length === 0) {
//           throw new Error("400: Invalid image paths. Please upload images first using /upload/posts/images endpoint");
//         }

//         const imagePost = await ImagePost.create({
//           author: user._id,
//           images: validImagePaths,
//           caption: caption || "",
//           tags: tags || [],
//         });

//         const populatedImagePost = await ImagePost.findById(imagePost._id)
//           .populate('author');

//         const postWithCounts = {
//           ...populatedImagePost.toObject(),
//           id: populatedImagePost._id.toString(),
//           author: {
//             ...populatedImagePost.author.toObject(),
//             id: populatedImagePost.author._id.toString(),
//           },
//           totalLikes: populatedImagePost.likesCount || 0,
//           totalComments: populatedImagePost.commentsCount || 0,
//           type: 'ImagePost',
//         };

//         // Add isLiked field
//         const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

//         return {
//           success: true,
//           message: "Image post created successfully",
//           statusCode: 201,
//           post: postWithIsLiked,
//         };

//       } catch (error) {
//         console.error('Create image post error:', error);

//         if (error.message.startsWith('400:')) {
//           return {
//             success: false,
//             message: error.message.substring(4),
//             statusCode: 400,
//           };
//         }

//         return {
//           success: false,
//           message: 'Failed to create image post',
//           statusCode: 500,
//         };
//       }
//     },

//     // Create a new Video Post - Now expects uploaded video path
//     createVideoPost: async (_, { videoUrl, thumbnailUrl, caption, tags }, context) => {
//       try {
//         const user = await requireAuth(context.req);

//         if (!videoUrl) {
//           throw new Error("400: Video URL is required for a Video post");
//         }

//         // Validate video path format
//         if (!videoUrl.startsWith('/uploads/posts/videos/')) {
//           throw new Error("400: Invalid video path. Please upload video first using /upload/posts/video endpoint");
//         }

//         // Validate thumbnail path if provided
//         if (thumbnailUrl && !thumbnailUrl.startsWith('/uploads/posts/thumbnails/')) {
//           throw new Error("400: Invalid thumbnail path. Please upload thumbnail using /upload/posts/thumbnail endpoint");
//         }

//         const videoPost = await VideoPost.create({
//           author: user._id,
//           videoUrl,
//           thumbnailUrl: thumbnailUrl || "",
//           caption: caption || "",
//           tags: tags || [],
//         });

//         const populatedVideoPost = await VideoPost.findById(videoPost._id)
//           .populate('author');

//         const postWithCounts = {
//           ...populatedVideoPost.toObject(),
//           id: populatedVideoPost._id.toString(),
//           author: {
//             ...populatedVideoPost.author.toObject(),
//             id: populatedVideoPost.author._id.toString(),
//           },
//           totalLikes: populatedVideoPost.likesCount || 0,
//           totalComments: populatedVideoPost.commentsCount || 0,
//           type: 'VideoPost',
//         };

//         // Add isLiked field
//         const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

//         return {
//           success: true,
//           message: "Video post created successfully",
//           statusCode: 201,
//           post: postWithIsLiked,
//         };

//       } catch (error) {
//         console.error('Create video post error:', error);

//         if (error.message.startsWith('400:')) {
//           return {
//             success: false,
//             message: error.message.substring(4),
//             statusCode: 400,
//           };
//         }

//         return {
//           success: false,
//           message: 'Failed to create video post',
//           statusCode: 500,
//         };
//       }
//     },
// // Delete post and associated files
//     deletePost: async (_, { postId }, context) => {
//       try {
//         const user = await requireAuth(context.req);

//         // Find the post in any collection
//         let post = await ArticlePost.findById(postId) ||
//           await ImagePost.findById(postId) ||
//           await VideoPost.findById(postId);

//         if (!post) {
//           return {
//             success: false,
//             message: 'Post not found',
//             statusCode: 404,
//           };
//         }

//         // Check if user owns the post
//         if (post.author.toString() !== user._id.toString()) {
//           return {
//             success: false,
//             message: 'Unauthorized to delete this post',
//             statusCode: 403,
//           };
//         }

//         // Delete associated files
//         try {
//           if (post.images) {
//             // Image post - delete all images
//             for (const imagePath of post.images) {
//               await deleteFile(imagePath);
//             }
//           } else if (post.videoUrl) {
//             // Video post - delete video and thumbnail
//             await deleteFile(post.videoUrl);
//             if (post.thumbnailUrl) {
//               await deleteFile(post.thumbnailUrl);
//             }
//           }
//         } catch (fileError) {
//           Logger.warn('Could not delete post files:', fileError);
//         }

//         // Delete the post from appropriate collection
//         if (post.title && post.content) {
//           await ArticlePost.deleteOne({ _id: postId });
//         } else if (post.images) {
//           await ImagePost.deleteOne({ _id: postId });
//         } else if (post.videoUrl) {
//           await VideoPost.deleteOne({ _id: postId });
//         }

//         // Delete associated likes and comments
//         await Promise.all([
//           Like.deleteMany({ post: postId }),
//           Comment.deleteMany({ post: postId }),
//           CommentLike.deleteMany({ post: postId })
//         ]);

//         return {
//           success: true,
//           message: 'Post deleted successfully',
//           statusCode: 200,
//         };

//       } catch (error) {
//         Logger.error('Delete post error:', error);
//         return {
//           success: false,
//           message: 'Failed to delete post',
//           statusCode: 500,
//         };
//       }
//     },
   
//   },

//   Query: {
//     getMyPosts: async (_, { offset = 0, limit = 10 }, context) => {
//       try {
//         const user = await requireAuth(context.req);

//         const [articles, images, videos] = await Promise.all([
//           ArticlePost.find({ author: user._id })
//             .populate('author')
//             .sort({ createdAt: -1 }),
//           ImagePost.find({ author: user._id })
//             .populate('author')
//             .sort({ createdAt: -1 }),
//           VideoPost.find({ author: user._id })
//             .populate('author')
//             .sort({ createdAt: -1 }),
//         ]);

//         let posts = [...articles, ...images, ...videos]
//           .map(post => {
//             const obj = post.toObject();
//             return {
//               ...obj,
//               id: post._id.toString(),
//               author: obj.author
//                 ? {
//                   ...obj.author,
//                   id: obj.author._id.toString(),
//                 }
//                 : null,
//               totalLikes: obj.likesCount || 0,
//               totalComments: obj.commentsCount || 0,
//               type: obj.title ? 'ArticlePost' : obj.images ? 'ImagePost' : 'VideoPost',
//             };
//           })
//           .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

//         posts = posts.slice(offset, offset + limit);

//         // Add isLiked field to all posts
//         const postsWithIsLiked = await addIsLikedToPosts(posts, user._id);

//         return {
//           success: true,
//           message: 'Posts fetched successfully',
//           statusCode: 200,
//           posts: postsWithIsLiked,
//         };
//       } catch (error) {
//         Logger.error('Get posts error:', error);
//         return {
//           success: false,
//           message: 'Failed to fetch posts',
//           statusCode: 500,
//           posts: [],
//         };
//       }
//     },

//     getPostById: async (_, { postId }, context) => {
//       try {
//         const user = await requireAuth(context.req);

//         const post = await ArticlePost.findById(postId).populate('author') ||
//           await ImagePost.findById(postId).populate('author') ||
//           await VideoPost.findById(postId).populate('author');

//         if (!post) {
//           return {
//             success: false,
//             message: 'Post not found',
//             statusCode: 404,
//             post: null,
//           };
//         }

//         const obj = post.toObject();

//         const postWithCounts = {
//           ...obj,
//           id: post._id.toString(),
//           author: obj.author
//             ? {
//               ...obj.author,
//               id: obj.author._id.toString(),
//             }
//             : null,
//           totalLikes: obj.likesCount || 0,
//           totalComments: obj.commentsCount || 0,
//           type: obj.title ? 'ArticlePost' : obj.images ? 'ImagePost' : 'VideoPost',
//         };

//         // Add isLiked field
//         const postWithIsLiked = await addIsLikedToPost(postWithCounts, user._id);

//         return {
//           success: true,
//           message: 'Post fetched successfully',
//           statusCode: 200,
//           post: postWithIsLiked,
//         };

//       } catch (error) {
//         Logger.error('Get post by ID error:', error);
//         return {
//           success: false,
//           message: 'Failed to fetch post',
//           statusCode: 500,
//           post: null,
//         };
//       }
//     },

//     getUserPosts: async (_, { offset = 0, limit = 10, userId }, context) => {
//       try {
//         // Get current user for isLiked field (if authenticated)
//         let currentUser = null;
//         try {
//           currentUser = await requireAuth(context.req);
//         } catch (error) {
//           return {
//             success: false,
//             message: error,
//             statusCode: 404,
//             posts: [],
//           };
//         }

//         const user = await User.findById(userId);
//         if (!user) {
//           return {
//             success: false,
//             message: 'User not found',
//             statusCode: 404,
//             posts: [],
//           };
//         }

//         const [articles, images, videos] = await Promise.all([
//           ArticlePost.find({ author: user._id })
//             .populate('author')
//             .sort({ createdAt: -1 }),
//           ImagePost.find({ author: user._id })
//             .populate('author')
//             .sort({ createdAt: -1 }),
//           VideoPost.find({ author: user._id })
//             .populate('author')
//             .sort({ createdAt: -1 }),
//         ]);

//         let posts = [...articles, ...images, ...videos]
//           .map(post => {
//             const obj = post.toObject();
//             return {
//               ...obj,
//               id: post._id.toString(),
//               author: obj.author
//                 ? {
//                   ...obj.author,
//                   id: obj.author._id.toString(),
//                 }
//                 : null,
//               totalLikes: obj.likesCount || 0,
//               totalComments: obj.commentsCount || 0,
//               type: obj.title ? 'ArticlePost' : obj.images ? 'ImagePost' : 'VideoPost',
//             };
//           })
//           .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

//         posts = posts.slice(offset, offset + limit);

//         // Add isLiked field to all posts
//         const postsWithIsLiked = await addIsLikedToPosts(posts, currentUser?._id);

//         return {
//           success: true,
//           message: 'Posts fetched successfully',
//           statusCode: 200,
//           posts: postsWithIsLiked,
//         };
//       } catch (error) {
//         Logger.error('Get user posts error:', error);
//         return {
//           success: false,
//           message: 'Failed to fetch posts',
//           statusCode: 500,
//           posts: [],
//         };
//       }
//     },

//     getHomeFeed: async (_, { offset = 0, limit = 10 }, context) => {
//       try {
//         // Get current user for isLiked field (if authenticated)
//         let currentUser = null;
//         try {
//           currentUser = await requireAuth(context.req);
//         } catch (error) {
//           return {
//             success: false,
//             message: error,
//             statusCode: 500,
//             posts: [],
//           };
//         }

//         const [articles, images, videos] = await Promise.all([
//           ArticlePost.find({})
//             .populate("author")
//             .sort({ createdAt: -1 })
//             .skip(offset)
//             .limit(limit)
//             .lean(),
//           ImagePost.find({})
//             .populate("author")
//             .sort({ createdAt: -1 })
//             .skip(offset)
//             .limit(limit)
//             .lean(),
//           VideoPost.find({})
//             .populate("author")
//             .sort({ createdAt: -1 })
//             .skip(offset)
//             .limit(limit)
//             .lean(),
//         ]);

//         let posts = [...articles, ...images, ...videos]
//           .map((obj) => ({
//             ...obj,
//             id: obj._id.toString(),
//             author: obj.author
//               ? { ...obj.author, id: obj.author._id.toString() }
//               : null,
//             likesCount: obj.likesCount ?? 0,
//             commentsCount: obj.commentsCount ?? 0,
//             totalLikes: obj.likesCount ?? 0,
//             totalComments: obj.commentsCount ?? 0,
//             type: obj.title
//               ? "ArticlePost"
//               : obj.images
//                 ? "ImagePost"
//                 : "VideoPost",
//           }))
//           .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
//           .slice(0, limit); // final slice after merge

//         // Add isLiked field to all posts
//         const postsWithIsLiked = await addIsLikedToPosts(posts, currentUser?._id);

//         return {
//           success: true,
//           message: "Home feed fetched successfully",
//           statusCode: 200,
//           posts: postsWithIsLiked,
//         };
//       } catch (error) {
//         Logger.error("Get home feed error:", error);
//         return {
//           success: false,
//           message: "Failed to fetch home feed",
//           statusCode: 500,
//           posts: [],
//         };
//       }
//     },

   
//   }
// };