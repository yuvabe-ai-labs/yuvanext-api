# Use AWS Lambda Node.js base image
FROM public.ecr.aws/lambda/nodejs:20

WORKDIR /var/task

# Enable corepack & pnpm
RUN corepack enable

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./

# Install production dependencies with peer dependencies, ignoring scripts
RUN pnpm install --prod --ignore-scripts --shamefully-hoist

# Copy built files
COPY dist ./dist

COPY src/templates ./templates

# Set Lambda handler (lambda.js with named export 'handler')
CMD ["dist/lambda.handler"]