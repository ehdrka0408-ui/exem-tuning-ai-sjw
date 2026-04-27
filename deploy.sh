#!/bin/bash
# Deploy v2 (workbench-c) to 10.10.45.185:3006
# SSH: openclaw/oracle → su root/oracle

set -e

echo "=== Building v2 project ==="
npm run build

echo "=== Deploying to 10.10.45.185:3006 ==="

REMOTE_USER="openclaw"
REMOTE_HOST="10.10.45.185"
REMOTE_PORT="22"
DEPLOY_DIR="/opt/exem_tuning_ai_v2"
TMP_DIR="/tmp/exem_tuning_ai_v2_dist"

# Upload dist files via scp
sshpass -p 'oracle' ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "
  echo 'oracle' | su -c '
    mkdir -p $DEPLOY_DIR
    which serve >/dev/null 2>&1 || npm install -g serve
  ' root
"

# Copy built files
sshpass -p 'oracle' scp -o StrictHostKeyChecking=no -P $REMOTE_PORT -r dist/* $REMOTE_USER@$REMOTE_HOST:$TMP_DIR/

# Move to deploy dir and start server
sshpass -p 'oracle' ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "
  echo 'oracle' | su -c '
    mkdir -p $DEPLOY_DIR
    rm -rf $DEPLOY_DIR/*
    cp -r $TMP_DIR/* $DEPLOY_DIR/
    rm -rf $TMP_DIR

    # Open firewall port if not already open
    firewall-cmd --query-port=3006/tcp >/dev/null 2>&1 || {
      firewall-cmd --add-port=3006/tcp --permanent
      firewall-cmd --reload
    }

    # Kill existing serve process on port 3006
    fuser -k 3006/tcp 2>/dev/null || true

    # Start serve in background (bind 0.0.0.0 explicitly)
    cd $DEPLOY_DIR
    nohup serve -s . -l tcp://0.0.0.0:3006 > /var/log/exem_tuning_ai_v2.log 2>&1 &

    echo \"Deployed! Running on http://10.10.45.185:3006\"
  ' root
"

echo "=== Deploy complete ==="
echo "Access: http://10.10.45.185:3006"
