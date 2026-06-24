# Python 3.14 Compatibility Issue

## ⚠️ Problem

Python 3.14 is very new (released 2026) and has compatibility issues with:
- Pydantic v1 (type inference errors)
- FastAPI 0.95.x (depends on Pydantic)
- Many other packages don't have pre-built wheels yet

## ✅ Solution: Use Python 3.11 or 3.12

### Recommended: Install Python 3.12

```bash
# Install Python 3.12 via Homebrew
brew install python@3.12

# Verify installation
python3.12 --version
```

### Create Virtual Environment with Python 3.12

```bash
cd server_py

# Remove old venv
rm -rf venv

# Create venv with Python 3.12
python3.12 -m venv venv

# Activate
source venv/bin/activate

# Verify you're using Python 3.12
python --version  # Should show Python 3.12.x

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Copy environment file
cp ../server/.env .env

# Run server
python app.py
```

## Alternative: Use Python 3.11

```bash
# Install Python 3.11
brew install python@3.11

# Create venv with Python 3.11
cd server_py
rm -rf venv
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

## Why Not Python 3.14?

1. **Too New** - Released in 2026, most packages aren't ready
2. **Pydantic Issues** - Type inference breaks with Python 3.14
3. **No Pre-built Wheels** - Many packages need compilation
4. **FastAPI Incompatibility** - Not tested with Python 3.14

## Recommended Python Versions

| Version | Status | Recommendation |
|---------|--------|----------------|
| 3.9 | ✅ Stable | Good |
| 3.10 | ✅ Stable | Good |
| 3.11 | ✅ Stable | **Recommended** |
| 3.12 | ✅ Stable | **Recommended** |
| 3.13 | ⚠️ New | Use with caution |
| 3.14 | ❌ Too New | **Not Recommended** |

## Quick Fix

```bash
# Install Python 3.12
brew install python@3.12

# Reinstall everything with Python 3.12
cd server_py
rm -rf venv
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

## Verification

After installation, verify:

```bash
# Check Python version (should be 3.11 or 3.12)
python --version

# Check packages installed
pip list

# Test import
python -c "import fastapi, uvicorn, httpx, pyotp; print('All packages OK')"

# Run server
python app.py
```

Expected output:
```
Trading bot API listening on http://localhost:4000
WebSocket server available at ws://localhost:4000/ws
```

## Summary

**Don't use Python 3.14 for this project.**

Use Python 3.11 or 3.12 instead:
```bash
brew install python@3.12
cd server_py
rm -rf venv
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

This will work perfectly! 🚀