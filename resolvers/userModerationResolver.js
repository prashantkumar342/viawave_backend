import BlockList from '../models/blockList.js';
import { User as UserModel } from '../models/userModel.js';
import { Logger } from '../utils/logger.js';
import { requireAuth } from '../utils/requireAuth.js';

export const userModerationResolver = {
  mutation: {
    toggleBlock: async (_, { userId }, context) => {
      try {
        const currentUser = await requireAuth(context.req);

        // check if target exists without fetching entire doc
        const targetExists = await UserModel.exists({ _id: userId });
        if (!targetExists) {
          return {
            success: false,
            statusCode: 404,
            message: 'Target User Not Found',
          };
        }

        // check if already blocked
        const blockEntry = await BlockList.findOne({
          blocker: currentUser._id,
          blocked: userId,
        });

        if (!blockEntry) {
          await BlockList.create({
            blocker: currentUser._id,
            blocked: userId,
          });

          return {
            success: true,
            statusCode: 200,
            message: 'User Blocked',
            userData: currentUser
          };
        }

        // unblock if already blocked
        await blockEntry.deleteOne();
        return {
          success: true,
          statusCode: 200,
          message: 'User Unblocked',
          userData: currentUser
        };

      } catch (error) {
        Logger.error('toggleBlock failed', error);
        return {
          success: false,
          statusCode: 500,
          message: error.message || 'Internal Server Error',
        };
      }
    },
  },
};
