FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache git

# Copy package files
COPY package.json package-lock.json ./

# Install app dependencies
RUN npm ci

# Copy the rest of the app
COPY . .

# Expose the port Expo will run on
EXPOSE 19000
EXPOSE 19001
EXPOSE 19002

# Start the Expo server
CMD ["npm", "start"] 