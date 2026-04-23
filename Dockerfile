# Use Node.js 20 Alpine as base image
FROM node:20-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files (handle case where package-lock.json might not exist)
COPY package.json ./
COPY package-lock.json* ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Record the build timestamp
RUN echo "{\"buildTime\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > /app/dist/build-info.json

# Production stage with Node.js
FROM node:20-alpine

# Install security updates and tools
RUN apk update && apk upgrade && apk add --no-cache ca-certificates sqlite dcron

# Create app directory and data directory
WORKDIR /app
RUN mkdir -p /app/data /app/data/backups /var/log

# Copy built application and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G appuser -g appuser appuser

# Make start script executable
RUN chmod +x /app/server/start-with-cron.sh

# Set proper permissions
RUN chown -R appuser:appuser /app && \
    chown appuser:appuser /var/log

# Switch to non-root user
USER appuser

# Expose port 3000
EXPOSE 3000

# Start the application with cron
CMD ["/app/server/start-with-cron.sh"]