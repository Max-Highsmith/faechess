# Raumschach - 3D Chess with Weekly Puzzles

A web application for playing Raumschach (5×5×5 3D Chess) with user accounts, puzzle tracking, and weekly puzzle subscriptions.

## Features

- ♟️ Full 3D chess game with AI opponent
- 🎯 Puzzle collection with mate-in-1 challenges
- 📧 Weekly puzzle email subscriptions
- 👤 User accounts with Supabase authentication
- 📊 Progress tracking across devices
- 🎨 Multiple visual themes and view modes

---

## Setup Guide

### Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works fine)
- A Resend account for email (free tier: 100 emails/day)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Set Up Supabase Database

1. **Create a new Supabase project** at [supabase.com](https://supabase.com)

2. **Run the database schema**:
   - Go to your Supabase project dashboard
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"
   - Copy and paste the entire contents of `migrations/schema.sql`
   - Click "Run" to execute the SQL

3. **Get your Supabase credentials**:
   - Go to Project Settings → API
   - Copy your `Project URL`
   - Copy your `anon` (public) key
   - Copy your `service_role` (secret) key

### Step 3: Set Up Resend for Emails

1. **Create account** at [resend.com](https://resend.com)
2. **Add and verify your domain** (or use their test domain)
3. **Create an API key**
4. Copy the API key

### Step 4: Configure Environment Variables

1. **Create `.env` file** in the project root:

```bash
cp .env.example .env
```

2. **Edit `.env`** and fill in your credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Email Service (Resend)
RESEND_API_KEY=re_your-api-key-here

# Application
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:5173

# Frontend (Vite) - Same values as above
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 5: Migrate Existing Puzzles

Run the migration script to import the 5 existing puzzles into your database:

```bash
npm run migrate
```

This will:
- Import all 5 puzzles into the database
- Schedule them for the next 5 weeks (one per week)

### Step 6: Create Admin Account

1. **Start the development server**:
```bash
npm run dev
```

2. **Open your browser** to `http://localhost:5173`

3. **Sign up** for an account using your email

4. **Make yourself an admin**:
   - Go to Supabase dashboard → Table Editor → `users` table
   - Find your user record
   - Set `is_admin` to `true`

---

## Development

### Run Development Server

```bash
npm run dev
```

This starts:
- **Vite dev server** on `http://localhost:5173` (frontend)
- **Express API server** on `http://localhost:3000` (backend)

The Vite server proxies API requests to the Express server.

### Build for Production

```bash
npm run build
```

This creates optimized files in the `/public` directory.

### Run Production Server

```bash
npm start
```

Serves the built application on port 3000 (or PORT from .env).

---

## Deployment

### Deploy to Railway

1. **Install Railway CLI**:
```bash
npm i -g @railway/cli
```

2. **Login and initialize**:
```bash
railway login
railway init
```

3. **Set environment variables**:
```bash
railway variables set SUPABASE_URL=...
railway variables set SUPABASE_SERVICE_KEY=...
railway variables set RESEND_API_KEY=...
railway variables set NODE_ENV=production
railway variables set CLIENT_URL=https://your-domain.railway.app
```

4. **Deploy**:
```bash
railway up
```

### Deploy to Render

1. Create a new Web Service on [render.com](https://render.com)
2. Connect your GitHub repository
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables in the Render dashboard
6. Deploy!

### Deploy to Fly.io

1. **Install Fly CLI** and login
2. **Create `fly.toml`** (see deployment docs)
3. **Set secrets**:
```bash
fly secrets set SUPABASE_URL=...
fly secrets set SUPABASE_SERVICE_KEY=...
fly secrets set RESEND_API_KEY=...
```
4. **Deploy**:
```bash
fly deploy
```

---

## Project Structure

```
/src
  /client
    /js
      - game.js          # Core game logic
      - render.js        # 3D visualization (Three.js)
      - flat-render.js   # 2D visualization
      - main.js          # Main controller
      - ai.js            # AI opponent
      - puzzles.js       # Puzzle definitions
      - auth.js          # Authentication UI & logic
      - supabase-client.js  # Supabase browser client
    /styles
      - main.css         # All styles
    index.html           # Main HTML
  /server
    - server.js          # Express server
    - db.js              # Supabase server client
    - auth-middleware.js # Auth middleware
    - email-service.js   # Email sending
    - puzzle-scheduler.js # Weekly cron job
    /routes
      - puzzle.routes.js       # Puzzle API
      - subscription.routes.js # Subscription API
      - admin.routes.js        # Admin API
/migrations
  - schema.sql         # Database schema
  - migrate-puzzles.js # Puzzle migration script
/public               # Build output (auto-generated)
```

---

## API Endpoints

### Puzzles
- `GET /api/puzzles` - List all puzzles
- `GET /api/puzzles/weekly` - Get this week's puzzle
- `GET /api/puzzles/:id` - Get specific puzzle
- `POST /api/puzzles/:id/attempt` - Submit attempt (auth required)
- `GET /api/puzzles/user/progress` - Get user progress (auth required)

### Subscriptions
- `POST /api/subscriptions` - Subscribe to weekly puzzles (auth required)
- `GET /api/subscriptions/status` - Get subscription status (auth required)
- `DELETE /api/subscriptions` - Unsubscribe (auth required)

### Admin
- `POST /api/admin/puzzles` - Create puzzle (admin only)
- `PUT /api/admin/puzzles/:id` - Update puzzle (admin only)
- `DELETE /api/admin/puzzles/:id` - Delete puzzle (admin only)
- `POST /api/admin/puzzles/:id/schedule` - Schedule for week (admin only)
- `GET /api/admin/schedule` - View schedule (admin only)
- `GET /api/admin/stats` - Platform statistics (admin only)

---

## Weekly Puzzle System

The weekly puzzle scheduler runs every Monday at 9:00 AM (UTC by default).

### How it works:
1. Scheduler checks `weekly_puzzle_schedule` table for this week's puzzle
2. Fetches all active subscribed users
3. Sends email to each user with puzzle link
4. Logs email results

### Testing the scheduler:
In `src/server/puzzle-scheduler.js`, uncomment the test line to trigger immediately:

```javascript
// Uncomment for testing:
sendWeeklyPuzzleEmails();
```

### Scheduling puzzles:
As an admin, use the admin API to schedule puzzles:

```bash
POST /api/admin/puzzles/1/schedule
{
  "week_date": "2024-04-01"  # Must be a Monday
}
```

---

## Admin Tasks

### Create a new puzzle:

```javascript
POST /api/admin/puzzles
{
  "title": "New Puzzle Title",
  "description": "White to move. Mate in 1.",
  "hint": "Look for a queen sacrifice",
  "difficulty": 2,
  "turn": "w",
  "board_state": {
    "0,0,0": { "type": "K", "color": "b" },
    // ... more pieces
  },
  "solution": {
    "from": [1, 2, 3],
    "to": [4, 5, 6]
  }
}
```

### View platform statistics:

```bash
GET /api/admin/stats
```

Returns: user count, subscriptions, puzzles, solve rate, etc.

---

## Troubleshooting

### Database connection errors
- Check your `.env` file has correct Supabase credentials
- Verify your Supabase project is active
- Check network connectivity

### Email not sending
- Verify RESEND_API_KEY is correct
- Check Resend dashboard for error logs
- Make sure your domain is verified (or use test domain)
- Check email quota (free tier: 100/day)

### Build errors
- Run `npm install` to ensure all dependencies are installed
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 18+)

### Vite dev server issues
- Make sure port 5173 is available
- Check `vite.config.js` proxy settings
- Try clearing Vite cache: `rm -rf node_modules/.vite`

---

## Contributing

This is a demonstration project for transforming a static game into a full-stack web application. Feel free to fork and customize!

## License

MIT

---

## Next Steps / Future Enhancements

- 📱 Mobile app (React Native)
- 🎮 Multiplayer mode (Supabase Realtime)
- 🏆 Achievements and badges
- 📈 User statistics dashboard
- 🧩 Puzzle difficulty ratings based on solve time
- 👥 Community puzzle creation (moderated)
- 🌐 Internationalization (i18n)
- 🎨 More visual themes
- 📊 Leaderboards

---

**Enjoy playing Raumschach! ♟️**
