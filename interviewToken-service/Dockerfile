# Node 20 on Alpine
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Use production mode by default
ENV NODE_ENV=production

# Enable corepack to use pnpm matching packageManager
RUN corepack enable

# Install deps first (better layer caching)
COPY package.json ./
RUN pnpm install --prod

# Copy the app source
COPY src/ ./src/

# Expose the server port
EXPOSE 3000

# Start the server
CMD ["node", "src/app.js"]
