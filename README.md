# PMax - AI-Powered Timeline Video Editor

A web-based video editor that allows users to generate promo videos from text prompts, customize templates, and export in multiple formats.

## Features

- 🔎 Prompt-Based Video Generation
- 🖼️ Asset Management & Upload
- 🧠 AI-Powered Scene Generator
- ⏱️ Timeline Editor
- 🎨 Templates & Branding
- 📐 Export & Resize Engine
- 🔊 Sound & Voice
- 🧑‍🤝‍🧑 Collaboration
- 📈 Analytics & Smart Suggestions

## Tech Stack

- Frontend: Next.js (App Router), Tailwind CSS, ShadCN/UI
- Backend/API: Node.js with tRPC
- AI Integrations: RunwayML, DALL·E, Pika Labs, ElevenLabs
- Video Processing: FFmpeg
- Storage: AWS S3
- Database: PostgreSQL with Prisma ORM
- Auth: NextAuth

## Getting Started

```bash
# Install dependencies
npm install

# Set up the database
npx prisma db push

# Run the development server
npm run dev
```

## MVP Scope

- Prompt-based video generation (text-to-scenes + text overlays)
- Upload + timeline editor
- Export in 9:16 and 1:1 formats
- Add music, text, logo
- Save project + export video