# PMax - AI-Powered Timeline Video Editor Setup Guide

This document provides instructions for setting up and running the PMax application.

## Prerequisites

- Node.js 16.x or later
- npm or yarn
- PostgreSQL database

## Environment Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd PMax
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory by copying the `.env.example` file:
   ```
   cp .env.example .env
   ```

4. Configure the environment variables in `.env`:
   - Database URL
   - Auth credentials (Clerk)
   - Upload service credentials (UploadThing)
   - AI service API keys (OpenAI, ElevenLabs, etc.)

## Database Setup

1. Make sure PostgreSQL is running and accessible with the credentials specified in your `.env` file.

2. Push the database schema:
   ```
   npm run db:push
   ```

3. (Optional) Seed the database with initial data:
   ```
   npm run db:seed
   ```

## Running the Application

1. Start the development server:
   ```
   npm run dev
   ```

2. The application should now be running at [http://localhost:3000](http://localhost:3000)

## Useful Commands

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run db:push` - Push the database schema
- `npm run db:studio` - Open Prisma Studio to manage database
- `npm run db:seed` - Seed the database with initial data

## Project Structure

```
PMax/
├── prisma/                # Database schema and migrations
├── public/                # Static assets
├── scripts/               # Utility scripts
├── src/
│   ├── app/               # Next.js app router
│   │   ├── api/           # API routes
│   │   ├── assets/        # Asset management pages
│   │   ├── auth/          # Authentication pages
│   │   ├── components/    # UI components
│   │   ├── dashboard/     # Dashboard pages
│   │   ├── editor/        # Editor pages
│   │   ├── providers/     # Context providers
│   │   ├── utils/         # Utility functions
│   │   ├── globals.css    # Global styles
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page
├── .env.example           # Example environment variables
├── .eslintrc.json         # ESLint configuration
├── .gitignore             # Git ignore rules
├── next.config.js         # Next.js configuration
├── package.json           # Dependencies and scripts
├── postcss.config.js      # PostCSS configuration
├── README.md              # Project documentation
├── SETUP.md               # Setup instructions
├── tailwind.config.js     # Tailwind CSS configuration
└── tsconfig.json          # TypeScript configuration
```