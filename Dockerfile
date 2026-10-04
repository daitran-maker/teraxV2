# Sử dụng Node.js 20
FROM node:20-alpine

# Cài đặt postgresql-client để chạy pg_dump và pg_restore
RUN apk add --no-cache postgresql-client

# Thư mục làm việc
WORKDIR /app

# Copy package và cài đặt
COPY package*.json ./
RUN npm install && npm install -g pm2

# Copy source code
COPY . .

# Expose port
EXPOSE 5221

# Chạy app bằng PM2 cluster mode trong Docker container
# Chạy 2 instances để tận dụng đa nhân mà không vượt quá giới hạn connection của Postgres
CMD ["pm2-runtime", "start", "server/index.js", "-i", "2", "--name", "crc-app"]
