# Database Configuration Guide

## Where to Configure Database Details

Database configuration is stored in environment variables, loaded from a `.env` file in the `backend/` directory.

## Configuration Files

### 1. `.env` File (Main Configuration)
**Location:** `backend/.env`

This file contains your actual database credentials. **DO NOT commit this file to version control.**

Create this file by copying `.env.example` and updating with your actual credentials:

```bash
cp .env.example .env
```

### 2. `.env.example` File (Template)
**Location:** `backend/.env.example`

This is a template file showing what environment variables are needed. This file can be committed to version control.

### 3. Configuration Code
**Location:** `backend/config/settings.py`

This file defines the Settings class that loads environment variables from `.env`.

**Location:** `backend/database/connection.py`

This file uses the settings to create the database connection string.

## Database Configuration Variables

### Required Variables

```env
# Database Host (SQL Server instance)
DB_HOST=172.16.2.34\SQL2014

# Database Name
DB_NAME=OSUCSCDEV

# Database Username
DB_USER=DIGISCRIPT_KTECH_DEV

# Database Password
DB_PASSWORD=xNFk@q5;p/!U

# ODBC Driver Name
DB_DRIVER=ODBC Driver 17 for SQL Server
```

### Optional Variables

```env
# JWT Secret Key (for authentication tokens)
SECRET_KEY=your-secret-key-here

# JWT Algorithm
ALGORITHM=HS256

# Token expiration time in minutes
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application Environment
ENVIRONMENT=DEV

# Debug mode
DEBUG=True
```

## Connection String Format

The connection string is automatically built as:

```
mssql+pyodbc://DB_USER:DB_PASSWORD@DB_HOST/DB_NAME?driver=DB_DRIVER&TrustServerCertificate=yes
```

Example:
```
mssql+pyodbc://DIGISCRIPT_KTECH_DEV:xNFk@q5;p/!U@172.16.2.34\SQL2014/OSUCSCDEV?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes
```

## ODBC Driver Options

Common ODBC driver names for SQL Server:
- `ODBC Driver 17 for SQL Server` (Recommended - latest)
- `ODBC Driver 13 for SQL Server`
- `ODBC Driver 11 for SQL Server`
- `SQL Server Native Client 11.0`
- `SQL Server`

To check available drivers on Windows:
```cmd
odbcinst -q -d
```

## Setup Steps

1. **Create `.env` file:**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Edit `.env` file with your database credentials:**
   ```env
   DB_HOST=your-server\instance
   DB_NAME=your-database-name
   DB_USER=your-username
   DB_PASSWORD=your-password
   DB_DRIVER=ODBC Driver 17 for SQL Server
   ```

3. **Generate a secure JWT secret key:**
   ```python
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
   Copy the output and paste it as `SECRET_KEY` in `.env`.

4. **Verify configuration:**
   The application will automatically load these variables when it starts.

## Environment-Specific Configuration

### Development
```env
ENVIRONMENT=DEV
DEBUG=True
```

### Production
```env
ENVIRONMENT=PROD
DEBUG=False
```

## Security Notes

1. **Never commit `.env` to version control** - it contains sensitive credentials
2. The `.env` file is already in `.gitignore`
3. Use strong, unique passwords for production
4. Generate a secure, random `SECRET_KEY` for production
5. Consider using environment variables directly in production (instead of `.env` file)

## Troubleshooting

### Connection Issues

1. **Check ODBC driver is installed:**
   - Windows: Go to ODBC Data Source Administrator
   - Verify the driver name matches exactly

2. **Test connection manually:**
   ```python
   import pyodbc
   conn = pyodbc.connect(
       f"DRIVER={{{settings.DB_DRIVER}}};"
       f"SERVER={settings.DB_HOST};"
       f"DATABASE={settings.DB_NAME};"
       f"UID={settings.DB_USER};"
       f"PWD={settings.DB_PASSWORD};"
       "TrustServerCertificate=yes;"
   )
   ```

3. **Check firewall settings** - ensure port 1433 (or your SQL Server port) is accessible

4. **Verify credentials** - double-check username, password, and database name

## Current Configuration (from CI3)

Based on your CodeIgniter configuration:
- **Host:** 172.16.2.34\SQL2014
- **Database:** OSUCSCDEV  
- **Username:** DIGISCRIPT_KTECH_DEV
- **Password:** xNFk@q5;p/!U

These details are already configured in the `.env` file.

