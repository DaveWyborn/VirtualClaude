#!/bin/bash
set -euo pipefail

# Claude Workspace — VPS Setup Script
# Run as root on a fresh Ubuntu 24.04 server

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Must be root
[[ $EUID -ne 0 ]] && error "This script must be run as root."

echo ""
echo "======================================"
echo "  Claude Workspace — VPS Setup"
echo "======================================"
echo ""

# -------------------------------------------
# 1. System update + basics
# -------------------------------------------
info "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

info "Installing system dependencies..."
apt-get install -y -qq curl git build-essential nginx certbot python3-certbot-nginx ufw

# -------------------------------------------
# 2. Node.js 22 LTS
# -------------------------------------------
if command -v node &>/dev/null && node -v | grep -q "^v22"; then
    info "Node.js 22 already installed: $(node -v)"
else
    info "Installing Node.js 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
    info "Node.js installed: $(node -v)"
fi

# -------------------------------------------
# 3. Claude Code CLI
# -------------------------------------------
if command -v claude &>/dev/null; then
    info "Claude Code CLI already installed."
else
    info "Installing Claude Code CLI..."
    npm install -g @anthropic-ai/claude-code
fi

# -------------------------------------------
# 4. PM2
# -------------------------------------------
if command -v pm2 &>/dev/null; then
    info "PM2 already installed."
else
    info "Installing PM2..."
    npm install -g pm2
fi

# -------------------------------------------
# 5. Create writer user
# -------------------------------------------
if id "writer" &>/dev/null; then
    info "User 'writer' already exists."
else
    info "Creating user 'writer'..."
    adduser writer
    info "User 'writer' created."
fi

# -------------------------------------------
# 6. Projects directory
# -------------------------------------------
mkdir -p /home/writer/projects
chown writer:writer /home/writer/projects
info "Projects directory ready: /home/writer/projects"

# -------------------------------------------
# 7. Prompt for configuration
# -------------------------------------------
echo ""
echo "--------------------------------------"
echo "  Configuration"
echo "--------------------------------------"
echo ""

read -rp "Domain name (e.g. workspace.yourdomain.com): " DOMAIN_NAME
[[ -z "$DOMAIN_NAME" ]] && error "Domain name is required."

read -rp "API key for frontend auth (leave blank to generate one): " API_KEY
if [[ -z "$API_KEY" ]]; then
    API_KEY=$(openssl rand -hex 24)
    info "Generated API key: $API_KEY"
    echo ""
    warn "Save this key — you'll need it for the Vercel frontend env vars."
    echo ""
fi

read -rp "Vercel frontend URL (e.g. https://your-app.vercel.app): " FRONTEND_URL
[[ -z "$FRONTEND_URL" ]] && error "Frontend URL is required."

# -------------------------------------------
# 8. Set up server
# -------------------------------------------
SERVER_DIR="/opt/claude-workspace-server"

if [[ -d "$SERVER_DIR" ]]; then
    info "Server directory already exists at $SERVER_DIR"
else
    info "Setting up server..."
    mkdir -p "$SERVER_DIR"

    # Copy server files from this repo if available
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    REPO_SERVER_DIR="$(dirname "$SCRIPT_DIR")/server"

    if [[ -d "$REPO_SERVER_DIR" ]]; then
        cp -r "$REPO_SERVER_DIR/"* "$SERVER_DIR/"
        info "Copied server files from repo."
    else
        warn "No server directory found at $REPO_SERVER_DIR"
        warn "You'll need to copy the server files to $SERVER_DIR manually."
    fi
fi

if [[ -f "$SERVER_DIR/package.json" ]]; then
    info "Installing server dependencies..."
    cd "$SERVER_DIR"
    npm install --production
    cd -
fi

# -------------------------------------------
# 9. Create .env file
# -------------------------------------------
ENV_FILE="$SERVER_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
    warn ".env file already exists — skipping. Edit manually if needed: $ENV_FILE"
else
    cat > "$ENV_FILE" <<ENVEOF
PORT=3001
API_KEY=$API_KEY
PROJECTS_DIR=/home/writer/projects
CORS_ORIGIN=$FRONTEND_URL
ENVEOF
    info "Created .env at $ENV_FILE"
fi

# -------------------------------------------
# 10. Start with PM2
# -------------------------------------------
if [[ -f "$SERVER_DIR/package.json" ]]; then
    info "Starting server with PM2..."
    cd "$SERVER_DIR"
    pm2 delete claude-workspace 2>/dev/null || true
    pm2 start npm --name "claude-workspace" -- start
    pm2 save
    pm2 startup systemd -u root --hp /root 2>/dev/null || true
    cd -
    info "Server running on port 3001."
else
    warn "No package.json found — skipping PM2 start. Set up the server files first."
fi

# -------------------------------------------
# 11. Nginx reverse proxy
# -------------------------------------------
NGINX_CONF="/etc/nginx/sites-available/claude-workspace"

info "Configuring Nginx..."
cat > "$NGINX_CONF" <<'NGINXEOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    client_max_body_size 50M;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /terminal {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    location / {
        return 404;
    }
}
NGINXEOF

# Replace domain placeholder
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN_NAME/g" "$NGINX_CONF"

# Enable site
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/claude-workspace
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t && systemctl reload nginx
info "Nginx configured for $DOMAIN_NAME"

# -------------------------------------------
# 12. SSL with Certbot
# -------------------------------------------
echo ""
read -rp "Run certbot now for SSL? (y/n): " RUN_CERTBOT
if [[ "$RUN_CERTBOT" == "y" || "$RUN_CERTBOT" == "Y" ]]; then
    info "Running certbot..."
    certbot --nginx -d "$DOMAIN_NAME"
else
    warn "Skipping SSL. Run later: certbot --nginx -d $DOMAIN_NAME"
fi

# -------------------------------------------
# 13. Claude Code config for writer user
# -------------------------------------------
CLAUDE_DIR="/home/writer/.claude"
mkdir -p "$CLAUDE_DIR"

# Global CLAUDE.md
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/claude-global.md" ]]; then
    cp "$SCRIPT_DIR/claude-global.md" "$CLAUDE_DIR/CLAUDE.md"
    info "Installed global CLAUDE.md for writer user."
else
    warn "claude-global.md not found next to install script — skipping CLAUDE.md setup."
fi

# settings.json with Figma MCP placeholder
if [[ -f "$SCRIPT_DIR/figma-mcp-config.json" ]]; then
    cp "$SCRIPT_DIR/figma-mcp-config.json" "$CLAUDE_DIR/settings.json"
    info "Installed settings.json with Figma MCP placeholder."
else
    warn "figma-mcp-config.json not found — skipping settings.json setup."
fi

# Fix ownership
chown -R writer:writer "$CLAUDE_DIR"

# -------------------------------------------
# Firewall
# -------------------------------------------
info "Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
info "Firewall configured (SSH + Nginx)."

# -------------------------------------------
# Summary
# -------------------------------------------
echo ""
echo "======================================"
echo "  Setup Complete"
echo "======================================"
echo ""
echo "  Domain:       $DOMAIN_NAME"
echo "  API Key:      $API_KEY"
echo "  Frontend:     $FRONTEND_URL"
echo "  Server dir:   $SERVER_DIR"
echo "  Projects dir: /home/writer/projects"
echo ""
echo "  Next steps:"
echo "  1. Point your DNS A record for $DOMAIN_NAME to this server's IP"
if [[ "$RUN_CERTBOT" != "y" && "$RUN_CERTBOT" != "Y" ]]; then
echo "  2. Run: certbot --nginx -d $DOMAIN_NAME"
echo "  3. Set these env vars on Vercel:"
else
echo "  2. Set these env vars on Vercel:"
fi
echo "     NEXT_PUBLIC_API_URL = https://$DOMAIN_NAME"
echo "     NEXT_PUBLIC_API_KEY = $API_KEY"
echo ""
echo "  4. Edit /home/writer/.claude/settings.json to add your Figma API key"
echo "  5. Open your Vercel URL and start using Claude Workspace"
echo ""
