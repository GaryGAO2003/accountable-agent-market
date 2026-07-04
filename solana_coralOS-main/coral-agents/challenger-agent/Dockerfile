# Build from repo root:
#   docker build -f coral-agents/challenger-agent/Dockerfile -t challenger-agent:0.1.0 .

FROM node:20-alpine AS builder
WORKDIR /app

COPY packages/agent-runtime/package.json packages/agent-runtime/package-lock.json* ./packages/agent-runtime/
RUN cd packages/agent-runtime && npm install --ignore-scripts
COPY packages/agent-runtime/tsconfig.json ./packages/agent-runtime/
COPY packages/agent-runtime/src/ ./packages/agent-runtime/src/
RUN cd packages/agent-runtime && npx tsc

COPY coral-agents/challenger-agent/package.json coral-agents/challenger-agent/package-lock.json* ./coral-agents/challenger-agent/
RUN cd coral-agents/challenger-agent && npm install --ignore-scripts --install-links
COPY coral-agents/challenger-agent/tsconfig.json ./coral-agents/challenger-agent/
COPY coral-agents/challenger-agent/src/ ./coral-agents/challenger-agent/src/
RUN cd coral-agents/challenger-agent && npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/coral-agents/challenger-agent/dist ./dist
COPY --from=builder /app/coral-agents/challenger-agent/node_modules ./node_modules

CMD ["node", "dist/index.js"]
