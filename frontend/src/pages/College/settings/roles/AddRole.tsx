import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { api } from "../../../../config/api";
import PageContainer from "../../../../components/common/PageContainer";
import { useToast } from "../../../../context/ToastContext";

interface Permission {
  ID: number;
  PERMISSION_NAME: string;
  PERMISSION_KEY?: string;
  TYPE?: string | number;
  childs?: Permission[];
}

interface PermissionState {
  view: boolean;
  add: boolean;
  update: boolean;
  delete: boolean;
}

const AddRole: React.FC = () => {
  const [permissionsTree, setPermissionsTree] = useState<Permission[]>([]);
  const [formData, setFormData] = useState({
    role_name: "",
  });
  const [loading, setLoading] = useState(true);
  const [selectedPermissions, setSelectedPermissions] = useState<
    Record<number, Record<number, PermissionState>>
  >({});
  const navigate = useNavigate();
  const { alertsuccess, alerterror } = useToast();

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/permissions/tree");
      if (response.status === 1) {
        const treeData = response.data || [];
        setPermissionsTree(treeData);
        initializePermissions(treeData);
      }
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
      alerterror("Failed to load permissions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const initializePermissions = (tree: Permission[]) => {
    const initPerms: typeof selectedPermissions = {};
    
    tree.forEach((parent) => {
      initPerms[parent.ID] = {};
      
      if (parent.childs && parent.childs.length > 0) {
        parent.childs.forEach((child) => {
          // Initialize all permissions as checked (true)
          initPerms[parent.ID][child.ID] = {
            view: true,
            add: true,
            update: true,
            delete: true,
          };
        });
      }
    });
    
    setSelectedPermissions(initPerms);
  };

  const handleParentCheckAll = (parentId: number, action: keyof PermissionState) => {
    setSelectedPermissions(prev => {
      // Deep copy to avoid mutating the original state
      const updated = { ...prev };
      if (!updated[parentId]) {
        updated[parentId] = {};
      } else {
        updated[parentId] = { ...updated[parentId] };
      }
      
      const parent = updated[parentId];
      
      if (!parent || Object.keys(parent).length === 0) return prev;
      
      // Get current state from first child (all should be same if parent is checked)
      const currentState = Object.values(parent)[0]?.[action] ?? true;
      const newState = !currentState;
      
      // Update all children with deep copy
      Object.keys(parent).forEach(childId => {
        const childIdNum = parseInt(childId);
        updated[parentId][childIdNum] = { ...updated[parentId][childIdNum] };
        updated[parentId][childIdNum][action] = newState;
      });
      
      return updated;
    });
  };

  const handleChildPermissionChange = (
    parentId: number,
    childId: number,
    action: keyof PermissionState
  ) => {
    setSelectedPermissions(prev => {
      // Deep copy to avoid mutating the original state
      const updated = { ...prev };
      
      // Deep copy parent object
      if (!updated[parentId]) {
        updated[parentId] = {};
      } else {
        updated[parentId] = { ...updated[parentId] };
      }
      
      // Get current value from previous state before creating new object
      const currentChildState = prev[parentId]?.[childId];
      const currentValue = currentChildState?.[action] ?? true;
      
      // Deep copy child object
      if (!updated[parentId][childId]) {
        updated[parentId][childId] = {
          view: currentChildState?.view ?? true,
          add: currentChildState?.add ?? true,
          update: currentChildState?.update ?? true,
          delete: currentChildState?.delete ?? true,
        };
      } else {
        updated[parentId][childId] = { ...updated[parentId][childId] };
      }
      
      // Toggle the value
      updated[parentId][childId][action] = !currentValue;
      
      return updated;
    });
  };

  const getParentCheckState = (parentId: number, action: keyof PermissionState): 'checked' | 'unchecked' | 'indeterminate' => {
    const parent = selectedPermissions[parentId];
    if (!parent || Object.keys(parent).length === 0) return 'unchecked';
    
    const children = Object.values(parent);
    const allChecked = children.every(child => child[action]);
    const allUnchecked = children.every(child => !child[action]);
    
    if (allChecked) return 'checked';
    if (allUnchecked) return 'unchecked';
    return 'indeterminate';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.role_name.trim()) {
      alerterror("Please enter a role name");
      return;
    }

    // Auto-generate role_key
    const role_key = formData.role_name
      .toLowerCase()
      .replace(/['",;<>&\s]/g, "_");

    // Build permissions list - backend expects boolean values, not 1/0
    const permissions_list: any[] = [];
    Object.entries(selectedPermissions).forEach(([parentId, children]) => {
      Object.entries(children).forEach(([childId, perms]) => {
        // Include permission if at least one action is checked
        // Convert to proper booleans (handle undefined/null as false)
        const view = Boolean(perms.view);
        const add = Boolean(perms.add);
        const update = Boolean(perms.update);
        const deletePerm = Boolean(perms.delete);
        
        if (view || add || update || deletePerm) {
          permissions_list.push({
            permission_id: parseInt(childId),
            view: view,
            add: add,
            update: update,
            delete: deletePerm,
          });
        }
      });
    });

    const requestPayload = {
      role_name: formData.role_name,
      role_key: role_key,
      permissions: permissions_list
    };

    console.log("Sending role add request:", {
      role_name: requestPayload.role_name,
      role_key: requestPayload.role_key,
      permissions_count: requestPayload.permissions.length,
      first_permission: requestPayload.permissions[0]
    });

    try {
      const response = await api.post("/api/roles/add", requestPayload);

      if (response.status === 1) {
        const successMessage = response.message || "Role added successfully";
        alertsuccess(successMessage);
        navigate("/college/roles");
      } else {
        const errorMessage = response.message || "Failed to add role";
        alerterror(errorMessage);
      }
    } catch (error: any) {
      console.error("Error adding role:", error);
      console.error("Error details:", {
        message: error.message,
        detail: (error as any).detail,
        response: error.response?.data,
        status: error.status,
        isDbError: (error as any).isDbError,
        isNetworkError: (error as any).isNetworkError,
        isServerError: (error as any).isServerError
      });
      
      // Get the actual error message
      let errorMessage = "Failed to add role.";
      
      if ((error as any).isDbError) {
        errorMessage = "Database connection error. Please check if the database server is running and accessible.";
      } else if ((error as any).isNetworkError) {
        errorMessage = "Unable to connect to the server. Please check if the backend server is running.";
      } else if ((error as any).detail) {
        // Use detail from the error object (set by API handler)
        errorMessage = (error as any).detail;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alerterror(errorMessage);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading permissions...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Add New Role</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Create a new role and assign permissions
              </p>
            </div>
            <button
              onClick={() => navigate("/college/roles")}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Back to Roles
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <form onSubmit={handleSubmit}>
            {/* Role Information Section */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Role Information
              </h2>
              <div className="max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    value={formData.role_name}
                    onChange={(e) => setFormData({ role_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Enter role name"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    This will be used as the display name for the role
                  </p>
                </div>
              </div>
            </div>

            {/* Permissions Section */}
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                  Role Permissions
                </h2>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {permissionsTree.length} modules available
                </div>
              </div>

              <div className="space-y-6">
                {permissionsTree.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400">No permissions available</p>
                  </div>
                ) : (
                  permissionsTree.map((parent) => (
                    <div key={parent.ID} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {/* Parent Header */}
                      <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3">
                        <div className="flex items-center">
                          <div className="flex-grow">
                            <div className="flex items-center">
                              <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                {parent.PERMISSION_NAME}
                              </h3>
                            </div>
                            {parent.PERMISSION_KEY && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Key: {parent.PERMISSION_KEY}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-4">
                            {['view', 'add', 'update', 'delete'].map((action) => {
                              const state = getParentCheckState(parent.ID, action as keyof PermissionState);
                              return (
                                <button
                                  key={action}
                                  type="button"
                                  onClick={() => handleParentCheckAll(parent.ID, action as keyof PermissionState)}
                                  className="flex flex-col items-center"
                                  title={`${action.charAt(0).toUpperCase() + action.slice(1)} All`}
                                >
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                                    state === 'checked' 
                                      ? 'bg-blue-600 border-blue-600' 
                                      : state === 'indeterminate'
                                      ? 'bg-blue-600 border-blue-600'
                                      : 'border-gray-300 dark:border-gray-600'
                                  }`}>
                                    {state === 'checked' && (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                    {state === 'indeterminate' && (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className="text-xs mt-1 text-gray-500 dark:text-gray-400 capitalize">
                                    {action}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Child Permissions */}
                      {parent.childs && parent.childs.length > 0 && (
                        <div className="bg-white dark:bg-gray-800">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                              <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700">
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Permission
                                  </th>
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    View
                                  </th>
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Add
                                  </th>
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Update
                                  </th>
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Delete
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {parent.childs.map((child) => (
                                  <tr key={child.ID} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-4 py-3">
                                      <div className="flex items-center">
                                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {child.PERMISSION_NAME}
                                          </div>
                                          {child.PERMISSION_KEY && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                              {child.PERMISSION_KEY}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    {(['view', 'add', 'update', 'delete'] as const).map((action) => (
                                      <td key={action} className="px-4 py-3 text-center">
                                        <div className="flex justify-center">
                                          <input
                                            type="checkbox"
                                            checked={selectedPermissions[parent.ID]?.[child.ID]?.[action] ?? true}
                                            onChange={() => handleChildPermissionChange(parent.ID, child.ID, action)}
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                          />
                                        </div>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Summary */}
              {permissionsTree.length > 0 && (
                <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        All permissions are selected by default. Uncheck specific permissions as needed.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => navigate("/college/roles")}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Create Role
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </PageContainer>
  );
};

export default AddRole;