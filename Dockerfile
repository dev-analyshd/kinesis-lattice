# KINESIS — Multi-Stage Docker Build
# Stage 1: Rust TEE Contract Builder

FROM rust:1.79-slim as rust-builder
WORKDIR /build

RUN rustup target add wasm32-wasip2 && \
    apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY contracts/ ./contracts/
WORKDIR /build/contracts
RUN cargo build --target wasm32-wasip2 --release

# Stage 2: Node.js Runtime Builder

FROM node:20-slim as node-builder
WORKDIR /build

# Install dependencies first (layer caching)
COPY package*.json ./
COPY agent-runtime/package*.json ./agent-runtime/
COPY sdk/package*.json ./sdk/
COPY dashboard/package*.json ./dashboard/

RUN npm ci --legacy-peer-deps

# Copy all source
COPY . .

# Build SDK first (runtime depends on it)
RUN cd sdk && npm run build

# Build agent runtime
RUN cd agent-runtime && npm run build

# Build dashboard
RUN cd dashboard && npm run build

# Stage 3: Production Runtime

FROM node:20-slim as runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Copy WASM contracts
COPY --from=rust-builder /build/contracts/target/wasm32-wasip2/release/*.wasm ./contracts/

# Copy built Node.js artifacts
COPY --from=node-builder /build/agent-runtime/dist ./agent-runtime/dist/
COPY --from=node-builder /build/agent-runtime/node_modules ./agent-runtime/node_modules/
COPY --from=node-builder /build/sdk/dist ./sdk/dist/
COPY --from=node-builder /build/dashboard/.next ./dashboard/.next/
COPY --from=node-builder /build/dashboard/public ./dashboard/public/ 2>/dev/null || true
COPY --from=node-builder /build/dashboard/node_modules ./dashboard/node_modules/
COPY --from=node-builder /build/node_modules ./node_modules/
COPY --from=node-builder /build/package*.json ./

# Copy configs
COPY scripts/ ./scripts/
COPY .env.example ./.env.example

ENV NODE_ENV=production
ENV API_PORT=8080
ENV DASHBOARD_PORT=3000
ENV MOCK_DATA_FOR_DEMO=true

EXPOSE 8080 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "agent-runtime/dist/index.js"]
