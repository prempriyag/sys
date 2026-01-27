# diagnostic_v2.py
import sys
import os

# Add the current directory
sys.path.append(os.getcwd())

print("Testing imports...")

# Test 1: Import the model
try:
    from models.dashboard_model import DashboardModel
    print("✓ SUCCESS: Imported DashboardModel")
    
    # Check class methods
    print("\nDashboardModel methods:")
    for attr in dir(DashboardModel):
        if not attr.startswith('_'):
            print(f"  - {attr}")
            
    # Check if required methods exist
    required_methods = ['get_dashboard_data', 'get_colleges_list']
    print("\nChecking required methods:")
    for method in required_methods:
        if hasattr(DashboardModel, method):
            print(f"  ✓ {method} exists")
        else:
            print(f"  ✗ {method} missing")
            
except ImportError as e:
    print(f"✗ FAILED: {e}")
    
    # Find where the model is
    import importlib
    spec = importlib.util.find_spec("models.dashboard_model")
    if spec:
        print(f"  Module location: {spec.origin}")