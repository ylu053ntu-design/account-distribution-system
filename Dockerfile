FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制代码
COPY . .

# 创建数据目录
RUN mkdir -p /app/data

# 初始化数据库
RUN node scripts/initDatabase.js

# 暴露端口
EXPOSE 3000

# 启动服务
CMD ["npm", "start"]
