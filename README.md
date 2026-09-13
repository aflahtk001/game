# 3D Multiplayer GTA Game with WebRTC Proximity Voice

A real-time multiplayer 3D open-world game built with **Three.js**, **TypeScript**, **WebSockets**, and **WebRTC Proximity Voice Chat**, backed by **Supabase PostgreSQL**.

---

## ?? Features

- **Real-Time Multiplayer State Sync (20 Hz)**: Smooth player movement, interpolation, and animations using in-memory WebSocket rooms.
- **Multi-Seat Vehicle Physics & Networking**: Drive cars, trucks, and buses with multiple passengers, local driver physics authority, and dead-reckoning smoothing for passengers.
- **WebRTC 3D Spatial Proximity Voice Chat**:
  - Distance-based volume attenuation (-5\text{m}$ full volume, -25\text{m}$ falloff, $>25\text{m}$ inaudible).
  - 3D HRTF spatial audio panning relative to camera orientation.
  - Zero connection drops across distance boundaries.
  - Real-time microphone status and speaking indicators in HUD and 3D overhead name tags.
- **Global Text Chat**: Room-based chat with sanitization, rate limiting, and persistent history in Supabase.

---

## ??? Architecture Overview

`
Frontend (Vite + Three.js + WebRTC)
  +-- Static Hosting: Cloudflare Pages
  +-- Live State (20 Hz): In-Memory WebSocket to Backend Server
  +-- Voice Chat: 100% Peer-to-Peer WebRTC (DTLS/SRTP UDP)

Backend (Node.js + WebSocket Server)
  +-- High-Frequency Tick (20 Hz): In-Memory GameStateManager
  +-- WebRTC Signaling: SDP Offer/Answer & ICE candidate routing
  +-- Persistent Storage: Supabase PostgreSQL (Profiles, Sessions, Chat)
`

---

## ?? Local Development

### 1. Install Dependencies

`ash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
`

### 2. Environment Variables

Create .env in server/:

`env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
`

### 3. Run the Project

`ash
# Terminal 1: Start Backend Server
cd server
npm run dev

# Terminal 2: Start Frontend
npm run dev
`

Open http://localhost:5173 in your browser.

---

## ?? Deployment to Cloudflare Pages

### Step 1: Push Code to GitHub

`ash
git add .
git commit -m "Initial commit: Multiplayer GTA game with WebRTC proximity voice"
git push -u origin main
`

### Step 2: Deploy Frontend to Cloudflare Pages

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Select repository flahtk001/game.
3. Configure build settings:
   - **Framework preset**: Vite
   - **Build command**: 
pm run build
   - **Build output directory**: dist
4. In **Environment variables (Production & Preview)**, add:
   - VITE_WS_SERVER_URL: wss://your-backend-domain.com (e.g. Render / Railway / VPS URL).
5. Click **Save and Deploy**.

### Step 3: Deploy Backend WebSocket Server

Since Cloudflare Pages hosts static assets, the Node.js WebSocket backend can be deployed to any Node host (Render, Railway, Fly.io, or VPS):
- **Build Command**: cd server && npm install && npm run build
- **Start Command**: cd server && npm start
- **Environment Variables**:
  - PORT: 3001 (or port provided by host)
  - SUPABASE_URL: Your Supabase URL
  - SUPABASE_SERVICE_ROLE_KEY: Your Supabase Service Role Key
  - SUPABASE_ANON_KEY: Your Supabase Anon Key
  - CORS_ORIGIN: Your Cloudflare Pages URL (e.g. https://your-app.pages.dev)
