FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the application source code
COPY . .

# Build the TypeScript application (increase memory for large TS projects)
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Expose port 8000 for the API server
EXPOSE 8000

# Start the server
CMD ["npm", "start"]