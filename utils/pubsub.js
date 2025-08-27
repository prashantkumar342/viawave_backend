import { PubSub } from 'graphql-subscriptions';

import { Logger } from './logger';

export const pubsub = new PubSub();

// Increase/remove default listener cap to avoid MaxListenersExceededWarning
// A single PubSub instance may get many dynamic topics like LINK_REQUEST_UPDATED_*
// Setting to 0 removes the limit; alternatively, set to a higher safe number (e.g., 100)
try {
  // Some PubSub implementations expose the underlying EventEmitter as `ee`
  const eventEmitter = pubsub.ee || pubsub;
  if (typeof eventEmitter.setMaxListeners === 'function') {
    eventEmitter.setMaxListeners(0); // no limit
  }
} catch {
  Logger.error('❌ Failed to set PubSub max listeners');
}
