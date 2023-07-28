# Use the official Node.js image as the base image
FROM node:latest

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json into the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire Nest.js application into the container
COPY . .

# Expose the port your Nest.js application is running on (e.g., 3000)
EXPOSE 9000

# Set the command to start your Nest.js application
CMD ["npm", "run", "start"]
