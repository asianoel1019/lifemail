#!/bin/bash
# LifeMail Quick Start Script (Self-Signed SSL & Init)

echo "🚀 Initializing LifeMail Infrastructure..."

# Ensure we are in the project root
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please run this from the project root."
    exit 1
fi

# Create directories if missing
mkdir -p config/dms/mail-config config/dms/mail-data config/dms/mail-state config/dms/certs backend frontend
chmod -R 755 config/dms

# Initialize accounts file with a seed account only if it doesn't exist
ACCOUNTS_PATH="config/dms/mail-config/postfix-accounts.cf"
if [ ! -f "$ACCOUNTS_PATH" ]; then
    echo "🆕 Initializing accounts file with seed account..."
    SEED_ACCOUNT="admin@asianoel.space|{PLAIN}admin123"
    echo "$SEED_ACCOUNT" > "$ACCOUNTS_PATH"
    sed -i 's/\r$//' "$ACCOUNTS_PATH"
    chmod 644 "$ACCOUNTS_PATH"
else
    echo "✅ Existing accounts file found, skipping initialization."
fi

echo "✅ Folders and permissions verified."

echo "🔒 Generating Self-Signed SSL Certificates (Internal use)..."
# This is a placeholder as DMS image handles 'self-signed' automatically 
# if SSL_TYPE=self-signed is set in compose.

echo "✅ Initialization complete!"
echo "👉 Run 'docker-compose up -d' to start the server."
echo "👉 Admin Panel: http://localhost:3000 (Go to Management > Accounts)"
echo "👉 Webmail: http://localhost:3000"
echo ""
echo "💡 First Step: Login to Admin (admin/admin123) and create your first user account!"
