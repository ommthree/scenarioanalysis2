# Multi-stage build for ScenarioAnalysis2
FROM ubuntu:22.04 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    g++ \
    cmake \
    build-essential \
    git \
    libsqlite3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x (required for Tailwind CSS v4, Vite 7, React Router 7)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Set working directory
WORKDIR /app

# Copy source code (actual directories, not symlinks)
COPY CMakeLists.txt /app/
COPY engine /app/engine
COPY dashboard /app/dashboard
COPY data /app/data
COPY external /app/external

# Build C++ engine
RUN mkdir -p build && cd build \
    && cmake .. -DCMAKE_BUILD_TYPE=Release \
    && make -j$(nproc)

# Build dashboard frontend
WORKDIR /app/dashboard
RUN npm ci --production=false \
    && npx vite build

# Install server dependencies (separate package.json)
WORKDIR /app/dashboard/server
RUN rm -rf node_modules && rm -f package-lock.json && npm install --production && npm rebuild

# Production stage
FROM ubuntu:22.04

# Install runtime dependencies (without nodejs yet)
RUN apt-get update && apt-get install -y \
    libsqlite3-0 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x in production stage (required for runtime compatibility)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/build/bin /app/bin
COPY --from=builder /app/dashboard/dist /app/dashboard/dist
COPY --from=builder /app/dashboard/package.json /app/dashboard/package.json
COPY --from=builder /app/dashboard/node_modules /app/dashboard/node_modules

# Copy server files (excluding node_modules which will be copied separately)
COPY --from=builder /app/dashboard/server/*.js /app/dashboard/server/
COPY --from=builder /app/dashboard/server/package.json /app/dashboard/server/
COPY --from=builder /app/dashboard/server/node_modules /app/dashboard/server/node_modules
COPY --from=builder /app/dashboard/server/data /app/dashboard/server/data
COPY --from=builder /app/dashboard/server/routes /app/dashboard/server/routes
COPY --from=builder /app/dashboard/server/middleware /app/dashboard/server/middleware

COPY --from=builder /app/data /app/data

# Set environment variables for production
ENV NODE_ENV=production
ENV VITE_API_BASE_URL=http://localhost:3001

# Expose the API server port
EXPOSE 3001

# Start the Node.js server
CMD ["node", "/app/dashboard/server/index.js"]
