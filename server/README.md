# Trading Bot API - Python/FastAPI Server

This is a Python-based implementation of the Trading Bot API server using FastAPI, converted from the original Node.js/Express version.

## Features

- **FastAPI Framework**: Modern, fast, async Python web framework
- **WebSocket Support**: Real-time market data streaming
- **Angel One Integration**: Authentication and market data fetching
- **Marketaux News API**: Financial news integration
- **Session Management**: Secure server-side session handling
- **CORS Support**: Configured for React frontend
- **Async/Await**: Full async support for better performance

## Prerequisites

- Python 3.9 or higher
- pip (Python package manager)
- Angel One trading account with API credentials
- Marketaux API key (optional, for news features)

## Installation

1. **Create a virtual environment** (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

## Configuration

Edit the `.env` file with your settings:

```env
PORT=4000
DEVELOPMENT_MODE=development
CLIENT_ORIGIN=http://localhost:5173
SESSION_SECRET=your-secret-key-here
COOKIE_SECURE=false

# Angel One Credentials (optional)
CLIENT_ID=your_client_id
PIN=your_pin
TOTP_SECRET=your_totp_secret
API_KEY=your_api_key
API_SECRET=your_api_secret

# Marketaux API
MARKETAUX_API_KEY=your_marketaux_api_key
```

## Running the Server

### Development Mode

```bash
python app.py
```

Or using uvicorn directly:

```bash
uvicorn app:app --reload --port 4000
```

### Production Mode

```bash
uvicorn app:app --host 0.0.0.0 --port 4000 --workers 4
```

## API Endpoints

### Authentication
- `GET /api/auth/defaults` - Get default login credentials
- `POST /api/auth/login` - Login with Angel One credentials
- `POST /api/auth/logout` - Logout and clear session
- `GET /api/auth/session` - Get current session status

### Market Data
- `GET /api/market/nifty50` - Get Nifty 50 stock quotes

### News
- `GET /api/news` - Get market news (with query parameters)

### Health Check
- `GET /api/health` - Server health check

### WebSocket
- `WS /ws` - WebSocket endpoint for real-time market data

## Project Structure

```
server_py/
├── app.py                          # Main application entry point
├── config.py                       # Configuration and settings
├── requirements.txt                # Python dependencies
├── .env.example                    # Environment variables template
├── .gitignore                      # Git ignore rules
├── README.md                       # This file
├── data/
│   ├── __init__.py
│   └── nifty50.py                 # Nifty 50 stock list
├── middleware/
│   ├── __init__.py
│   └── require_auth.py            # Authentication middleware
├── routes/
│   ├── __init__.py
│   ├── auth_routes.py             # Authentication routes
│   ├── market_routes.py           # Market data routes
│   └── news_routes.py             # News routes
├── services/
│   ├── __init__.py
│   ├── angel_auth_service.py      # Angel One authentication
│   ├── instrument_master_service.py # Instrument data caching
│   ├── market_data_service.py     # Market data fetching
│   └── websocket_service.py       # WebSocket broadcasting
└── utils/
    ├── __init__.py
    ├── angel_headers.py           # Angel One API headers
    └── totp.py                    # TOTP code generation
```

## Key Differences from Node.js Version

1. **Async/Await**: Python's native async/await instead of Promises
2. **Type Hints**: Python type annotations for better code clarity
3. **Pydantic**: Data validation using Pydantic models
4. **FastAPI**: Modern Python web framework with automatic API docs
5. **httpx**: Async HTTP client instead of axios
6. **pyotp**: TOTP generation instead of otplib

## API Documentation

When the server is running, visit:
- Swagger UI: `http://localhost:4000/docs`
- ReDoc: `http://localhost:4000/redoc`

## Development

### Adding New Routes

1. Create a new route file in `routes/`
2. Define your router using `APIRouter()`
3. Import and include in `app.py`

### Adding New Services

1. Create a new service file in `services/`
2. Implement your service class
3. Import and use in routes

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process on port 4000
lsof -ti:4000 | xargs kill -9
```

### Module Import Errors
Make sure you're in the virtual environment and all dependencies are installed:
```bash
pip install -r requirements.txt
```

### WebSocket Connection Issues
- Check CORS settings in `app.py`
- Verify client origin in `.env`
- Ensure session middleware is properly configured

## License

Same as the original project.

## Credits

Converted from Node.js/Express to Python/FastAPI while maintaining full feature parity.