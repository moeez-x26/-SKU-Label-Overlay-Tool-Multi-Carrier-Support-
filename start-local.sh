#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 22.22 or a newer LTS release from https://nodejs.org/ first.'
  exit 1
fi
node -e "const v=process.versions.node.split('.').map(Number);if(v[0]<22 || (v[0]===22 && v[1]<22)){console.error('Node.js 22.22 or newer is required.');process.exit(1)}"
if [[ ! -d node_modules ]]; then npm ci --no-audit --no-fund; fi
printf '%s\n' 'Opening SKU Label Studio. Keep this terminal open; Ctrl+C stops the app.'
npm start
