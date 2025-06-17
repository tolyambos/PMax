# Use the official Node.js image as base
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Install system dependencies for canvas, fonts, and ffmpeg
RUN apk add --no-cache \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev \
    pkgconfig \
    make \
    g++ \
    python3 \
    fontconfig \
    ttf-dejavu \
    ttf-droid \
    ttf-freefont \
    ttf-liberation \
    ffmpeg

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies with retry mechanism for ffmpeg-static
RUN pnpm install --frozen-lockfile --prod || \
    (echo "Retrying with SKIP_FFMPEG_DOWNLOAD=1" && \
     SKIP_FFMPEG_DOWNLOAD=1 pnpm install --frozen-lockfile --prod)

# Copy fonts directory
COPY fonts ./fonts/

# Copy application code
COPY . .

# Set font environment variables
ENV FONTCONFIG_PATH=./fonts
ENV CANVAS_FONT_PATH=./fonts

# Verify ffmpeg installation
RUN ffmpeg -version && ffprobe -version

# Generate Prisma client
RUN pnpm prisma generate

# Build the application
RUN pnpm run build

# Expose the port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
