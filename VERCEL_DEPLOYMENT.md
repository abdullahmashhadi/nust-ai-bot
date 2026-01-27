# Frontend Deployment on Vercel

## Steps to Deploy

### 1. Sign Up / Login to Vercel

- Go to [vercel.com](https://vercel.com)
- Click "Sign Up" or "Login"
- Choose "Continue with GitHub"

### 2. Import Project

- Click "Add New..." → "Project"
- Select "Import Git Repository"
- Find and select `nust-ai-bot` repository
- Click "Import"

### 3. Configure Project

**Root Directory**: `frontend`
**Framework Preset**: Vite
**Build Command**: `npm run build` (auto-detected)
**Output Directory**: `dist` (auto-detected)
**Install Command**: `npm install` (auto-detected)

### 4. Add Environment Variable

Click "Environment Variables" and add:

```
Name: VITE_API_URL
Value: https://nust-ai-bot.onrender.com
```

### 5. Deploy

- Click "Deploy"
- Wait 2-3 minutes for build to complete
- You'll get a URL like: `https://nust-ai-bot.vercel.app`

### 6. Configure Custom Domain (nusthelp.com)

#### In Vercel:

1. Go to Project Settings → Domains
2. Click "Add Domain"
3. Enter: `nusthelp.com`
4. Vercel will show DNS instructions

#### In GoDaddy:

1. Go to GoDaddy.com → My Products → DNS
2. Find `nusthelp.com` → Click DNS
3. **Delete existing A records** for `@`
4. Add **CNAME Record**:
   - Type: `CNAME`
   - Name: `@` (or leave empty if @ doesn't work, use `www`)
   - Value: `cname.vercel-dns.com`
   - TTL: `600`
5. Add another **CNAME for www**:
   - Type: `CNAME`
   - Name: `www`
   - Value: `cname.vercel-dns.com`
   - TTL: `600`

#### Alternative (if CNAME doesn't work for @):

Use **A Records** instead:

- Type: `A`
- Name: `@`
- Value: `76.76.21.21` (Vercel's IP)
- TTL: `600`

Add another A record:

- Type: `A`
- Name: `www`
- Value: `76.76.21.21`
- TTL: `600`

### 7. Verify Domain

- Wait 10-60 minutes for DNS propagation
- In Vercel, refresh the domain page
- Status should change to "Valid Configuration"
- HTTPS will be automatically enabled

### 8. Update Backend CORS (Important!)

Your backend needs to allow requests from the Vercel domain.

Go to Render dashboard → Your Service → Environment

Add these environment variables:

```
FRONTEND_URL=https://nusthelp.com
CORS_ORIGIN=https://nusthelp.com,https://www.nusthelp.com,https://nust-ai-bot.vercel.app
```

Then update `backend/src/index.js` to use these:

```javascript
const cors = require("cors");

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : ["http://localhost:3000", "http://localhost:5173"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
```

### 9. Test Your Deployment

1. Visit `https://nusthelp.com`
2. You should see a fullscreen chat interface
3. Try sending a message
4. Check that responses come from the backend

---

## Troubleshooting

### Frontend not loading

- Check build logs in Vercel dashboard
- Verify `VITE_API_URL` is set correctly
- Check browser console for errors

### Chat not connecting to backend

- Verify backend URL in environment variable
- Check CORS settings in backend
- Check Render backend logs

### Domain not working

- Wait longer for DNS propagation (can take up to 24 hours)
- Use `nslookup nusthelp.com` to check DNS
- Try clearing browser cache: Ctrl+Shift+Delete

### Backend sleeping (Free Render tier)

- First request takes ~30 seconds (cold start)
- Upgrade to Starter ($7/month) for always-on

---

## Quick Summary

1. ✅ Backend deployed: `https://nust-ai-bot.onrender.com`
2. ⏳ Frontend on Vercel: Follow steps above
3. ⏳ Point `nusthelp.com` to Vercel
4. ⏳ Update CORS in backend
5. ✅ Test and launch!

**Total time: ~20 minutes + DNS wait**
