# Build stage
FROM rust:1.87-slim as builder

# Install required dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src
COPY build.rs ./
COPY migrations ./migrations

# Copy SQLx offline data if it exists
COPY .sqlx ./.sqlx

# Build the application
ENV SQLX_OFFLINE=true
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/target/release/refmd-api /usr/local/bin/refmd-api

# Copy migrations
COPY migrations ./migrations

# Expose port
EXPOSE 8888

# Run the binary
CMD ["/usr/local/bin/refmd-api"]