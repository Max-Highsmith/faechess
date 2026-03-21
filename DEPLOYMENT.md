# Deploying to Namecheap Domain

This guide will help you deploy your Raumschach app to your Namecheap domain.

## Overview

You have several options:
1. **Railway** (Recommended - easiest)
2. **Render.com** (Easy, good free tier)
3. **Vercel** (Good for static + serverless)
4. **Your own VPS** (Most control, more setup)

All options will work with your Namecheap domain - you just need to point your domain to the hosting platform.

---

## Option 1: Railway (Recommended)

### Step 1: Deploy to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Step 2: Set Environment Variables in Railway

In Railway dashboard, add all your `.env` variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `RESEND_API_KEY`
- `NODE_ENV=production`
- `CLIENT_URL=https://yourdomain.com` (use your actual domain)
- `VITE_SUPABASE_URL` (same as SUPABASE_URL)
- `VITE_SUPABASE_ANON_KEY` (same as SUPABASE_ANON_KEY)

### Step 3: Get Railway URL

Railway will give you a URL like: `your-app.railway.app`

### Step 4: Point Your Namecheap Domain to Railway

**Option A: Using Custom Domain in Railway**
1. In Railway dashboard → Settings → Domains
2. Click "Add Custom Domain"
3. Enter your domain: `yourdomain.com`
4. Railway will show you DNS records to add

**Go to Namecheap:**
1. Login to Namecheap
2. Go to Dashboard → Domain List → Manage
3. Click "Advanced DNS"
4. Add the CNAME record Railway gave you:
   - Type: `CNAME Record`
   - Host: `@` (or `www`)
   - Value: `your-app.railway.app`
   - TTL: Automatic

5. Wait 5-30 minutes for DNS to propagate
6. Railway will automatically handle SSL certificate

**Option B: Using Cloudflare (Better performance)**
1. Transfer DNS to Cloudflare (free)
2. Point domain to Railway using Cloudflare DNS
3. Get free CDN and DDoS protection

---

## Option 2: Render.com

### Step 1: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/raumschach.git
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com) and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: raumschach
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. Add environment variables (same as Railway list above)

### Step 3: Point Domain to Render

Render gives you a URL like: `your-app.onrender.com`

1. In Render dashboard → Settings → Custom Domain
2. Add your domain
3. Render shows DNS records to add

**In Namecheap:**
1. Advanced DNS
2. Add CNAME record:
   - Type: `CNAME`
   - Host: `@`
   - Value: `your-app.onrender.com`

---

## Option 3: Vercel (Static + Serverless Functions)

This requires a different architecture (serverless functions instead of Express).

### Quick Deploy:

```bash
npm i -g vercel
vercel
```

Follow prompts, then add environment variables in Vercel dashboard.

**Note**: You'll need to convert Express routes to Vercel serverless functions. I can help with this if you want to use Vercel.

---

## Option 4: Your Own VPS (DigitalOcean, Linode, AWS)

If you have a VPS:

### 1. SSH into server

```bash
ssh user@your-server-ip
```

### 2. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Clone & Deploy

```bash
git clone your-repo
cd raumschach
npm install
npm run build
```

### 4. Use PM2 to keep it running

```bash
npm install -g pm2
pm2 start npm --name "raumschach" -- start
pm2 save
pm2 startup
```

### 5. Set up Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6. Set up SSL with Certbot

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### 7. Point Namecheap to your VPS

In Namecheap Advanced DNS:
- Type: `A Record`
- Host: `@`
- Value: `your-vps-ip-address`

---

## Testing Before Going Live

Before changing DNS:

1. Add Railway/Render URL to Supabase
   - Go to Supabase → Authentication → URL Configuration
   - Add your Railway/Render URL to "Site URL"
   - Add to "Redirect URLs"

2. Update `.env` on server:
   ```
   CLIENT_URL=https://your-railway-app.railway.app
   ```

3. Test the deployed version works
4. Then point your Namecheap domain

---

## Post-Deployment Checklist

✅ App loads at your domain
✅ Can sign up / log in
✅ 3D chess board renders
✅ Puzzles load
✅ Can subscribe to weekly puzzles
✅ SSL certificate is active (https://)
✅ Update Resend domain (if using custom domain for emails)

---

## Troubleshooting

### "Module not found" errors
- Run `npm run build` on the server
- Check that `/public` directory was created

### Database connection errors
- Verify environment variables are set correctly
- Check Supabase firewall settings

### 3D chess board not showing
- Check browser console for errors
- Ensure Three.js is bundled correctly
- Try hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

---

## Recommended: Railway

**Why Railway is easiest:**
- Automatic HTTPS
- Easy custom domain setup
- Good free tier ($5/month free credit)
- Auto-deploy on git push
- Built-in monitoring
- One command deployment

**Cost**: Free tier covers small apps, ~$5-10/month for production

---

Need help with any of these steps? Let me know which hosting option you prefer!
