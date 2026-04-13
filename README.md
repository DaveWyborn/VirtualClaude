# VirtualClaude

**Your own AI workspace in the cloud.** Open a browser, talk to Claude, manage your files — from any device, anywhere. No software to install. Nothing running on your laptop.

VirtualClaude gives you a private workspace where Claude Code runs on a server you control. Upload files, screenshots, and documents. Create separate projects for different clients or workstreams. Claude remembers your preferences and builds up context over time.

Built for people who use AI seriously but don't want to fight with terminals and config files.

---

## What you get

- **Browser-based workspace** — works on any device with a browser, even a ten-year-old laptop
- **File manager** — drag and drop files, images, screenshots. Claude can see and work with all of them
- **Project separation** — create projects for different clients or workstreams, each with their own files and context
- **Server stats** — CPU, RAM, and disk usage at a glance so you know your server is healthy
- **Always on** — your server runs 24/7. Close your laptop, open it tomorrow, everything is exactly where you left it
- **Private** — your files stay on your server. Password protected. Nothing is shared with anyone
- **Figma integration** (optional) — Claude can read and update Figma designs directly

## What it costs

- **VPS hosting:** ~£8/month (Hetzner CX22 recommended)
- **Vercel frontend:** Free
- **Claude:** Uses your existing Anthropic subscription — no extra API costs

---

## How it works

The frontend (what you see in the browser) runs free on Vercel. The backend (where Claude and your files live) runs on a cheap VPS that you own. They talk to each other over an encrypted connection.

```
Browser  -->  Vercel (free frontend)  -->  Your VPS (Claude + files)
```

You set it up once. After that, you just open a URL.

---

## Setup guide

You'll need about 30 minutes and no technical experience. If you have access to Claude (or ChatGPT), you can paste these instructions and have AI walk you through each step.

### What you need

| Thing | Where to get it | Cost |
|---|---|---|
| A VPS server | [hetzner.com](https://www.hetzner.com/cloud/) — pick CX22, Ubuntu 24.04 | ~£8/month |
| A GitHub account | [github.com](https://github.com/signup) | Free |
| A Vercel account | [vercel.com](https://vercel.com/signup) | Free |
| A domain or subdomain | Your existing domain, or buy one from [namecheap.com](https://www.namecheap.com) | Optional |

### Step 1: Fork this repository

Click the **Fork** button at the top right of this page. This creates your own copy of the code.

### Step 2: Deploy the frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account
2. Click **Add New Project**
3. Find and select your forked copy of VirtualClaude
4. Add two environment variables (leave the values blank for now — you'll fill them in at the end):
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_API_KEY`
5. Click **Deploy**

Vercel will build your site and give you a URL like `https://virtual-claude-abc123.vercel.app`. **Copy this URL** — you'll need it in Step 3.

### Step 3: Set up the VPS

Log into your VPS over SSH (Hetzner emails you the IP address and root password when you create the server).

Run these commands:

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/VirtualClaude.git /tmp/VirtualClaude
cd /tmp/VirtualClaude
chmod +x setup/install.sh
./setup/install.sh
```

The script will ask you three things:
- **Domain name** — your domain (e.g. `workspace.yourdomain.com`), or just the server IP if you don't have one
- **API key** — press Enter to generate one automatically
- **Vercel URL** — paste the URL from Step 2

**Write down the API key it gives you.** You'll need it in the next step.

### Step 4: Point your domain to the VPS

If you're using a domain, add a DNS record at your domain registrar:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `workspace` (or your subdomain) | Your VPS IP address | 300 |

Wait a few minutes for it to take effect. If you're not using a domain, skip this step — you can access the server by IP.

### Step 5: Enable HTTPS

SSH into your VPS and run:

```bash
certbot --nginx -d workspace.yourdomain.com
```

This sets up a secure connection. Follow the prompts — it takes about 30 seconds.

### Step 6: Connect the frontend to the backend

Go back to Vercel:
1. Open your project **Settings**
2. Go to **Environment Variables**
3. Set the values you left blank earlier:
   - `NEXT_PUBLIC_API_URL` = `https://workspace.yourdomain.com` (your domain, with https)
   - `NEXT_PUBLIC_API_KEY` = the API key from Step 3
4. Go to **Deployments** and click **Redeploy** on the latest deployment

### Step 7: Set up Claude

SSH into your VPS and run:

```bash
su - writer
claude
```

This launches Claude Code. It will ask you to sign in with your Anthropic account the first time. After that, it's ready to use from the browser.

---

## Using VirtualClaude

1. **Open your Vercel URL** in any browser
2. **Create a project** — click the **+** button in the sidebar
3. **Upload files** — drag and drop into the file panel, or click Upload
4. **Start Claude** — click the terminal panel and type `claude`
5. **Work** — ask Claude to edit content, review documents, generate copy, work with images

Claude can see everything in your project folder. Upload a screenshot and ask "what do you think of this layout?" Upload a brief and ask "write the first draft." It works with what you give it.

### Tips

- **Create separate projects** for different clients or workstreams — keeps files and context clean
- **Upload reference material** (brand guidelines, style guides, examples) at the start of a project — Claude will use them
- **Screenshots work** — drag in a screenshot of a design, webpage, or document and Claude can see it
- Claude **remembers context** within a session. You don't need to re-explain things every message

---

## Optional: Figma integration

If you work with Figma, Claude can read and update your designs directly.

1. Go to [figma.com](https://www.figma.com) > **Settings** > **Personal access tokens**
2. Create a new token and copy it
3. SSH into your VPS:
   ```bash
   su - writer
   nano ~/.claude/settings.json
   ```
4. Replace `PASTE_YOUR_FIGMA_TOKEN_HERE` with your token
5. Save (Ctrl+X, then Y, then Enter)

Now Claude can open your Figma files, read content, update text, and export frames as images to check its work.

---

## Updating

**Frontend:** Push any changes to your GitHub fork — Vercel redeploys automatically.

**Backend:** SSH into your VPS and run:

```bash
cd /opt/claude-workspace-server
git pull
npm install --production
pm2 restart claude-workspace
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Failed to fetch" when creating a project | Check that `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY` are set correctly in Vercel, and that the backend is running (`pm2 status` on the VPS) |
| Terminal won't connect | Check Nginx is running (`systemctl status nginx`) and that WebSocket traffic isn't blocked by a firewall |
| Claude says "no API key" | Sign in again: `su - writer` then `claude` — it will prompt for authentication |
| Server stats show "Connecting..." | The backend isn't reachable — check the API URL and that the server is running |
| SSL/HTTPS not working | Run `certbot --nginx -d yourdomain.com` on the VPS |

---

## Architecture

For the technically curious:

```
Vercel (free)                    Your VPS (~£8/month)
+------------------+             +---------------------------+
| Next.js frontend | -- HTTPS -> | Express API server        |
| - Project sidebar|             | - File management (CRUD)  |
| - File browser   |             | - WebSocket terminal      |
| - xterm.js term  |             | - node-pty (Claude shell) |
| - Server stats   |             | - Nginx reverse proxy     |
+------------------+             | - SSL via Let's Encrypt   |
                                 +---------------------------+
```

Frontend is static — no server-side rendering needed. All logic runs on the VPS. Authentication is via API key in request headers (HTTP) and query parameter (WebSocket). Nginx provides basic auth as an additional layer.

---

Built with Claude Code.
