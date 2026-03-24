# Yuvanext API v1

A comprehensive TypeScript-based REST API for an internship and mentorship platform. Yuvanext connects candidates with internship opportunities while facilitating meaningful mentorship relationships.

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Documentation](#-documentation)
- [Development](#-development)
- [Deployment](#-deployment)

## ✨ Features

### Core Functionality

- **User Management** - Authentication, profile management, and role-based access control
- **Internship Marketplace** - Browse, apply, and manage internship opportunities
- **Mentorship System** - Connect with mentors, request mentorship, schedule meetings
- **AI-Powered Content** - Generate course content and recommendations using AI
- **Meeting Management** - Schedule meetings with Zoom integration
- **Task Management** - Organize and track tasks
- **Notification System** - Real-time notifications for important events
- **Admin Dashboard** - Administrative controls and system management

### Technical Features

- Type-safe API with OpenAPI documentation
- Role-based access control (RBAC)
- Email notifications with templating
- AWS S3 file storage with presigned URLs
- AWS Bedrock AI integration
- Structured logging with Pino
- Zero-downtime database migrations

## 🛠 Tech Stack

- **Runtime**: Node.js with TypeScript
- **Web Framework**: Hono (lightweight, edge-computing ready)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: better-auth with RBAC plugin
- **API Documentation**: OpenAPI/Swagger with Scalar
- **AWS Services**: S3, Bedrock, Lambda support
- **Email**: Nodemailer with Handlebars templating
- **Logging**: Pino + Hono integration
- **Code Quality**: ESLint, Prettier, Husky

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- PostgreSQL 12+
- AWS Account (for S3, Bedrock AI)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/yuvanext-api.git
cd yuvanext-api

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Update .env with your configuration
nano .env

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Server runs on `http://localhost:3000` by default. API documentation available at `/docs`.

## 📁 Project Structure

```
src/
├── app.ts                    # Main application setup
├── index.ts                  # Server entry point
├── lambda.ts                 # AWS Lambda entry point
│
├── config/                   # Configuration
│   ├── env.ts               # Environment variables (Zod validated)
│   ├── auth.ts              # Better-auth configuration
│   └── auth-permission.ts   # RBAC permission definitions
│
├── db/                        # Database layer
│   ├── index.ts             # Database connection
│   ├── schema/              # Drizzle ORM schemas (15 tables)
│   └── migrations/          # SQL migration files
│
├── lib/                      # Core libraries & services
│   ├── create-app.ts        # Express-like app factory
│   ├── configure-open-api.ts # OpenAPI setup
│   └── services/            # External service integrations
│       ├── email.service.ts
│       ├── s3.service.ts
│       ├── zoom.service.ts
│       └── bedrock.service.ts
│
├── middleware/               # Express-like middleware
│   ├── auth.ts              # Authentication/RBAC
│   ├── logger.ts            # Request logging
│   └── not-found.ts         # 404 handler
│
├── routes/                   # API route modules
│   ├── auth/                # Authentication endpoints
│   ├── internship/          # Internship management
│   ├── candidate_actions/   # Candidate operations
│   ├── courses/             # Course catalog
│   ├── mentors/             # Mentor profiles
│   ├── mentorship_request/  # Mentorship pairing
│   ├── mentor-meetings/     # Meeting scheduling
│   ├── profile/             # User profiles
│   ├── notification/        # Notifications
│   ├── settings/            # User preferences
│   ├── task_management/     # Task tracking
│   ├── chatbot/             # AI chat interface
│   ├── ai_content_generates/# AI content generation
│   ├── admin_actions/       # Admin operations
│   └── mentor_view/         # Mentor dashboard
│
├── templates/               # Email HTML templates
│   ├── verify-email.html
│   ├── reset-password.html
│   ├── invitation.html
│   ├── applied.html
│   └── ... (more notification templates)
│
└── types/                   # TypeScript type definitions
    └── app.types.ts
```

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Detailed development environment setup
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design patterns
- **[DATABASE.md](DATABASE.md)** - Database schema and entity relationships
- **[API.md](API.md)** - API endpoints and request/response examples
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide

## 💻 Development

### Available Commands

```bash
# Start development server with hot reload
pnpm dev

# Build for production
pnpm build

# Run compiled code
pnpm start

# Type checking
pnpm typecheck

# Code linting
pnpm lint
pnpm lint:fix

# Database operations
pnpm db:generate    # Generate schema migrations
pnpm db:migrate     # Run pending migrations

# Deployment
pnpm deploy:zip     # Create Lambda deployment package
```

### Development Workflow

1. Create/modify schema in `src/db/schema/`
2. Generate migrations: `pnpm db:generate`
3. Review and optionally edit migration SQL
4. Run migrations: `pnpm db:migrate`
5. Create route handlers in `src/routes/`
6. Test locally: `pnpm dev`

### Code Quality

The project uses:

- **ESLint** - Static code analysis
- **Prettier** - Code formatting
- **Husky** - Git hooks for pre-commit checks
- **TypeScript** - Strict type checking

Run linting:

```bash
pnpm lint           # Check for issues
pnpm lint:fix       # Auto-fix issues
```

## 🔐 Authentication & Authorization

The API uses better-auth with role-based access control (RBAC):

**Roles:**

- `admin` - Full system access
- `unit` - Organization/company account
- `candidate` - Job seeker
- `mentor` - Mentorship provider

Each endpoint is protected by middleware that validates the user session and checks permissions.

## ⚙️ Configuration

### Environment Variables

See `.env.example` for all required variables:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/yuvanext

# Authentication
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# AWS Services
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name

# Zoom API
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret
```

## 🚢 Deployment

### Docker

```bash
# Build image
docker build -t yuvanext-api .

# Run container
docker run -p 3000:3000 --env-file .env yuvanext-api
```

### AWS Lambda

```bash
# Create deployment package
pnpm deploy:zip

# Upload lambda.zip to AWS Lambda
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## 📊 API Documentation

Once the server is running, visit `http://localhost:3000/docs` to view the interactive OpenAPI documentation powered by Scalar.

The API provides endpoints for:

- Authentication & user management
- Internship operations
- Mentorship management
- Course management
- Task tracking
- File uploads
- AI-powered features
- Admin operations

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and ensure code quality: `pnpm lint:fix`
3. Commit with conventional commits: `git commit -m "feat: description"`
4. Push and create a Pull Request

## 📝 License

[Add your license here]

## 🎯 Roadmap

- [ ] Enhanced analytics dashboard
- [ ] Mobile app support
- [ ] Additional AI content types
- [ ] Advanced search filters
- [ ] Real-time collaboration features
- [ ] Micro-credentials system

## 📧 Support

For issues and questions, please open an issue on the repository.
