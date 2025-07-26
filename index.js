import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServer } from 'apollo-server-express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import http from 'http';

import connectDb from './config/dbConfig.js';
import { resolvers, typeDefs } from './graphql/schema.js';
import { Logger } from './utils/logger.js';
import { socketIoServer } from './ws/socket.js';

dotenv.config({ path: './.env' });

const app = express();
const httpServer = http.createServer(app);

// Connect MongoDB
connectDb(process.env.DATABASE_URL);

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.disable('x-powered-by');
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(cookieParser());

// Create GraphQL schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Create Apollo server
const apolloServer = new ApolloServer({
  schema,
  introspection: true,
  context: ({ req, res }) => ({ req, res }), // Pass req & res
  formatError: (error) => {
    // Extract custom status codes from error message
    const [statusCode, message] = error.message.split(': ');

    return {
      success: false,
      statusCode: Number(statusCode) || 500, // Default to 500 if missing
      message: message || 'Internal Server Error',
    };
  },
});
await apolloServer.start();
apolloServer.applyMiddleware({ app, path: '/graphql' });
socketIoServer(httpServer);

// Start server
const PORT = process.env.PORT || 8595;
httpServer.listen(PORT, '0.0.0.0', () => {
  Logger.success(
    `🌏 REST & GraphQL server running at http://localhost:${PORT}`
  );
  Logger.success(
    `🧠 GraphQL endpoint at http://localhost:${PORT}${apolloServer.graphqlPath}`
  );
});
