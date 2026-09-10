FROM node:20-slim
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

# tsx runs TS directly, so no separate build step is required at runtime.
RUN npm install --no-save tsx

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=5 \
    CMD node -e "const s=require('net').connect(process.env.PORT||8080,'localhost'); s.on('connect',()=>{s.end();process.exit(0)}); s.on('error',()=>process.exit(1));"

CMD ["npx", "tsx", "src/server.ts"]
