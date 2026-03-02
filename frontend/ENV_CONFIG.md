# Frontend Environment Configuration

Create a `.env` file in the `frontend/` directory with the following variables:

## Required Variables

```env
# Environment: DEV | UAT | PROD
VITE_APP_ENV=DEV
```

## Optional Variables

### API Configuration

```env
# Backend API Base URL (overrides default based on environment)
# Defaults:
#   DEV:  http://localhost:8001
#   UAT:  https://digiscript-csc-uat.ktechproducts.com/backend
#   PROD: https://digiscript-csc.ktechproducts.com/backend
VITE_API_BASE_URL=http://localhost:8001
```

### Application Settings

```env
# Application Name (default: DigiScript)
VITE_APP_NAME=DigiScript
```

### Profiler Configuration

```env
# Email domain(s) allowed to access profiler (comma-separated)
# Users with emails from these domains will see the profiler icon
# Default: ktechproducts.com,ktech.com
VITE_PROFILER_ALLOWED_DOMAINS=ktechproducts.com,ktech.com

# Enable/disable profiler feature globally
# Set to 'false' to hide profiler for all users
# Default: true
VITE_PROFILER_ENABLED=true
```

### UI Configuration

```env
# Show environment badge (DEV/UAT) in header
# Set to 'false' to hide the badge
# Default: true
VITE_SHOW_ENV_BADGE=true
```

### Debug Mode

```env
# Enable debug mode for additional console logging
# Default: false
VITE_DEBUG_MODE=false
```

## Example .env Files

### Development (.env or .env.development)

```env
VITE_APP_ENV=DEV
VITE_API_BASE_URL=http://localhost:8001
VITE_APP_NAME=DigiScript
VITE_PROFILER_ENABLED=true
VITE_PROFILER_ALLOWED_DOMAINS=ktechproducts.com,ktech.com
VITE_SHOW_ENV_BADGE=true
VITE_DEBUG_MODE=true
```

### UAT (.env.uat)

```env
VITE_APP_ENV=UAT
VITE_API_BASE_URL=http://65.1.93.82/backend
VITE_APP_NAME=DigiScript
VITE_PROFILER_ENABLED=true
VITE_PROFILER_ALLOWED_DOMAINS=ktechproducts.com
VITE_SHOW_ENV_BADGE=true
VITE_DEBUG_MODE=false
```

### Production (.env.production)

```env
VITE_APP_ENV=PROD
VITE_APP_NAME=DigiScript
VITE_PROFILER_ENABLED=false
VITE_SHOW_ENV_BADGE=false
VITE_DEBUG_MODE=false
```

## Usage in Code

Import from `src/config/app.config.ts`:

```typescript
import { 
  APP_ENV,
  IS_DEV,
  IS_UAT,
  IS_PROD,
  APP_NAME,
  API_BASE_URL,
  PROFILER_ENABLED,
  SHOW_ENV_BADGE,
  canAccessProfiler,
  isProfilerAllowedEmail
} from '../config/app.config';

// Check if user can access profiler
if (canAccessProfiler()) {
  // Show profiler features
}

// Check environment
if (IS_DEV) {
  console.log('Running in development mode');
}
```

## Notes

- All Vite environment variables must be prefixed with `VITE_`
- Changes to `.env` require a restart of the dev server
- For production builds, set variables before running `npm run build`
