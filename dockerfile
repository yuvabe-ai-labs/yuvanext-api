# Use AWS Lambda Node.js base image
FROM public.ecr.aws/lambda/nodejs:20

WORKDIR /var/task

# Enable corepack & pnpm
RUN corepack enable

# Copy package files and install ALL dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy built files
COPY dist ./dist

# Set Lambda handler
CMD ["dist/handler.handler"]