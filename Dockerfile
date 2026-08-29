# ZippiCRM Production Dockerfile
# Multi-stage build for optimal image size

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (bcrypt, better-sqlite3)
RUN apk add --no-cache python3 make g++ gcc

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for native modules
RUN apk add --no-cache libc6-compat

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 zippcrm

# Copy package files
COPY package*.json ./

# Install only production dependencies (need to rebuild native modules)
RUN apk add --no-cache python3 make g++ gcc && \
    npm ci --omit=dev && \
    apk del python3 make g++ gcc && \
    npm cache clean --force

# Copy built files from builder stage
COPY --from=builder --chown=zippcrm:nodejs /app/dist ./dist
COPY --chown=zippcrm:nodejs scripts ./scripts

# Create data directory for SQLite
RUN mkdir -p /app/data && chown zippcrm:nodejs /app/data

# Switch to non-root user
USER zippcrm

# Expose port
EXPOSE 6000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=6000
ENV DATABASE_PATH=/app/data/zippcrm.db
ENV SESSION_DATABASE_PATH=/app/data/sessions.db

# Volume for persistent SQLite data
VOLUME ["/app/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:6000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/index.cjs"]
