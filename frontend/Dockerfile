FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Use npm install instead of npm ci
RUN npm install

# Copy project files
COPY . .

EXPOSE 3000

# Use dev server for now since we haven't built the production version yet
CMD ["npm", "run", "dev"]