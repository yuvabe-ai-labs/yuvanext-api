# Use AWS Lambda Node.js base image
FROM public.ecr.aws/lambda/nodejs:20

WORKDIR /var/task

# Enable corepack & pnpm
RUN corepack enable

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only, ignoring scripts
RUN pnpm install --prod --ignore-scripts

# Copy built files
COPY dist ./dist

# Set Lambda handler
CMD ["dist/handler.handler"]