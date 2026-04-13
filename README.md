# Claude Workspace

A web-based workspace for Claude Code. You get a browser-based file manager and terminal — no local install needed. The frontend runs free on Vercel, the backend runs on a cheap VPS.

## What you need before starting

- **A VPS** — Ubuntu 24.04. A Hetzner CX22 works well at around 4 euros/month. Anything with 2GB RAM and 2 vCPUs is fine.
- **A domain name** (or subdomain) — something like `workspace.yourdomain.com`. You'll point this at your VPS.
- **A GitHub account** — to fork this repo and connect it to Vercel.
- **A Vercel account** — free tier is all you need. Sign up at [vercel.com](https://vercel.com).
- **An Anthropic API key** — for Claude Code. Get one at [console.anthropic.com](https://console.anthropic.com).

## Quick start

### Step 1: Fork this repo

Click the **Fork** button at the top of this GitHub page. This creates your own copy.

### Step 2: Deploy the frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project**
3. Select your forked repo
4. Before deploying, add these environment variables:
   - `NEXT_PUBLIC_API_URL` — leave this blank for now (you'll fill it in after VPS setup)
   - `NEXT_PUBLIC_API_KEY` — leave this blank for now
5. Click **Deploy**

It will build and give you a URL like `https://your-app.vercel.app`. Save this URL.

### Step 3: Set up the VPS

SSH into your VPS as root and run:

```bash
git clone https://github.com/YOUR_USERNAME/claude-workspace.git /tmp/claude-workspace
cd /tmp/claude-workspace
chmod +x setup/install.sh
./setup/install.sh
```

The script will ask you for:
- **Domain name** — the domain or subdomain you're using (e.g. `workspace.yourdomain.com`)
- **API key** — press Enter to generate one automatically, or paste your own
- **Vercel frontend URL** — the URL from Step 2

Save the API key it shows you. You'll need it in the next step.

### Step 4: Point your domain to the VPS

Go to your domain registrar (wherever you bought your domain) and add a DNS record:

- **Type:** A
- **Name:** `workspace` (or whatever subdomain you chose)
- **Value:** your VPS IP address
- **TTL:** 300

Wait a few minutes for DNS to propagate.

### Step 5: Enable SSL

If you didn't run certbot during install, SSH into the VPS and run:

```bash
certbot --nginx -d workspace.yourdomain.com
```

Replace with your actual domain. It will set up HTTPS automatically.

### Step 6: Update Vercel environment variables

Go back to Vercel:
1. Open your project settings
2. Go to **Environment Variables**
3. Update:
   - `NEXT_PUBLIC_API_URL` = `https://workspace.yourdomain.com` (your domain with https)
   - `NEXT_PUBLIC_API_KEY` = the API key from Step 3
4. Go to **Deployments** and click **Redeploy** on the latest deployment

### Step 7: Set your Anthropic API key on the VPS

SSH into the VPS and run:

```bash
su - writer
export ANTHROPIC_API_KEY=sk-ant-your-key-here
echo 'export ANTHROPIC_API_KEY=sk-ant-your-key-here' >> ~/.bashrc
```

Replace `sk-ant-your-key-here` with your actual Anthropic API key.

## Environment variables reference

### Frontend (Vercel)

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Your VPS domain with https | `https://workspace.yourdomain.com` |
| `NEXT_PUBLIC_API_KEY` | API key for authenticating with the backend | `a1b2c3...` |

### Backend (VPS .env file)

These are set automatically by the install script. The file lives at `/opt/claude-workspace-server/.env`.

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the server runs on | `3001` |
| `API_KEY` | Must match the frontend key | Set during install |
| `PROJECTS_DIR` | Where project files are stored | `/home/writer/projects` |
| `CORS_ORIGIN` | Your Vercel frontend URL | Set during install |

## Figma setup (optional)

If you want Claude to work directly with Figma designs:

1. Go to [figma.com/developers](https://www.figma.com/developers) and create a personal access token
2. SSH into your VPS and edit the settings file:
   ```bash
   su - writer
   nano ~/.claude/settings.json
   ```
3. Replace `PASTE_YOUR_FIGMA_TOKEN_HERE` with your actual token
4. Save and exit (Ctrl+X, then Y, then Enter)

Claude will now be able to read and update your Figma files.

## Using it

1. Open your Vercel URL in a browser
2. Click the **+** button to create a new project
3. Drag files into the file panel on the left to upload them
4. Click the terminal panel and type `claude` to start Claude Code
5. Claude can see and work with all the files in your project — ask it to edit, review, or create content

## Updating

When there are updates to the repo, SSH into your VPS and run:

```bash
cd /opt/claude-workspace-server
git pull
npm install --production
pm2 restart claude-workspace
```

For frontend updates, push to your GitHub fork and Vercel will redeploy automatically.

## Troubleshooting

**Can't connect to the backend**
- Check the server is running: `pm2 status`
- Check Nginx is running: `systemctl status nginx`
- Make sure your DNS is pointing to the right IP: `dig workspace.yourdomain.com`

**Terminal won't open**
- Check WebSocket connections aren't being blocked by a firewall
- Verify Nginx config: `nginx -t`

**Claude says "no API key"**
- Make sure `ANTHROPIC_API_KEY` is set for the writer user: `su - writer -c 'echo $ANTHROPIC_API_KEY'`
