# NUST Chatbot Deployment Guide

## Deploy to nusthelp.com

---

## **Option 1: Cloud Platforms (Recommended - Free/Cheap)**

### **Step 1: Deploy Backend to Render.com**

1. **Push to GitHub** (if not already):

   ```bash
   cd /media/mashhadi/2ndDrive/nustBot/nust-bots
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Create Render Account**: Go to [render.com](https://render.com) and sign up

3. **New Web Service**:
   - Click "New +" → "Web Service"
   - Connect GitHub repository
   - Select your `nust-bots` repository
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`

4. **Add Environment Variables**:
   Copy all variables from `backend/.env`:

   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_key
   OPENAI_API_KEY=your_key
   USE_ADVANCED_RAG=true
   RAG_MODE=balanced
   PORT=3000
   ```

5. **Deploy** → Note the URL: `https://nust-bot-backend.onrender.com`

### **Step 2: Deploy Frontend to Vercel**

1. **Update Frontend API URL**:
   Edit `frontend/src/config.ts` (or wherever API URL is):

   ```typescript
   const API_URL = "https://nust-bot-backend.onrender.com/api";
   ```

2. **Create Vercel Account**: [vercel.com](https://vercel.com)

3. **New Project**:
   - Import from GitHub
   - Select repository → Root: `frontend`
   - Framework Preset: Vite
   - Click Deploy

4. **Get Vercel URL**: e.g., `nust-bot.vercel.app`

### **Step 3: Connect GoDaddy Domain**

#### **For Frontend (nusthelp.com)**:

1. Go to GoDaddy → Domain Settings → DNS Management
2. Delete existing A records for `@`
3. Add **CNAME Record**:
   - Type: `CNAME`
   - Name: `@`
   - Value: `cname.vercel-dns.com`
   - TTL: 600
4. In Vercel Project Settings → Domains → Add `nusthelp.com`
5. Verify DNS (takes 10-60 mins)

#### **For Backend API (api.nusthelp.com)**:

1. In GoDaddy DNS, add **CNAME**:
   - Type: `CNAME`
   - Name: `api`
   - Value: `nust-bot-backend.onrender.com`
   - TTL: 600
2. In Render dashboard → Settings → Custom Domain → Add `api.nusthelp.com`
3. Update frontend to use: `https://api.nusthelp.com/api`

---

## **Option 2: VPS Deployment (Full Control)**

### **Step 1: Get a VPS**

- **DigitalOcean Droplet**: $6/month (recommended)
- **AWS EC2**: Free tier for 1 year
- **Vultr/Linode**: Similar pricing

### **Step 2: Server Setup**

```bash
# SSH into server
ssh root@your_server_ip

# Update system
apt update && apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx (web server)
apt install -y nginx

# Install certbot (SSL)
apt install -y certbot python3-certbot-nginx
```

### **Step 3: Deploy Backend**

```bash
# Create app directory
mkdir -p /var/www/nustbot
cd /var/www/nustbot

# Clone repository
git clone <your-github-repo> .

# Install backend dependencies
cd backend
npm install

# Create .env file
nano .env
# (Paste all your environment variables)

# Start with PM2
pm2 start src/index.js --name nust-backend
pm2 save
pm2 startup
```

### **Step 4: Build & Deploy Frontend**

```bash
# On your local machine, build frontend
cd /media/mashhadi/2ndDrive/nustBot/nust-bots/frontend
npm run build

# Copy dist folder to server
scp -r dist/* root@your_server_ip:/var/www/nustbot/frontend/
```

### **Step 5: Configure Nginx**

```bash
# Create Nginx config
nano /etc/nginx/sites-available/nusthelp
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name nusthelp.com www.nusthelp.com;

    # Frontend
    location / {
        root /var/www/nustbot/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/nusthelp /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### **Step 6: Point GoDaddy Domain to Server**

1. Go to GoDaddy → DNS Management
2. Edit **A Record**:
   - Type: `A`
   - Name: `@`
   - Value: `YOUR_SERVER_IP`
   - TTL: 600
3. Add **www CNAME** (optional):
   - Type: `CNAME`
   - Name: `www`
   - Value: `nusthelp.com`

Wait 10-60 minutes for DNS propagation.

### **Step 7: Enable HTTPS (SSL)**

```bash
# Get SSL certificate (free from Let's Encrypt)
certbot --nginx -d nusthelp.com -d www.nusthelp.com

# Auto-renewal is set up automatically
certbot renew --dry-run
```

---

## **Post-Deployment Checklist**

- [ ] Backend API accessible at `https://api.nusthelp.com` or `https://nusthelp.com/api`
- [ ] Frontend loads at `https://nusthelp.com`
- [ ] Chat functionality working
- [ ] HTTPS/SSL enabled (green padlock)
- [ ] Environment variables configured
- [ ] Database connection working
- [ ] Test with sample queries
- [ ] Set up monitoring (PM2 or Render dashboard)

---

## **Maintenance Commands**

### **PM2 (if using VPS)**

```bash
pm2 status           # Check status
pm2 logs nust-backend # View logs
pm2 restart nust-backend # Restart
pm2 stop nust-backend    # Stop
```

### **Update Deployment**

```bash
# Pull latest code
cd /var/www/nustbot
git pull

# Backend
cd backend
npm install
pm2 restart nust-backend

# Frontend (rebuild on local, then upload)
```

---

## **Troubleshooting**

### **Backend not responding**

```bash
pm2 logs nust-backend
# Check for errors
# Verify .env file exists
```

### **Frontend not loading**

- Check Nginx config: `nginx -t`
- Check Nginx logs: `tail -f /var/log/nginx/error.log`

### **DNS not working**

- Wait 1 hour for propagation
- Check DNS: `nslookup nusthelp.com`
- Flush DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)

---

## **Cost Comparison**

| Option                   | Cost  | Pros                                    | Cons                                               |
| ------------------------ | ----- | --------------------------------------- | -------------------------------------------------- |
| **Render + Vercel**      | Free  | Easy, auto-deploy, HTTPS included       | Backend sleeps after 15 min inactivity (free tier) |
| **DigitalOcean Droplet** | $6/mo | Full control, always on                 | Manual setup, you manage updates                   |
| **Railway**              | $5/mo | Like Render but more reliable free tier | Costs after free credits                           |

---

## **Recommended: Start with Render + Vercel**

Benefits:

- ✅ Free to start
- ✅ Automatic deployments from GitHub
- ✅ HTTPS included
- ✅ Easy scaling if needed
- ✅ No server management

Upgrade to VPS later if you need:

- 24/7 uptime without cold starts
- More control
- Lower cost at scale
