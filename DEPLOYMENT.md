# How to Build and Deploy

This document explains the build process and deployment workflow for the ONVIF Web Viewer application.

## Understanding the Build Process

### Frontend Build Modes

The frontend has three different modes:

| Mode | Command | Purpose | Environment |
|------|---------|---------|-------------|
| **Development** | `npm run dev` | Active development with hot reload | `import.meta.env.DEV = true` |
| **Preview** | `npm run preview` | Test production build locally | `import.meta.env.DEV = false` |
| **Production** | Deploy `dist/` files | Actual production deployment | `import.meta.env.DEV = false` |

### Key Differences

#### Development Mode (`npm run dev`)
- **Purpose**: Day-to-day development
- **Features**:
  - Hot Module Replacement (HMR) - instant updates without page reload
  - Source maps for easy debugging
  - Debug logs enabled (all `console.log` statements with `import.meta.env.DEV` condition)
  - No optimization - faster startup
- **URL**: `http://localhost:5173`
- **When to use**: During active development

#### Preview Mode (`npm run preview`)
- **Purpose**: Test production build on your local machine before deploying
- **Features**:
  - Serves the built `dist/` directory
  - Same code as production (minified, optimized)
  - Debug logs removed (production behavior)
  - Simulates production environment
- **URL**: `http://localhost:4173` (typically)
- **When to use**: Before deploying to production server

#### Production Deployment
- **Purpose**: Actual deployment to production server
- **Process**: Copy `dist/` files to web server (Nginx, Apache, static hosting)
- **Features**: Same as preview mode, but on production infrastructure

## Development Workflow

### Daily Development

```bash
# Backend
cd backend
npm install
npm run dev  # Runs on http://localhost:3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

**What you see:**
- Debug logs in browser console: `[App] Stopping recording...`, `[RecordingList] Fetching recordings...`
- Instant updates when you save files
- Detailed error messages

### Before Committing Code

```bash
# Check for linting errors
cd frontend
npm run lint

# Build to ensure no TypeScript errors
npm run build
```

## Deployment Workflow

### Step 1: Build for Production

```bash
cd frontend
npm run build
```

**What happens:**
- TypeScript compilation (`tsc -b`)
- Vite bundles and optimizes code
- Debug logs are completely removed (tree-shaking)
- Code minification and compression
- Output: `frontend/dist/` directory

**Output example:**
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js   # Minified JavaScript
│   └── index-[hash].css  # Minified CSS
```

### Step 2: Test Locally (Recommended)

```bash
npm run preview
```

**Purpose:**
- Verify the build works correctly
- Test with production settings (no debug logs)
- Check bundle size and performance
- Ensure all features work in production mode

**What to check:**
- ✅ No debug logs in browser console
- ✅ All features work correctly
- ✅ Recording list updates immediately after stopping
- ✅ Thumbnails display properly
- ✅ Multi-camera grid works

### Step 3: Deploy to Production

#### Option A: Static File Hosting (Netlify, Vercel, etc.)

```bash
# Simply deploy the dist/ directory
# Most platforms auto-detect Vite projects
```

#### Option B: Traditional Web Server (Nginx/Apache)

```bash
# Copy dist/ contents to web server
scp -r dist/* user@server:/var/www/html/

# Or using rsync
rsync -avz dist/ user@server:/var/www/html/
```

**Nginx configuration example:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/html;
    index index.html;

    # SPA routing - redirect all requests to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Serve recordings and thumbnails
    location /recordings {
        proxy_pass http://localhost:3001;
    }

    location /thumbnails {
        proxy_pass http://localhost:3001;
    }

    location /streams {
        proxy_pass http://localhost:3001;
    }
}
```

### Step 4: Deploy Backend

```bash
# On production server
cd /path/to/backend
npm install --production
npx knex migrate:latest
npm start

# Or with PM2 for process management
pm2 start src/index.js --name onvif-backend
```

## UVC Camera Support (Linux Only)

This application supports USB UVC cameras in addition to ONVIF network cameras. UVC support is **Linux-only** and requires V4L2 (Video4Linux2).

### System Requirements for UVC Cameras

#### Required Packages

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install v4l-utils ffmpeg
```

**Fedora/RHEL:**
```bash
sudo dnf install v4l-utils ffmpeg
```

#### User Permissions

The user running the backend must have access to video devices:

```bash
# Add user to video group
sudo usermod -a -G video $USER

# Log out and log back in for changes to take effect
# Or use newgrp to apply immediately
newgrp video

# Verify permissions
ls -l /dev/video*
# Should show: crw-rw---- 1 root video ...
```

### Verify UVC Camera Detection

```bash
# List all video devices
ls -l /dev/video*

# Get detailed device information
v4l2-ctl --list-devices

# Check device capabilities
v4l2-ctl --device=/dev/video0 --info
v4l2-ctl --device=/dev/video0 --list-formats
```

### Platform Compatibility

| Platform | ONVIF Support | UVC Support | Notes |
|----------|---------------|-------------|-------|
| **Linux** | ✅ Yes | ✅ Yes | Full support for both camera types |
| **Windows** | ✅ Yes | ❌ No | V4L2 is Linux-only |
| **macOS** | ✅ Yes | ❌ No | V4L2 is Linux-only |

### Performance Considerations

UVC cameras require video encoding, which is CPU-intensive:

- **ONVIF cameras**: Use `-c:v copy` (no encoding, low CPU usage)
- **UVC cameras**: Use `-c:v libx264` (encoding required, higher CPU usage)

**Recommendations:**
- Limit simultaneous UVC cameras to 2-3 on typical hardware
- ONVIF and UVC cameras can be used together (total max: 4 cameras)
- For better UVC performance, consider hardware encoding:
  ```bash
  # Check for hardware acceleration support
  ffmpeg -hwaccels

  # Intel Quick Sync (VAAPI)
  # AMD/Intel GPU encoding
  ```

### Troubleshooting UVC Cameras

#### Issue: "Device not found"

```bash
# Check if device exists
ls -l /dev/video*

# Check kernel messages
dmesg | grep video

# Verify UVC driver is loaded
lsmod | grep uvcvideo
```

#### Issue: "Permission denied"

```bash
# Check user is in video group
groups $USER

# If not, add and re-login
sudo usermod -a -G video $USER
```

#### Issue: "Device busy"

```bash
# Check which process is using the device
sudo fuser /dev/video0

# Or use lsof
lsof /dev/video0
```

#### Issue: "FFmpeg cannot open device"

```bash
# Test device with FFmpeg directly
ffmpeg -f v4l2 -i /dev/video0 -t 5 -f null -

# Check supported formats
v4l2-ctl --device=/dev/video0 --list-formats-ext
```

## Debug vs Production Code

### Development Build

```javascript
// This code runs in development
if (import.meta.env.DEV) console.log('[App] Stopping recording...');
```

**Browser console output:**
```
[App] Stopping recording for camera 3...
[App] Recording stopped for camera 3
[RecordingList] Fetching recordings...
```

### Production Build

The same code is **completely removed** during build:

```javascript
// Vite removes this entire if block during build
// The final bundle doesn't contain this code at all
```

**Browser console output:**
```
(empty - no debug logs)
```

## Troubleshooting

### Issue: "Build works but preview shows errors"

This usually means environment-specific code issues. Check:
- API URLs (make sure they work in production)
- CORS settings
- Environment variables

### Issue: "Debug logs still appear in production"

Make sure you ran `npm run build` **after** adding `import.meta.env.DEV` checks.

### Issue: "Preview doesn't reflect latest changes"

```bash
# Clean and rebuild
rm -rf dist/
npm run build
npm run preview
```

## Quick Reference

```bash
# Development
npm run dev          # Start dev server with HMR

# Testing
npm run lint         # Check code quality
npm run build        # Build for production
npm run preview      # Test production build locally

# Deployment
npm run build        # Build
# Then copy dist/ to production server
```

## Summary

- **Development**: Use `npm run dev` - fast, with debug logs
- **Pre-deployment**: Use `npm run build` + `npm run preview` - test production behavior locally
- **Production**: Deploy `dist/` to web server - NO `npm run preview` on production!

The key insight: **`npm run preview` is a local development tool** to simulate production. Actual production servers serve the static files directly via Nginx/Apache/hosting platform.
