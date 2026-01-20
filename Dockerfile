# ---------- Base image ----------
FROM node:20-bullseye

# ---------- Install native deps required by node-canvas ----------
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# ---------- App directory ----------
WORKDIR /app

# ---------- Install dependencies ----------
COPY package*.json ./
RUN npm install

# ---------- Copy source ----------
COPY . .

# ---------- Build TypeScript ----------
RUN npm run build

# ---------- Expose port ----------
EXPOSE 3000

# ---------- Start server ----------
CMD ["npm", "start"]
