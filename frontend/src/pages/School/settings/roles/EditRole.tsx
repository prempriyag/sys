import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../../../../config/api";
import PageContainer from "../../../../components/common/PageContainer";

interface Permission {
  ID: number;
  PERMISSION_NAME: string;
  PERMISSION_KEY?: string;
  TYPE?: string | number;
  childs?: Permission[];
}

interface RolePermission {
  PERMISSION_ID: number;
  VIEW: string | number;
  ADD: string | number;
  UPDATE: string | number;
  DELETE: string | number;
}

interface RoleData {
  ID: number;
  ROLE_NAME: string;
  ROLE_KEY?: string;
  DESCRIPTION?: string;
  permissions?: RolePermission[];
}

interface PermissionState {
  view: boolean;
  add: boolean;
  update: boolean;
  delete: boolean;
}

const EditRole: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [permissionsTree, setPermissionsTree] = useState<Permission[]>([]);
  const [roleData, setRoleData] = useState<RoleData | null>(null);
  const [formData, setFormData] = useState({
    role_name: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<
    Record<number, Record<number, PermissionState>>
  >({});
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      Promise.all([fetchPermissions(), fetchRoleData()]).finally(() => {
        setLoading(false);
      });
    }
  }, [id]);

  const fetchRoleData = async () => {
    if (!id) return;
    
    try {
      const response = await api.post("/api/roles/get", { id: parseInt(id) });
      if (response.status === 1 && response.data) {
        const data = response.data;
        setRoleData(data);
        setFormData({ role_name: data.ROLE_NAME || "" });
        
        // Load existing permissions into state
        if (data.permissions && permissionsTree.length > 0) {
          loadExistingPermissions(data.permissions);
        }
      }
    } catch (error: any) {
      console.error("Error fetching role:", error);
      // Show error toast
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await api.get("/api/permissions/tree");
      if (response.status === 1) {
        const treeData = response.data || [];
        setPermissionsTree(treeData);
        initializePermissions(treeData);
      }
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
    }
  };

  const initializePermissions = (tree: Permission[]) => {
    const initPerms: typeof selectedPermissions = {};
    
    tree.forEach((parent) => {
      initPerms[parent.ID] = {};
      
      if (parent.childs && parent.childs.length > 0) {
        parent.childs.forEach((child) => {
          // Initialize all as unchecked
          initPerms[parent.ID][child.ID] = {
            view: false,
            add: false,
            update: false,
            delete: false,
          };
        });
      }
    });
    
    setSelectedPermissions(initPerms);
  };

  const loadExistingPermissions = (existingPermissions: RolePermission[]) => {
    setSelectedPermissions(prev => {
      const updated = { ...prev };
      
      existingPermissions.forEach(perm => {
        // Find which parent this permission belongs to
        for (const parentId in updated) {
          if (updated[parentId][perm.PERMISSION_ID]) {
            updated[parentId][perm.PERMISSION_ID] = {
              view: perm.VIEW === "1" || perm.VIEW === 1,
              add: perm.ADD === "1" || perm.ADD === 1,
              update: perm.UPDATE === "1" || perm.UPDATE === 1,
              delete: perm.DELETE === "1" || perm.DELETE === 1,
            };
            break;
          }
        }
      });
      
      return updated;
    });
  };

  const handleParentCheckAll = (parentId: number, action: keyof PermissionState) => {
    setSelectedPermissions(prev => {
      const updated = { ...prev };
      const parent = updated[parentId];
      
      if (!parent) return prev;
      
      // Get current state from first child (all should be same if parent is checked)
      const currentState = Object.values(parent)[0]?.[action] ?? false;
      const newState = !currentState;
      
      // Update all children
      Object.keys(parent).forEach(childId => {
        updated[parentId][parseInt(childId)][action] = newState;
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
      const updated = { ...prev };
      const currentValue = updated[parentId]?.[childId]?.[action] ?? false;
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
    
    if (!formData.role_name.trim() || !id) {
      // Show validation error
      return;
    }

    setSaving(true);

    // Auto-generate role_key (similar to CI3 logic)
    const role_key = formData.role_name.toLowerCase().replace(/\s+/g, "_");

    // Build permissions list
    const permissions_list: any[] = [];
    Object.entries(selectedPermissions).forEach(([parentId, children]) => {
      Object.entries(children).forEach(([childId, perms]) => {
        if (perms.view || perms.add || perms.update || perms.delete) {
          permissions_list.push({
            permission_id: parseInt(childId),
            view: perms.view ? 1 : 0,
            add: perms.add ? 1 : 0,
            update: perms.update ? 1 : 0,
            delete: perms.delete ? 1 : 0,
          });
        }
      });
    });

    try {
      const response = await api.post(`/api/roles/update/${id}`, {
        role_name: formData.role_name,
        role_key: role_key,
        permissions: permissions_list
      });

      if (response.status === 1) {
        // Show success toast
        navigate("/college/roles");
      } else {
        // Show error toast
        console.error("Update role error:", response.message);
      }
    } catch (error: any) {
      console.error("Error updating role:", error);
      // Show error toast
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading role data...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!roleData) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 mb-6 text-red-500">
                <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                Role Not Found
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                The role you're looking for doesn't exist or cannot be accessed.
              </p>
              <button
                onClick={() => navigate("/college/roles")}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to Roles
              </button>
            </div>
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit Role</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Update role details and permissions
              </p>
              {roleData.ROLE_KEY && (
                <div className="mt-1 flex items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Role Key:</span>
                  <code className="ml-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                    {roleData.ROLE_KEY}
                  </code>
                </div>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate(`/college/roles/view/${id}`)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                View
              </button>
              <button
                onClick={() => navigate("/college/roles")}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Back to Roles
              </button>
            </div>
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
                    Role ID: #{roleData.ID}
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

              {permissionsTree.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">No permissions available</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {permissionsTree.map((parent) => (
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
                                            checked={selectedPermissions[parent.ID]?.[child.ID]?.[action] ?? false}
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
                  ))}
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {new Date().toLocaleDateString()}
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => navigate("/college/roles")}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Update Role
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Permissions Summary */}
        {permissionsTree.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                  <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">View Permissions</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {Object.values(selectedPermissions).flatMap(parent => 
                      Object.values(parent).filter(child => child.view)
                    ).length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-100 dark:bg-green-900 p-3 rounded-lg">
                  <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Add Permissions</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {Object.values(selectedPermissions).flatMap(parent => 
                      Object.values(parent).filter(child => child.add)
                    ).length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-100 dark:bg-yellow-900 p-3 rounded-lg">
                  <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Update Permissions</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {Object.values(selectedPermissions).flatMap(parent => 
                      Object.values(parent).filter(child => child.update)
                    ).length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-red-100 dark:bg-red-900 p-3 rounded-lg">
                  <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Delete Permissions</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {Object.values(selectedPermissions).flatMap(parent => 
                      Object.values(parent).filter(child => child.delete)
                    ).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default EditRole;