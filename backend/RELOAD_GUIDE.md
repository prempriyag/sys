# Auto-Reload Guide

## Problem
Changes to `.env` file or Python files sometimes don't reflect immediately, requiring manual server restart.

## Solutions

### 1. Quick Fix - Clear Cache and Restart
```powershell
# In backend directory
python force_reload.py
# Then restart server
```

### 2. Force Reload Settings
Set environment variable before starting server:
```powershell
$env:RELOAD_ENV="true"
.\run.ps1
```

### 3. Manual Cache Clear
```powershell
# Clear all Python cache
Get-ChildItem -Path . -Include __pycache__,*.pyc -Recurse -Force | Remove-Item -Force -Recurse
```

### 4. Use Watchdog for Better File Watching
Install watchdog for better file change detection:
```powershell
pip install watchdog
```

Then use:
```powershell
uvicorn main:app --reload --reload-dir . --reload-include "*.env" --reload-include "*.py" --host 0.0.0.0 --port 8000
```

## Why Changes Don't Reflect

1. **Python Bytecode Cache**: Python caches compiled `.pyc` files in `__pycache__` directories
2. **Module Import Caching**: Python caches imported modules in memory
3. **Settings Singleton**: Pydantic Settings loads `.env` once at import time
4. **Uvicorn Reload Limitations**: Uvicorn's reload may not detect all file changes

## Best Practices

1. **Always use `--reload` flag** when developing
2. **Clear cache before starting** if you suspect stale code
3. **Restart server** after major `.env` changes
4. **Use `force_reload.py`** script for quick cache clearing

## Troubleshooting

If changes still don't reflect:
1. Stop server completely (Ctrl+C)
2. Run `python force_reload.py`
3. Restart server with `.\run.ps1`
4. Check terminal for reload messages



