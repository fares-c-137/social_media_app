# Social Media App Backend

A comprehensive social media backend application built with Node.js, Express, TypeScript, and MongoDB.

## Features

- **Authentication & Authorization**
  - Email/password signup and login
  - Google OAuth integration
  - Email verification with OTP
  - Password reset functionality
  - Two-factor authentication (2FA)
  - JWT-based access and refresh tokens
  - Role-based access control (user/admin)

- **User Management**
  - User profiles with customizable information
  - Profile and cover image management
  - Email update functionality
  - User friendships
  - User authorization/permissions

- **Posts & Social Interactions**
  - Create, read, update, and delete posts
  - Like/unlike posts
  - Comments on posts
  - Post availability/visibility controls
  - Post population with comments and user data

- **Media/File Management**
  - File uploads (small and large/multipart)
  - AWS S3 integration for cloud storage
  - Pre-signed URLs for direct client uploads
  - File streaming and downloads
  - Soft delete and restore functionality
  - Profile and cover image management

- **Real-time Features**
  - Chat functionality
  - Real-time events
  - Groups and rooms
  - Socket.io integration

- **GraphQL API**
  - GraphQL endpoint alongside REST API
  - User queries and mutations
  - Flexible data fetching

- **Admin Features**
  - Admin dashboard/controls
  - User management capabilities

## Tech Stack

- **Backend**: Express.js, TypeScript
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT, bcrypt, Google OAuth
- **File Storage**: AWS S3
- **API**: REST + GraphQL
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Zod
- **Email**: Nodemailer

## Installation

1. Clone the repository:
```bash
git clone https://github.com/fares-c-137/social_media_app.git
cd social_media_app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables in `config/.env.development`

4. Run the development server:
```bash
npm run start:dev
```

## Project Structure

```
src/
├── DB/                    # Database models and repositories
├── modules/               # Feature modules
│   ├── authentication/   # Auth module
│   ├── user/             # User management
│   ├── media/            # File/media handling
│   ├── post/             # Posts functionality
│   ├── comment/          # Comments
│   └── admin/            # Admin features
├── middleware/           # Express middleware
├── utils/                # Utility functions
├── graphql/              # GraphQL schema and resolvers
└── server.config.ts      # Server configuration
```

## API Endpoints

- `/auth` - Authentication routes
- `/user` - User management routes
- `/assets` - Media/file routes
- `/post` - Post routes
- `/graphql` - GraphQL endpoint

## License

ISC
