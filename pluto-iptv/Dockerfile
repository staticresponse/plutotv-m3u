FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

WORKDIR /data

CMD ["sh", "-c", "while true; do node /app/index.js; sleep 21600; done"]