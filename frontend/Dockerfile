FROM node:20-alpine

WORKDIR /app

# ติดตั้ง dependencies
COPY package*.json ./
RUN npm ci

# คัดลอกไฟล์โปรเจคทั้งหมด
COPY . .

# สร้าง production build
RUN npm run build

EXPOSE 3000

# รัน Next.js ในโหมด production
CMD ["npm", "start"]