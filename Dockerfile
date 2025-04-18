FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY patches ./patches
RUN bun run postinstall
COPY . .
CMD ["bun", "start"]