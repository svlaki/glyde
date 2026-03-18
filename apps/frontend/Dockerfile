# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package.json only (fresh install for correct platform binaries)
COPY package.json ./

# Install dependencies with legacy peer deps to handle React version conflicts
RUN npm install --legacy-peer-deps

# Copy the rest of the application source code
COPY . .

# Build the application for production
# Build-time arguments for environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_AGENT_SERVICE_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_ADMIN_USER_IDS

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_AGENT_SERVICE_URL=$VITE_AGENT_SERVICE_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_ADMIN_USER_IDS=$VITE_ADMIN_USER_IDS

RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:1.25-alpine

# Copy the built assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy the Nginx configuration file
# We will create this file next.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for the Nginx server
EXPOSE 80

# Start Nginx when the container launches
CMD ["nginx", "-g", "daemon off;"]
