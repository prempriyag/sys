# Backend Folder Structure

This document explains the folder structure of the FastAPI backend application.

## Folder Organization

```
backend/
│
├── main.py                    # Application entry point
├── requirements.txt           # Python dependencies
├── .env.example              # Environment variables template
├── README.md                 # Documentation
│
├── config/                   # Configuration files
│   ├── __init__.py          # Package initialization
│   └── settings.py          # Application settings (DB, JWT, etc.)
│
├── database/                 # Database connection and setup
│   ├── __init__.py          # Package initialization
│   └── connection.py        # SQLAlchemy engine, session factory
│
├── models/                   # SQLAlchemy ORM models
│   ├── __init__.py          # Package initialization
│   ├── user.py              # User model (PORTAL_ADMIN table)
│   ├── role.py              # Role model (PORTAL_ROLES table)
│   └── business_settings.py # Business settings model
│
├── schemas/                  # Pydantic schemas (request/response validation)
│   ├── __init__.py          # Package initialization
│   └── auth.py              # Authentication schemas
│
├── helpers/                  # Helper functions and utilities
│   ├── __init__.py          # Package initialization
│   ├── auth_helper.py       # Authentication helpers (password hashing, JWT)
│   ├── db_helper.py         # Database helpers (queries, settings)
│   └── security_helper.py   # Security utilities (current user, OAuth2)
│
└── controllers/              # API controllers (FastAPI routers)
    ├── __init__.py          # Package initialization
    └── auth_controller.py   # Authentication endpoints
```

## Folder Descriptions

### config/
Contains all configuration-related files:
- **settings.py**: Application settings loaded from environment variables
  - Database configuration (host, name, user, password)
  - JWT configuration (secret key, algorithm, expiration)
  - Application settings (environment, debug mode)

### database/
Database connection and session management:
- **connection.py**: 
  - SQLAlchemy engine creation
  - Session factory setup
  - Base class for models
  - `get_db()` dependency for FastAPI

### models/
SQLAlchemy ORM models representing database tables:
- **user.py**: User model (corresponds to PORTAL_ADMIN table)
- **role.py**: Role model (corresponds to PORTAL_ROLES table)
- **business_settings.py**: Business settings model (corresponds to BUSINESS_SETTINGS table)

### schemas/
Pydantic schemas for request/response validation:
- **auth.py**: 
  - `LoginRequest`: Login endpoint request schema
  - `LoginResponse`: Login endpoint response schema
  - `VerifyCodeRequest`: Two-way verification request schema
  - `UserResponse`: User information response schema
  - `MessageResponse`: Generic message response schema

### helpers/
Utility functions organized by category:
- **auth_helper.py**:
  - `hash_password()`: Hash password using SHA256
  - `verify_password()`: Verify password against hash
  - `create_access_token()`: Create JWT access token
  - `verify_token()`: Verify and decode JWT token
  - `password_form_validation()`: Validate password format

- **db_helper.py**:
  - `get_setting()`: Get setting value from BUSINESS_SETTINGS table
  - `get_user_by_email()`: Get user by email (case-insensitive)
  - `update_last_login()`: Update user's last login timestamp
  - `roletype()`: Get role name or key based on role_id

- **security_helper.py**:
  - `get_current_user()`: FastAPI dependency to get current authenticated user

### controllers/
API route handlers (FastAPI routers):
- **auth_controller.py**:
  - `POST /api/login`: User login endpoint
  - `POST /api/logout`: User logout endpoint
  - `POST /api/verify`: Two-way verification endpoint
  - `GET /api/me`: Get current user information

## Import Patterns

### Within the same folder:
```python
from database.connection import Base, get_db
from config.settings import settings
```

### Between folders:
```python
# In controllers/auth_controller.py
from models import User
from helpers.auth_helper import hash_password
from schemas.auth import LoginRequest
from database.connection import get_db
```

### Package-level imports:
```python
# Using __init__.py exports
from models import User, Role, BusinessSettings
from helpers import hash_password, get_setting
from schemas import LoginRequest, LoginResponse
```

## Adding New Features

### Adding a New Controller:
1. Create file in `controllers/` (e.g., `users_controller.py`)
2. Define router and endpoints
3. Import in `main.py`:
   ```python
   from controllers import users_controller
   app.include_router(users_controller.router)
   ```

### Adding a New Model:
1. Create file in `models/` (e.g., `transcript.py`)
2. Define SQLAlchemy model inheriting from `Base`
3. Import in `models/__init__.py`:
   ```python
   from models.transcript import Transcript
   __all__ = [..., "Transcript"]
   ```

### Adding a New Helper:
1. Create file in `helpers/` (e.g., `email_helper.py`)
2. Define helper functions
3. Optionally export in `helpers/__init__.py`

### Adding a New Schema:
1. Create file in `schemas/` (e.g., `user_schemas.py`)
2. Define Pydantic models
3. Import in `schemas/__init__.py`

## Benefits of This Structure

1. **Separation of Concerns**: Each folder has a specific purpose
2. **Scalability**: Easy to add new features without cluttering
3. **Maintainability**: Clear organization makes code easy to find and modify
4. **Similarity to CodeIgniter**: Structure mirrors the original PHP application
5. **Python Best Practices**: Proper package structure with `__init__.py` files

