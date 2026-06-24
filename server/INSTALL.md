# Python Server Installation Guide

## Prerequisites

Make sure you have Python 3.9+ installed:

```bash
python3 --version
```

If not installed, install Python 3:
- **macOS**: `brew install python3` or download from python.org
- **Linux**: `sudo apt install python3 python3-pip python3-venv`
- **Windows**: Download from python.org

## Installation Steps

### Step 1: Navigate to Python server directory

```bash
cd server_py
```

### Step 2: Create virtual environment

```bash
python3 -m venv venv
```

### Step 3: Activate virtual environment

**macOS/Linux:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

You should see `(venv)` in your terminal prompt.

### Step 4: Upgrade pip (inside virtual environment)

```bash
pip install --upgrade pip
```

### Step 5: Install dependencies

```bash
pip install -r requirements.txt
```

If you encounter build errors with `pydantic-core`, try:

```bash
# Install build tools first
pip install --upgrade setuptools wheel

# Then install requirements
pip install -r requirements.txt
```

### Step 6: Copy environment file

```bash
cp .env.example .env
```

Or copy from Node.js server:
```bash
cp ../server/.env .env
```

Edit `.env` with your Angel One credentials.

### Step 7: Run the server

```bash
python3 app.py
```

Or use uvicorn directly:
```bash
uvicorn app:app --reload --port 4000
```

## Troubleshooting

### Issue: `pydantic-core` build fails (Rust compilation error)

This happens with Python 3.14 or when Rust is not installed.

**Solution 1**: Use older Python version (Recommended)
```bash
# Remove existing venv
rm -rf venv

# Use Python 3.11 or 3.12 (more stable)
python3.11 -m venv venv  # or python3.12
source venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

**Solution 2**: Install Rust (if you want to use Python 3.14)
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Then retry installation
pip install -r requirements.txt
```

**Solution 3**: Use pre-built wheels (Already done in requirements.txt)
The requirements.txt now uses older, stable versions:
- `pydantic==2.4.2` (instead of 2.5.3)
- `pydantic-settings==2.0.3` (instead of 2.1.0)
- `fastapi==0.104.1` (instead of 0.109.0)

These versions have pre-built wheels for most Python versions.

### Issue: `python3` not found

**macOS**: Install via Homebrew
```bash
brew install python3
```

**Linux**: Install via package manager
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

### Issue: `pip` not found after activating venv

Make sure virtual environment is activated:
```bash
source venv/bin/activate  # You should see (venv) in prompt
which pip  # Should show path inside venv
```

### Issue: Permission denied on startup script

```bash
chmod +x start.sh
./start.sh
```

## Verification

After installation, verify everything works:

```bash
# Check Python version
python3 --version

# Check pip version (inside venv)
pip --version

# Check installed packages
pip list

# Test server
python3 app.py
```

Visit `http://localhost:4000/docs` to see the API documentation.

## Alternative: Using Docker (Recommended for Production)

Create `Dockerfile` in `server_py/`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 4000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "4000"]
```

Build and run:
```bash
docker build -t trading-bot-py .
docker run -p 4000:4000 --env-file .env trading-bot-py
```

## Next Steps

Once installed:
1. Start the Python server: `python3 app.py`
2. Start the React client: `cd ../client && npm run dev`
3. Open `http://localhost:5173` in your browser
4. Login with your Angel One credentials

## Support

If you continue to have issues:
1. Check Python version: `python3 --version` (should be 3.9+)
2. Check if venv is activated: `which python` (should show venv path)
3. Try installing packages one by one to identify the problematic one
4. Consider using Docker for a cleaner installation