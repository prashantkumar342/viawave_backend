# Use official Node.js LTS version as base image
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy only package.json and package-lock.json (if available) to install deps first (cache optimization)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose port (adjust based on your app port)
EXPOSE 5000

# Start the app using nodemon in dev OR node in prod
CMD ["npm", "run", "dev"]