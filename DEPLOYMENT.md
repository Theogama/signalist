# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **MongoDB Atlas**: Set up a MongoDB database
4. **Environment Variables**: Configure all required environment variables

## Environment Variables Required

Add these in your Vercel project settings (Settings → Environment Variables):

### Required Variables

```env
# MongoDB
MONGODB_URI=your_mongodb_connection_string

# Better Auth
BETTER_AUTH_SECRET=your_random_secret_key_here
BETTER_AUTH_URL=https://your-project.vercel.app

# Optional but Recommended
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
VERCEL_URL=your-project.vercel.app

# MT5 Service (if using)
MT5_SERVICE_URL=http://localhost:5000

# Finnhub (if using)
NEXT_PUBLIC_FINNHUB_API_KEY=your_finnhub_key

# Gemini (if using)
GEMINI_API_KEY=your_gemini_key

# Nodemailer (if using)
NODEMAILER_EMAIL=your_email
NODEMAILER_PASSWORD=your_app_password
```

## Deployment Steps

1. **Connect Repository to Vercel**
   - Go to Vercel Dashboard
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

2. **Configure Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all required variables listed above
   - Make sure to add them for Production, Preview, and Development

3. **Build Settings**
   - Framework Preset: Next.js
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Check build logs for any errors

## Common Issues

### DNS Error (DNS_PROBE_FINISHED_NXDOMAIN)

**Problem**: Domain not resolving after deployment

**Solutions**:
1. Check if deployment actually succeeded in Vercel dashboard
2. Verify the domain name is correct
3. Wait a few minutes for DNS propagation
4. Check Vercel project settings → Domains
5. Ensure environment variables are set correctly

### Build Errors

**Common causes**:
- Missing environment variables
- TypeScript errors (check `next.config.ts` - we have `ignoreBuildErrors: true`)
- Import errors (check all imports use correct paths)

### Authentication Not Working

**Check**:
- `BETTER_AUTH_SECRET` is set and is a random string
- `BETTER_AUTH_URL` matches your Vercel deployment URL
- MongoDB connection string is correct

## Post-Deployment Checklist

- [ ] Deployment shows "Ready" in Vercel dashboard
- [ ] All environment variables are set
- [ ] Domain is properly configured
- [ ] Test authentication (sign up/login)
- [ ] Test API endpoints
- [ ] Check MongoDB connection
- [ ] Verify MT5 service is accessible (if using)

## Troubleshooting

1. **Check Build Logs**: Go to Vercel Dashboard → Deployments → Click on deployment → View logs

2. **Check Runtime Logs**: Go to Vercel Dashboard → Functions → View logs

3. **Test Locally First**: Run `npm run build` locally to catch errors before deploying

4. **Verify Environment Variables**: Make sure all variables are set in Vercel dashboard

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Ensure MongoDB is accessible from Vercel's IP ranges



