# Groove AI - AI Chat Assistant

## Overview

Groove AI is a modern AI-powered chat application built with React, TypeScript, and Supabase. The application provides users with an intelligent conversational interface powered by Groq's AI models, featuring user authentication, conversation management, and a clean, responsive UI.

The system follows a client-server architecture with a React frontend, Supabase backend for data persistence and authentication, and Groq API integration for AI capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: Radix UI primitives with shadcn/ui components
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: React Router DOM for client-side navigation

**Design System:**
- Clean, minimal design with a slate accent color scheme
- HSL-based color system defined in CSS custom properties
- Responsive design with mobile-first approach
- Component-based architecture using shadcn/ui patterns

**Key Frontend Components:**
- `ChatInput`: Message input component with keyboard shortcuts
- `ChatMessage`: Message display with role-based styling (user vs assistant)
- `ChatSidebar`: Conversation history and management
- Page components: `Index` (landing), `Auth`, `Onboarding`, `Chat`, `NotFound`

**Authentication Flow:**
1. Users land on Index page with signup/signin options
2. Authentication handled via Supabase Auth
3. Email verification required before access
4. New users go through onboarding to collect profile information
5. Authenticated users access the Chat interface

### Backend Architecture

**Data Storage:**
- **Platform**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with email/password
- **Storage**: localStorage for session persistence

**Database Schema:**
- `profiles` table: User profile data including `first_name`, `last_name`, `age`, `onboarding_completed`
- `conversations` table: Chat conversation metadata with `title`, `user_id`, timestamps
- `messages` table: Individual chat messages with `content`, `role`, `conversation_id`

**API Architecture:**
- Supabase Edge Functions for serverless API endpoints
- `chat` function: Handles AI chat requests with streaming support
- CORS-enabled endpoints for cross-origin requests

**AI Integration:**
- **Provider**: Groq API
- **Model**: Mixtral-8x7b-32768
- **Features**: Streaming responses for real-time interaction
- **System Prompt**: Configured to provide clear, concise, and friendly responses

### External Dependencies

**Core Services:**
- **Supabase**: Backend-as-a-Service for authentication, database, and serverless functions
  - URL: `https://xzfrisbffaujgijunvyg.supabase.co`
  - Features: Auth, Postgres database, Edge Functions
  
- **Groq API**: AI/LLM service for chat completions
  - Model: Mixtral-8x7b-32768
  - Feature: Streaming chat completions

**Third-Party Libraries:**
- **UI Components**: Radix UI primitives (@radix-ui/*)
- **Form Management**: React Hook Form with Zod validation (@hookform/resolvers)
- **Styling**: Tailwind CSS, class-variance-authority, clsx
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **Carousel**: Embla Carousel
- **Theme Management**: next-themes
- **Notifications**: Sonner (toast notifications)

**Development Tools:**
- **Linter**: ESLint with TypeScript support
- **Component Tagging**: lovable-tagger (development mode)

**Configuration:**
- Brand name configurable via `BRAND_NAME` constant in `src/lib/constants.ts`
- Supabase credentials in `src/integrations/supabase/client.ts`
- Groq API key stored in Supabase environment variables