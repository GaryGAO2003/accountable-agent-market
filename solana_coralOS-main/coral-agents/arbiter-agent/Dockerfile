# Build from repo root:
#   docker build -f coral-agents/arbiter-agent/Dockerfile -t arbiter-agent:0.1.0 .

FROM node:20-alpine AS builder
WORKDIR /app

COPY packages/agent-runtime/package.json packages/agent-runtime/package-lock.json* ./packages/agent-runtime/
RUN cd packages/agent-runtime && npm install --ignore-scripts
COPY packages/agent-runtime/tsconfig.json ./packages/agent-runtime/
COPY packages/agent-runtime/src/ ./packages/agent-runtime/src/
RUN cd packages/agent-runtime && npx tsc

COPY coral-agents/arbiter-agent/package.json coral-agents/arbiter-agent/package-lock.json* ./coral-agents/arbiter-agent/
RUN cd coral-agents/arbiter-agent && npm install --ignore-scripts --install-links
COPY coral-agents/arbiter-agent/tsconfig.json ./coral-agents/arbiter-agent/
COPY coral-agents/arbiter-agent/src/ ./coral-agents/arbiter-agent/src/
RUN cd coral-agents/arbiter-agent && npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/coral-agents/arbiter-agent/dist ./dist
COPY --from=builder /app/coral-agents/arbiter-agent/node_modules ./node_modules

CMD ["node", "dist/index.js"]
