"""
Helper script to force reload of settings and clear cache
Run this to ensure .env changes are picked up
"""
import sys
import os
import shutil

def clear_cache():
    """Clear all Python cache files"""
    print("Clearing Python cache...")
    for root, dirs, files in os.walk('.'):
        # Remove __pycache__ directories
        if '__pycache__' in dirs:
            cache_dir = os.path.join(root, '__pycache__')
            try:
                shutil.rmtree(cache_dir)
                print(f"Removed: {cache_dir}")
            except Exception as e:
                print(f"Error removing {cache_dir}: {e}")
        
        # Remove .pyc files
        for file in files:
            if file.endswith('.pyc'):
                pyc_file = os.path.join(root, file)
                try:
                    os.remove(pyc_file)
                    print(f"Removed: {pyc_file}")
                except Exception as e:
                    print(f"Error removing {pyc_file}: {e}")
    
    print("Cache cleared!")

if __name__ == "__main__":
    clear_cache()



