import { Conversation } from '../models/conversationModel.js';
import { User as UserModel } from '../models/userModel.js';
import { Logger } from '../utils/logger.js';
import { requireAuth } from '../utils/requireAuth.js';

export const finUserResolvers = {
   Query: {
      searchUsers: async (_, { username, limit, offset }, context) => {
         const currentUser = await requireAuth(context.req);

         const regex = new RegExp(username, 'i');

         const [results, totalCount] = await Promise.all([
            UserModel.find({
               username: { $regex: regex },
               _id: { $ne: currentUser._id }
            })
               .skip(offset)
               .limit(limit)
               .select(
                  'username email firstname lastname profilePicture links sentLinks receivedLinks'
               )
               .lean(),
            UserModel.countDocuments({
               username: { $regex: regex },
               _id: { $ne: currentUser._id } // Fix: exclude current user from count too
            }),
         ]);

         // Add `is_linked` for each user
         const enrichedResults = results.map((user) => {
            const userId = String(user._id);
            const currentUserId = String(currentUser._id);

            // Convert ObjectIds to strings for comparison
            const currentUserLinks = currentUser.links?.map(id => String(id)) || [];
            const currentUserSentLinks = currentUser.sentLinks?.map(id => String(id)) || [];
            const currentUserReceivedLinks = currentUser.receivedLinks?.map(id => String(id)) || [];
            const userLinks = user.links?.map(id => String(id)) || [];

            // Self check (shouldn't happen due to $ne filter, but keeping for safety)
            if (userId === currentUserId) {
               return { ...user, id: user._id, is_linked: 'self' };
            }

            // Fully linked (both have each other in `links`)
            if (
               currentUserLinks.includes(userId) &&
               userLinks.includes(currentUserId)
            ) {
               return { ...user, id: user._id, is_linked: 'linked' };
            }

            // Current user sent request (user is in currentUser's sentLinks)
            if (currentUserSentLinks.includes(userId)) {
               return { ...user, id: user._id, is_linked: 'sent' };
            }

            // Current user received request (user is in currentUser's receivedLinks)
            if (currentUserReceivedLinks.includes(userId)) {
               return { ...user, id: user._id, is_linked: 'accept' };
            }

            // No relation
            return { ...user, id: user._id, is_linked: 'none' };
         });

         return {
            success: true,
            totalCount,
            hasMore: offset + results.length < totalCount,
            results: enrichedResults,
         };
      },

      getUser: async (_, { id }, context) => {
         try {
            const user = await UserModel.findById(id);

            if (!user) throw new Error('User not found');

            // Get current user for is_linked calculation
            let is_linked = 'none';
            let ourConversation = null;

            try {
               const currentUser = await requireAuth(context.req);
               const userId = String(user._id);
               const currentUserId = String(currentUser._id);

               // Convert ObjectIds to strings for comparison
               const currentUserLinks = currentUser.links?.map(id => String(id)) || [];
               const currentUserSentLinks = currentUser.sentLinks?.map(id => String(id)) || [];
               const currentUserReceivedLinks = currentUser.receivedLinks?.map(id => String(id)) || [];
               const userLinks = user.links?.map(id => String(id)) || [];

               if (userId === currentUserId) {
                  is_linked = 'self';
               } else if (
                  currentUserLinks.includes(userId) &&
                  userLinks.includes(currentUserId)
               ) {
                  is_linked = 'linked';
               } else if (currentUserSentLinks.includes(userId)) {
                  is_linked = 'sent';
               } else if (currentUserReceivedLinks.includes(userId)) {
                  is_linked = 'accept';
               }

               // Find conversation between current user and the requested user
               if (userId !== currentUserId) {
                  const conversation = await Conversation.findOne({
                     type: 'PRIVATE',
                     participants: {
                        $all: [currentUser._id, user._id],
                        $size: 2
                     }
                  });

                  ourConversation = conversation ? conversation._id.toString() : null;
               }

            } catch (authError) {
               Logger.error("error in getUser", authError)
            }

            const [totalLinks] = await Promise.all([
               user?.links?.length || 0,
            ]);

            return {
               user: {
                  id: user._id.toString(),
                  username: user.username,
                  email: user.email,
                  firstname: user.firstname,
                  lastname: user.lastname,
                  bio: user.bio,
                  profilePicture: user.profilePicture,
                  coverImage: user.coverImage,
                  gender: user.gender,
                  dateOfBirth: user.dateOfBirth,
                  location: user.location,
                  phone: user.phone,
                  website: user.website,
                  isVerified: user.isVerified,
                  joinedDate: user.createdAt,
                  postsCount: user.postsCount || 0,
                  followersCount: user.followersCount || 0,
                  followingCount: user.followingCount || 0,
                  totalLinks: totalLinks,
                  is_linked: is_linked,
                  ourConversation: ourConversation, // Added this field
                  lastLogin: user.lastLogin,
                  updatedAt: user.updatedAt,
                  status: user.status,
                  interests: user.interests || [],
                  socialLinks: user.socialLinks || {},
               },
            };

         } catch (error) {
            throw new Error(error.message || 'Failed to fetch user');
         }
      }
   },
};