FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

# Create uploads directory
RUN mkdir -p uploads/cv

EXPOSE 5003

CMD ["npm", "start"]
