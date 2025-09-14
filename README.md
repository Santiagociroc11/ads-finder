# 🚀 Ads Finder Pro - TypeScript Monolith

> **Professional Facebook Ads Discovery Platform** - Full-stack TypeScript application with React frontend and Express backend.

## ✨ Features

### 🔍 Advanced Ad Discovery
- **Facebook API Integration** - Official ads library access
- **Apify Professional Scraping** - Advanced data extraction
- **Smart Web Scraping** - Multiple search variations
- **AI-Powered Suggestions** - Gemini AI keyword generation

### 💰 Cost Optimization
- **Auto-Save Apify Searches** - Reuse expensive searches without additional cost
- **Complete Search Storage** - Full result caching in MongoDB
- **Cost Tracking** - Monitor savings and usage patterns
- **Smart Filtering** - Intelligent minimum days filter

### 🎯 Professional Analysis
- **Hotness Scoring** - AI-powered ad performance ranking
- **Long-Running Detection** - Identify successful campaigns
- **Competitor Tracking** - Monitor specific pages
- **Advanced Statistics** - Comprehensive analytics dashboard

### 🛠️ Modern Architecture
- **TypeScript Monolith** - Full type safety across the stack
- **React + Vite** - Modern frontend with hot reload
- **Express API** - Robust backend with middleware
- **MongoDB** - Scalable document storage
- **Shared Types** - Type consistency between frontend/backend

## 🏗️ Project Structure

```
ads-finder-pro/
├── backend/                    # Express TypeScript API
│   ├── src/
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Express middleware
│   │   ├── types/             # Backend-specific types
│   │   └── server.ts          # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # React TypeScript SPA
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Route components
│   │   ├── services/          # API clients
│   │   ├── hooks/             # Custom React hooks
│   │   └── main.tsx           # Entry point
│   ├── package.json
│   └── vite.config.ts
├── shared/                     # Shared TypeScript types
│   └── types/
│       └── index.ts           # Common interfaces
├── package.json               # Root workspace config
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ with npm
- **MongoDB** 4.4+ (local or Atlas)
- **Facebook Access Token** (required)
- **Apify API Token** (optional, for professional scraping)
- **Gemini API Key** (optional, for AI suggestions)

### Installation

1. **Clone and install dependencies:**
```bash
git clone <your-repo>
cd ads-finder-pro
npm run install:all
```

2. **Configure environment variables:**
```bash
# Copy example files
cp backend/.env.example backend/.env

# Edit backend/.env with your credentials
FACEBOOK_ACCESS_TOKEN=your_facebook_token_here
APIFY_API_TOKEN=your_apify_token_here
GEMINI_API_KEY=your_gemini_key_here
MONGO_URL=mongodb://localhost:27017
```

3. **Start development servers:**
```bash
npm run dev
```

This starts both backend (port 3000) and frontend (port 5173) concurrently.

### Production Build

```bash
# Build all projects
npm run build

# Start production server
npm start
```

## 🎯 Usage Guide

### 1. Basic Search
- Enter keywords in the search box
- Select country and minimum days running
- Choose search method (API/Smart/Apify)
- View results with hotness scoring

### 2. Advanced Filtering
- **Minimum Days**: Filter by campaign duration
- **Ad Types**: Regular, Political (with metrics), Financial, etc.
- **Media Types**: Video, Image, Text-only
- **Search Methods**:
  - 🚀 **API**: Fast, official Facebook API
  - 🕷️ **Smart**: Multiple search variations
  - 💎 **Apify**: Professional scraping (costs money)

### 3. Cost-Effective Workflow
1. **First time**: Use Apify for comprehensive data
2. **Auto-saved**: Search is automatically cached
3. **Reuse**: Access same results unlimited times for free
4. **Track savings**: Monitor cost optimization

### 4. Search Management
- **Saved Searches**: View all cached Apify searches
- **Load Previous**: Access results without re-execution
- **Statistics**: Track usage patterns and savings
- **Delete Old**: Remove outdated searches

## 🔧 API Endpoints

### Search
- `POST /api/search` - Execute ad search
- `GET /api/search/multiple-pages` - Fetch paginated results

### Saved Searches
- `GET /api/complete-searches` - List saved searches
- `GET /api/complete-searches/:id` - Load specific search
- `DELETE /api/complete-searches/:id` - Delete search
- `GET /api/complete-searches/stats` - Usage statistics

### Saved Ads
- `GET /api/saved-ads` - List saved ads
- `POST /api/saved-ads` - Save ad
- `PUT /api/saved-ads/:id` - Update ad
- `DELETE /api/saved-ads/:id` - Delete ad

### Pages & AI
- `GET /api/pages` - Tracked pages
- `POST /api/suggestions` - AI keyword suggestions

## 🌟 Key Improvements from v1

### ✅ Type Safety
- **Shared types** between frontend/backend
- **Full TypeScript** coverage
- **Runtime type validation**

### ✅ Architecture
- **Monolith structure** for easier deployment
- **Clean separation** of concerns
- **Modern tooling** (Vite, ESM, latest packages)

### ✅ Performance
- **React Query** for state management
- **Optimistic updates** for better UX
- **Efficient caching** strategies

### ✅ Cost Optimization
- **Smart Apify caching** saves significant money
- **Intelligent filtering** reduces unnecessary calls
- **Usage tracking** for cost awareness

### ✅ Developer Experience
- **Hot reload** for both frontend/backend
- **Concurrent development** servers
- **Comprehensive error handling**

## 📊 Technology Stack

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **MongoDB** - Document database
- **Apify Client** - Professional scraping
- **Google AI** - Keyword suggestions
- **Puppeteer** - Screenshot capture

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Query** - State management
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

### DevOps
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Concurrently** - Multi-process development
- **TSX** - TypeScript execution

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 Scripts Reference

```bash
# Development
npm run dev                 # Start both servers
npm run backend:dev         # Backend only
npm run frontend:dev        # Frontend only

# Building
npm run build              # Build all projects
npm run backend:build      # Backend only
npm run frontend:build     # Frontend only

# Production
npm start                  # Start production server
npm run backend:start      # Backend production
npm run frontend:start     # Frontend preview

# Maintenance
npm run install:all        # Install all dependencies
npm run clean             # Clean all build artifacts
npm run typecheck         # Type checking
npm run lint              # Lint all projects
```

## 🔒 Environment Variables

### Backend (.env)
```bash
# Required
FACEBOOK_ACCESS_TOKEN=     # Facebook Graph API token
MONGO_URL=                 # MongoDB connection string

# Optional
APIFY_API_TOKEN=          # For professional scraping
GEMINI_API_KEY=           # For AI suggestions
PORT=3000                 # Server port
NODE_ENV=development      # Environment
FRONTEND_URL=             # Frontend URL for CORS
```

### Frontend (.env.local)
```bash
VITE_API_BASE_URL=        # Backend API URL (optional)
```

## 🎉 Success! 

Your professional Facebook Ads discovery platform is ready. The TypeScript monolith architecture provides excellent developer experience while the advanced caching system ensures cost-effective operations.

**Happy ad hunting!** 🎯💰
