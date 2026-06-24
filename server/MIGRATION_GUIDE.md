# Migration Guide: Node.js to Python

This document explains how to migrate from the Node.js server to the Python server.

## Quick Start

### 1. Install Python Dependencies

```bash
cd server_py
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Copy Environment Variables

```bash
# Copy your existing .env from Node.js server
cp ../server/.env .env
# Or create from template
cp .env.example .env
```

The Python server uses the same environment variables as the Node.js version, so your existing `.env` file should work without changes.

### 3. Stop Node.js Server and Start Python Server

```bash
# Stop Node.js server (if running)
# Then start Python server
python app.py
```

The Python server will run on the same port (4000) as the Node.js version.

## Feature Parity

The Python server has **100% feature parity** with the Node.js version:

| Feature | Node.js | Python | Status |
|---------|---------|--------|--------|
| Authentication (Login/Logout) | ✅ | ✅ | Complete |
| Session Management | ✅ | ✅ | Complete |
| Angel One Integration | ✅ | ✅ | Complete |
| Market Data (Nifty 50) | ✅ | ✅ | Complete |
| WebSocket Real-time Updates | ✅ | ✅ | Complete |
| News API (Marketaux) | ✅ | ✅ | Complete |
| CORS Configuration | ✅ | ✅ | Complete |
| Token Refresh | ✅ | ✅ | Complete |
| Instrument Master Caching | ✅ | ✅ | Complete |
| Quote Caching | ✅ | ✅ | Complete |

## API Compatibility

All API endpoints remain **exactly the same**:

- `GET /api/health`
- `GET /api/auth/defaults`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/market/nifty50`
- `GET /api/news`
- `WS /ws`

**No changes required in the React frontend!**

## Key Technical Differences

### 1. Framework
- **Node.js**: Express.js
- **Python**: FastAPI

### 2. Async Handling
- **Node.js**: Promises with async/await
- **Python**: Native async/await with asyncio

### 3. HTTP Client
- **Node.js**: axios
- **Python**: httpx (async-compatible)

### 4. Session Management
- **Node.js**: express-session
- **Python**: Starlette SessionMiddleware

### 5. WebSocket
- **Node.js**: ws library
- **Python**: FastAPI's built-in WebSocket support

### 6. TOTP Generation
- **Node.js**: otplib
- **Python**: pyotp

### 7. Environment Variables
- **Node.js**: dotenv
- **Python**: python-dotenv + pydantic-settings

## Performance Considerations

### Advantages of Python Version

1. **Type Safety**: Full type hints with Pydantic validation
2. **Auto Documentation**: Built-in Swagger UI and ReDoc
3. **Modern Async**: Native async/await support
4. **Better Error Handling**: FastAPI's exception handling
5. **Data Validation**: Automatic request/response validation

### Performance Comparison

Both servers perform similarly for this use case:
- **Node.js**: Event loop, non-blocking I/O
- **Python**: ASGI with uvicorn, async I/O

For typical trading bot workloads (API calls, WebSocket), performance is comparable.

## Testing the Migration

### 1. Test Authentication

```bash
# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "YOUR_CLIENT_ID",
    "pin": "YOUR_PIN",
    "totpSecret": "YOUR_TOTP_SECRET",
    "apiKey": "YOUR_API_KEY"
  }'
```

### 2. Test Market Data

```bash
# Get Nifty 50 quotes (requires authentication)
curl http://localhost:4000/api/market/nifty50 \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

### 3. Test WebSocket

Open your React frontend and verify:
- WebSocket connection establishes
- Real-time market data updates every 3 seconds
- Connection status indicator works

### 4. Test News API

```bash
# Get news (requires authentication)
curl "http://localhost:4000/api/news?countries=in&limit=10" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

## Troubleshooting

### Issue: Module Import Errors

**Solution**: Ensure virtual environment is activated and dependencies installed
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### Issue: Port Already in Use

**Solution**: Kill existing process on port 4000
```bash
lsof -ti:4000 | xargs kill -9
```

### Issue: Session Not Persisting

**Solution**: Check SESSION_SECRET in .env file
```bash
# Make sure SESSION_SECRET is set
echo $SESSION_SECRET
```

### Issue: CORS Errors

**Solution**: Verify CLIENT_ORIGIN in .env
```bash
# Should match your React dev server
CLIENT_ORIGIN=http://localhost:5173
```

### Issue: WebSocket Connection Fails

**Solution**: Check that:
1. Server is running on correct port
2. CORS is properly configured
3. Session middleware is working
4. Client is sending session cookie

## Rollback Plan

If you need to rollback to Node.js:

```bash
# Stop Python server
# Ctrl+C or kill the process

# Start Node.js server
cd ../server
npm run dev
```

No changes needed in the React frontend - it will work with either server.

## Production Deployment

### Using Gunicorn + Uvicorn Workers

```bash
pip install gunicorn
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:4000
```

### Using Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "4000"]
```

### Environment Variables for Production

```env
DEVELOPMENT_MODE=production
COOKIE_SECURE=true
SESSION_SECRET=<strong-random-secret>
```

## Benefits of Migration

1. ✅ **Type Safety**: Catch errors at development time
2. ✅ **Auto Documentation**: Swagger UI at `/docs`
3. ✅ **Modern Python**: Latest async features
4. ✅ **Better Validation**: Pydantic models
5. ✅ **Easier Testing**: FastAPI's TestClient
6. ✅ **Same Performance**: Comparable to Node.js
7. ✅ **No Frontend Changes**: Drop-in replacement

## Support

If you encounter issues:
1. Check the logs for error messages
2. Verify environment variables
3. Ensure all dependencies are installed
4. Compare with Node.js server behavior
5. Check FastAPI documentation: https://fastapi.tiangolo.com/

## Next Steps

After successful migration:
1. ✅ Test all features thoroughly
2. ✅ Monitor performance
3. ✅ Update deployment scripts
4. ✅ Train team on Python/FastAPI
5. ✅ Consider removing Node.js server once stable