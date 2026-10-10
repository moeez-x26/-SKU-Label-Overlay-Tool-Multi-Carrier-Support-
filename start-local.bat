@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.22 or newer from https://nodejs.org/ then run this launcher again.
  pause
  exit /b 1
)
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]%%2!==0 || v[0]<22 || (v[0]===22 && v[1]<22) ? 1 : 0)"
if errorlevel 1 (
  echo Please install Node.js 22.22 or a newer even-numbered LTS release.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies. Internet is needed for this first setup.
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
echo Opening SKU Label Studio in your browser. Keep this window open.
echo Press Ctrl+C here to stop the app.
call npm start
if errorlevel 1 pause
