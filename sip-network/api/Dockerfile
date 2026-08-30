FROM node:20-bookworm-slim

# build-essential + python3: better-sqlite3 is a native module. It ships
# prebuilt binaries for common platforms and usually doesn't need these,
# but installing them as a fallback avoids an install failure on less
# common architectures costing you a debugging session on a fresh VPS.
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./

EXPOSE 3000
CMD ["node", "server.js"]
