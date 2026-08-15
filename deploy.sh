#!/bin/bash

# Deployment script for Armour Care
# Deploys to VPS at root@172.237.111.103

set -e

VPS_HOST="root@172.237.111.103"
REMOTE_DIR="/opt/armourcare"
LOCAL_DIR="$(dirname "$0")"

echo "🚀 Deploying Armour Care to VPS..."

# Step 0: Backup local data files and pull server copies before deploy
BACKUP_DIR="$LOCAL_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"
for DATA_FILE in questions.json users.json admins.json; do
  if [ -f "$LOCAL_DIR/$DATA_FILE" ]; then
    cp "$LOCAL_DIR/$DATA_FILE" "$BACKUP_DIR/${DATA_FILE%.json}_${TIMESTAMP}.json"
    echo "💾 Backed up local $DATA_FILE → backups/${DATA_FILE%.json}_${TIMESTAMP}.json"
  fi
done

# Files to deploy (excluding local data files, venv, and git)
FILES=(
  "server.js"
  "index.html"
  "styles.css"
  "app.js"
  "admin.html"
  "admin.css"
  "admin.js"
  "manifest.json"
  "logo.png"
  "start.sh"
  "sw.js"
  "package.json"
  "apple-touch-icon.png"
  "robots.txt"
)

# Step 1: Create remote directory and install Node.js if needed
echo "📦 Setting up remote server..."
ssh $VPS_HOST << 'ENDSSH'
# Create app directory
mkdir -p /opt/armourcare

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "Node.js version: $(node -v)"
ENDSSH

# Step 2: Copy application files
echo "📁 Copying application files..."
for file in "${FILES[@]}"; do
  if [ -f "$LOCAL_DIR/$file" ]; then
    scp "$LOCAL_DIR/$file" "$VPS_HOST:$REMOTE_DIR/"
    echo "  ✓ $file"
  fi
done

# Copy icons directory
echo "📁 Copying icons..."
ssh $VPS_HOST "mkdir -p $REMOTE_DIR/icons"
scp "$LOCAL_DIR/icons/"*.png "$VPS_HOST:$REMOTE_DIR/icons/"
echo "  ✓ icons/"

# Step 3: Initialize data files if they don't exist on remote
echo "📝 Initializing data files..."
ssh $VPS_HOST << 'ENDSSH'
cd /opt/armourcare

# Create empty data files if they don't exist
if [ ! -f users.json ]; then
  echo '{}' > users.json
  echo "  ✓ Created users.json"
fi

if [ ! -f admins.json ]; then
  echo '{}' > admins.json
  echo "  ✓ Created admins.json"
fi

if [ ! -f submissions.json ]; then
  echo '{}' > submissions.json
  echo "  ✓ Created submissions.json"
fi

if [ ! -f notifications.json ]; then
  echo '[]' > notifications.json
  echo "  ✓ Created notifications.json"
fi

if [ ! -f push-subscriptions.json ]; then
  echo '{}' > push-subscriptions.json
  echo "  ✓ Created push-subscriptions.json"
fi

if [ ! -f auto-notif-config.json ]; then
  echo '{}' > auto-notif-config.json
  echo "  ✓ Created auto-notif-config.json"
fi

# Install npm dependencies
echo "Installing dependencies..."
npm install --production

chmod +x start.sh
ENDSSH

# Step 4: Create systemd service for auto-start
echo "⚙️  Setting up systemd service..."
ssh $VPS_HOST << 'ENDSSH'
cat > /etc/systemd/system/armourcare.service << 'EOF'
[Unit]
Description=Armour Care Wellbeing App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/armourcare
ExecStart=/usr/bin/node /opt/armourcare/server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8000

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable armourcare
ENDSSH

# Step 5: Restart the service
echo "🔄 Restarting service..."
ssh $VPS_HOST << 'ENDSSH'
systemctl restart armourcare
sleep 2
systemctl status armourcare --no-pager || true
ENDSSH

# Step 6: Pull server data files as the source of truth
echo "📥 Pulling data files from server (source of truth)..."
for DATA_FILE in questions.json users.json admins.json; do
  scp "$VPS_HOST:$REMOTE_DIR/$DATA_FILE" "$LOCAL_DIR/$DATA_FILE"
  echo "  ✓ $DATA_FILE synced from server"
done

echo ""
echo "✅ Deployment complete!"
echo ""

# Generate QR code for the app URL
APP_URL="https://armourcare.uk"
ADMIN_URL="https://armourcare.uk/admin.html"

# Check if qrencode is available, if not use project venv
generate_qr() {
  local url="$1"
  local venv_dir="$LOCAL_DIR/venv"
  
  if command -v qrencode &> /dev/null; then
    qrencode -t ANSIUTF8 "$url"
  elif [ -d "$venv_dir" ]; then
    # Use project venv
    "$venv_dir/bin/pip" install qrcode -q 2>/dev/null || true
    "$venv_dir/bin/python" << PYEOF
import qrcode
qr = qrcode.QRCode(border=1)
qr.add_data("$url")
qr.make()
qr.print_ascii(invert=True)
PYEOF
  elif command -v python3 &> /dev/null; then
    # Create a temp venv for QR generation
    python3 -m venv /tmp/qr_venv 2>/dev/null
    /tmp/qr_venv/bin/pip install qrcode -q 2>/dev/null
    /tmp/qr_venv/bin/python << PYEOF
import qrcode
qr = qrcode.QRCode(border=1)
qr.add_data("$url")
qr.make()
qr.print_ascii(invert=True)
PYEOF
  else
    echo "(QR code generation not available - install qrencode or python3)"
  fi
}

echo "═══════════════════════════════════════════════════════════"
echo "                    ARMOUR CARE APP"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Scan this QR code with your phone:"
echo ""
generate_qr "$APP_URL"
echo ""
echo "  URL: $APP_URL"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "                   ADMIN PORTAL"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Scan this QR code for admin access:"
echo ""
generate_qr "$ADMIN_URL"
echo ""
echo "  URL: $ADMIN_URL"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Useful commands:"
echo "  ssh $VPS_HOST 'systemctl status armourcare'  - Check status"
echo "  ssh $VPS_HOST 'systemctl restart armourcare' - Restart app"
echo "  ssh $VPS_HOST 'journalctl -u armourcare -f'  - View logs"
