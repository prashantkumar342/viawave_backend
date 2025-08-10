import { User as UserModel } from '../models/userModel.js';
import { requireAuth } from '../utils/requireAuth.js';

export const finUserResolvers = {
  Query: {
    searchUsers: async (_, { username, limit, offset }, context) => {
      const currentUser = await requireAuth(context.req);

      const regex = new RegExp(username, 'i');

      const [results, totalCount] = await Promise.all([
        UserModel.find({ username: { $regex: regex } })
          .skip(offset)
          .limit(limit)
          .select(
            'username email firstname lastname profilePicture links sentLinks receivedLinks'
          )
          .lean(),
        UserModel.countDocuments({ username: { $regex: regex } }),
      ]);

      // Add `is_linked` for each user
      const enrichedResults = results.map((user) => {
        if (String(user._id) === String(currentUser._id)) {
          return { ...user, id: user._id, is_linked: 'self' };
        }
        if (
          currentUser.links?.includes(user._id) &&
          user.links?.includes(currentUser._id)
        ) {
          return { ...user, id: user._id, is_linked: 'linked' };
        }
        if (currentUser.sentLinks?.includes(user._id)) {
          return { ...user, id: user._id, is_linked: 'sent' };
        }
        if (currentUser.receivedLinks?.includes(user._id)) {
          return { ...user, id: user._id, is_linked: 'pending' };
        }
        return { ...user, id: user._id, is_linked: 'none' };
      });

      return {
        success: true,
        totalCount,
        hasMore: offset + results.length < totalCount,
        results: enrichedResults,
      };
    },

    getUser: async (_, { id }) => {
      try {
        const user = await UserModel.findById(id).select(
          'username email firstname lastname bio profilePicture isVerified createdAt postsCount followersCount followingCount'
        );

        if (!user) throw new Error('User not found');

        return {
          user: {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            bio: user.bio,
            profilePicture: user.profilePicture,
            isVerified: user.isVerified,
            joinedDate: user.createdAt, // Map to joinedDate if requested like that in schema
            postsCount: user.postsCount || 0,
            followersCount: user.followersCount || 0,
            followingCount: user.followingCount || 0,
          },
        };
      } catch (error) {
        throw new Error(error.message || 'Failed to fetch user');
      }
    },
  },
};
