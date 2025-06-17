# Use the official Node.js image as base
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for canvas and fonts
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
    ttf-liberation

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Copy fonts directory
COPY fonts ./fonts/

# Copy application code
COPY . .

# Set font environment variables
ENV FONTCONFIG_PATH=./fonts
ENV CANVAS_FONT_PATH=./fonts

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
