#!/bin/bash
# Start the ArmourCare server with authentication

# Get local IP address
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
PORT=8000
APP_URL="http://${LOCAL_IP}:${PORT}"
ADMIN_URL="http://${LOCAL_IP}:${PORT}/admin.html"

generate_qr() {
  local url="$1"
  python3 -c "
url = '${url}'
try:
    import qrcode
    qr = qrcode.QRCode(border=1)
    qr.add_data(url)
    qr.make()
    qr.print_ascii(invert=True)
except ImportError:
    try:
        import segno
        qr = segno.make(url)
        qr.terminal(compact=True)
    except ImportError:
        print('  (install qrcode for QR: pip3 install qrcode)')
"
}

echo ""
echo "=== App QR Code ==="
echo "  ${APP_URL}"
echo ""
generate_qr "$APP_URL"

echo ""
echo "=== Admin Portal QR Code ==="
echo "  ${ADMIN_URL}"
echo ""
generate_qr "$ADMIN_URL"

echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Run the Node.js server
node server.js
