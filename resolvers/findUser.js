import { User as UserModel } from '../models/userModel.js';

export const finUserResolvers = {
  Query: {
    searchUsers: async (_, { username, limit, offset }) => {
      const regex = new RegExp(username, 'i');

      const [results, totalCount] = await Promise.all([
        UserModel.find({ username: { $regex: regex } })
          .skip(offset)
          .limit(limit)
          .select('username email firstname lastname profilePicture'),
        UserModel.countDocuments({ username: { $regex: regex } }),
      ]);

      return {
        success: true,
        totalCount,
        hasMore: offset + results.length < totalCount,
        results,
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
