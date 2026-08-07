FROM node:22-alpine

# System dependencies: yt-dlp + ffmpeg
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    pip3 install --break-system-packages -U yt-dlp

WORKDIR /app

# Enable pnpm (use npmmirror for China network)
RUN npm config set registry https://registry.npmmirror.com && \
    corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json files (needed for pnpm install)
COPY src/shared/package.json src/shared/
COPY src/server/package.json src/server/
COPY src/web/package.json src/web/

# Install dependencies (ffmpeg-static is optional, skip if fails)
RUN pnpm config set registry https://registry.npmmirror.com && \
    pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

# Copy source
COPY src/shared src/shared
COPY src/server src/server
COPY src/web src/web

# Build all packages (shared → web → server for proper dependency order)
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV DOWNLOAD_DIR=/data/downloads

VOLUME ["/data/downloads"]
EXPOSE 3001

CMD ["node", "src/server/dist/index.js"]
