import React, { useState, useEffect } from "react";
import { api } from "../../../../config/api";
import PageContainer from "../../../../components/common/PageContainer";
import AddPermissionModal from "./AddPermissionModal";
import EditPermissionModal from "./EditPermissionModal";

interface Permission {
  ID: number;
  PERMISSION_NAME: string;
  PERMISSION_KEY?: string;
  TYPE?: string;
  childs?: Permission[];
}


const Permissions: React.FC = () => {
  const [permissions, setPermissions] = useState<{
    tree: Permission[];
    parents: Permission[];
  }>({
    tree: [],
    parents: []
  });
  
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPermissionId, setSelectedPermissionId] = useState<number | null>(null);
  const [selectedIsParent, setSelectedIsParent] = useState<boolean>(true);
  const [devPer, setDevPer] = useState(1); // Set to 1 to show Add/Edit buttons

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      // We'll fetch both tree and parents in one call
      const response = await api.get("/api/permissions/tree");
      
      if (response.status === 1) {
        const treeData = response.data || [];
        
        // Extract parent permissions from tree data for dropdown
        const parentPermissions = treeData.filter((per: Permission) => !per.PERMISSION_KEY || per.TYPE === "parent");
        
        setPermissions({
          tree: treeData,
          parents: parentPermissions
        });
      }
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
      // You can add toast notification here
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (permission: Permission, isParent: boolean = true) => {
    setSelectedPermissionId(permission.ID);
    setSelectedIsParent(isParent);
    setShowEditModal(true);
  };

  const handleAddClick = () => {
    setShowAddModal(true);
  };

  const handleModalSuccess = () => {
    fetchPermissions();
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Permissions</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage system permissions and access controls
              </p>
            </div>
            {devPer === 1 && (
              <button
                onClick={handleAddClick}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Permission
              </button>
            )}
          </div>
        </div>

        {/* Permissions Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Sl.No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Module Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Function Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Key
                  </th>
                  {devPer === 1 && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {permissions.tree.map((parent, parentIndex) => (
                  <React.Fragment key={parent.ID}>
                    {/* Parent Row */}
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {parentIndex + 1}
                      </td>
                      <td colSpan={2} className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {parent.PERMISSION_NAME}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {parent.PERMISSION_KEY || "—"}
                      </td>
                      {devPer === 1 && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                          <button
                            onClick={() => handleEditClick(parent, true)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                    
                    {/* Child Rows */}
                    {parent.childs?.map((child, childIndex) => (
                      <tr key={child.ID} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 pl-12">
                          {parentIndex + 1}.{childIndex + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {/* Empty cell for child rows */}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center justify-end">
                            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {child.PERMISSION_NAME}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <code className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                            {child.PERMISSION_KEY}
                          </code>
                        </td>
                        {devPer === 1 && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                            <button
                              onClick={() => handleEditClick(child, false)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Edit"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Permission Modal */}
      <AddPermissionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleModalSuccess}
        parentPermissions={permissions.parents}
      />

      {/* Edit Permission Modal */}
      <EditPermissionModal
        isOpen={showEditModal}
        permissionId={selectedPermissionId}
        isParent={selectedIsParent}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPermissionId(null);
        }}
        onSuccess={handleModalSuccess}
        parentPermissions={permissions.parents}
      />
    </PageContainer>
  );
};

export default Permissions;