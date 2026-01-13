# OSUCSC FastAPI Backend

FastAPI backend implementation based on CodeIgniter 3 application.

## Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── .env.example           # Environment variables template
├── README.md              # This file
│
├── config/                # Configuration files
│   ├── __init__.py
│   └── settings.py        # Application settings
│
├── database/              # Database connection
│   ├── __init__.py
│   └── connection.py      # Database connection and session
│
├── models/                # SQLAlchemy models
│   ├── __init__.py
│   ├── user.py            # User model
│   ├── role.py            # Role model
│   └── business_settings.py  # Business settings model
│
├── schemas/               # Pydantic schemas for validation
│   ├── __init__.py
│   └── auth.py            # Authentication schemas
│
├── helpers/               # Helper functions
│   ├── __init__.py
│   ├── auth_helper.py     # Authentication helpers
│   ├── db_helper.py       # Database helpers
│   └── security_helper.py # Security helpers
│
└── controllers/           # API controllers (routes)
    ├── __init__.py
    └── auth_controller.py # Authentication controller
```

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Update the `.env` file with your database credentials and settings.

4. Run the application:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### Authentication

- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `POST /api/verify` - Two-way verification (pending implementation)
- `GET /api/me` - Get current user information

## Folder Structure Explanation

### config/
Contains all configuration-related files:
- `settings.py` - Application settings, database config, JWT config

### database/
Database connection and session management:
- `connection.py` - SQLAlchemy engine, session factory, get_db dependency

### models/
SQLAlchemy ORM models (database tables):
- `user.py` - User model (PORTAL_ADMIN table)
- `role.py` - Role model (PORTAL_ROLES table)
- `business_settings.py` - Business settings model

### schemas/
Pydantic schemas for request/response validation:
- `auth.py` - Authentication-related schemas

### helpers/
Utility functions and helpers:
- `auth_helper.py` - Password hashing, JWT tokens, password validation
- `db_helper.py` - Database query helpers, settings retrieval
- `security_helper.py` - Security utilities, current user dependency

### controllers/
API route handlers (FastAPI routers):
- `auth_controller.py` - Authentication endpoints (login, logout, verify)

## Database

The application uses MSSQL (SQL Server) and connects using the credentials specified in `.env`.

## Key Features

- JWT-based authentication
- Password hashing using SHA256 (matching CodeIgniter)
- Role-based access control
- User permissions (college_perm, hs_perm, ocr_perm)
- Two-way verification support (structure in place)
- Organized folder structure similar to CodeIgniter

## Development

### Adding New Controllers

1. Create a new file in `controllers/` (e.g., `users_controller.py`)
2. Define your router and endpoints
3. Import and include in `main.py`:
   ```python
   from controllers import users_controller
   app.include_router(users_controller.router)
   ```

### Adding New Models

1. Create a new file in `models/` (e.g., `transcript.py`)
2. Define your SQLAlchemy model
3. Import in `models/__init__.py`

### Adding New Helpers

1. Create a new file in `helpers/` (e.g., `email_helper.py`)
2. Define your helper functions
3. Import in `helpers/__init__.py` if needed

## Notes

- Password hashing uses SHA256 to match CodeIgniter implementation
- Two-way verification endpoint is a placeholder; implement email service integration
- CORS is enabled for all origins; restrict in production
- Database connection string configured for MSSQL with TrustServerCertificate
