# Local Testing Guide

## Development Workflows

### 1. Full Local Development (Recommended for Testing)
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```
Access at: `http://localhost:5173` → Uses `http://localhost:3001` backend

### 2. Production Build Testing with Local Backend
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend (build first)
cd frontend
npm run build
npm run preview:local
```
Access at: `http://localhost:4173` → Uses `http://localhost:3001` backend

### 3. Production Build Testing with Render Backend
```bash
# Frontend only (no backend needed)
cd frontend
npm run build
npm run preview
```
Access at: `http://localhost:4173` → Uses `https://nust-ai-bot.onrender.com`

## Environment Files

- `.env.development` - Used by `npm run dev` → localhost:3001
- `.env.local` - Used by `npm run preview:local` → localhost:3001  
- `.env.production` - Used by `npm run preview` → Render URL
- `.env.production` - Used by Vercel deployment → Render URL

## Quick Reference

| Command | Frontend URL | Backend URL | Use Case |
|---------|-------------|-------------|----------|
| `npm run dev` | localhost:5173 | localhost:3001 | Active development |
| `npm run preview:local` | localhost:4173 | localhost:3001 | Test build locally |
| `npm run preview` | localhost:4173 | Render (prod) | Test build with prod backend |
