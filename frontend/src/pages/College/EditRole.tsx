import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { API_BASE_URL, api } from "../../config/api";

declare const alertsuccess: any;
declare const alerterror: any;

const EditRole: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [permissionsTree, setPermissionsTree] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    role_name: "",
  });
  const [selectedPermissions, setSelectedPermissions] = useState<
    Record<number, Record<number, { view: boolean; add: boolean; update: boolean; delete: boolean }>>
  >({});
  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetchRoleData();
      fetchPermissions();
    }
  }, [id]);

  const fetchRoleData = async () => {
    try {
      const response = await api.post("/api/roles/get", { id: parseInt(id!) });
      if (response.status === 1 && response.data) {
        setFormData({ role_name: response.data.ROLE_NAME || "" });
        // Load existing permissions
        if (response.data.permissions) {
          const perms: typeof selectedPermissions = {};
          permissionsTree.forEach((parent) => {
            perms[parent.ID] = {};
            parent.children?.forEach((child: any) => {
              const existingPerm = response.data.permissions.find((p: any) => p.PERMISSION_ID === child.ID);
              perms[parent.ID][child.ID] = {
                view: existingPerm?.VIEW === "1" || existingPerm?.VIEW === 1 || false,
                add: existingPerm?.ADD === "1" || existingPerm?.ADD === 1 || false,
                update: existingPerm?.UPDATE === "1" || existingPerm?.UPDATE === 1 || false,
                delete: existingPerm?.DELETE === "1" || existingPerm?.DELETE === 1 || false,
              };
            });
          });
          setSelectedPermissions(perms);
        }
      }
    } catch (error: any) {
      console.error("Error fetching role:", error);
      if (typeof alerterror === "function") {
        alerterror(error.message || "Error fetching role", false);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await api.get("/api/permissions/tree");
      if (response.status === 1) {
        setPermissionsTree(response.data || []);
        initializePermissions(response.data || []);
      }
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
    }
  };

  const initializePermissions = (tree: any[]) => {
    const initPerms: typeof selectedPermissions = {};
    tree.forEach((parent) => {
      initPerms[parent.ID] = {};
      parent.children?.forEach((child: any) => {
        initPerms[parent.ID][child.ID] = {
          view: false,
          add: false,
          update: false,
          delete: false,
        };
      });
    });
    setSelectedPermissions(initPerms);
    // After initializing, fetch role data to populate
    if (id) {
      fetchRoleData();
    }
  };

  const handleCheckAll = (parentId: number, action: "view" | "add" | "update" | "delete") => {
    const parent = selectedPermissions[parentId];
    if (!parent) return;

    const checkbox = document.getElementById(`select${action}${parentId}`) as HTMLInputElement;
    const isChecked = checkbox?.checked || false;

    const updated = { ...selectedPermissions };
    Object.keys(parent).forEach((childId) => {
      updated[parentId][parseInt(childId)][action] = isChecked;
      const childCheckbox = document.querySelector(
        `.case${action}${parentId}[value="${childId}"]`
      ) as HTMLInputElement;
      if (childCheckbox) childCheckbox.checked = isChecked;
    });
    setSelectedPermissions(updated);
  };

  const handleSingleCheck = (
    parentId: number,
    childId: number,
    action: "view" | "add" | "update" | "delete"
  ) => {
    const updated = { ...selectedPermissions };
    const currentValue = updated[parentId]?.[childId]?.[action] || false;
    updated[parentId][childId][action] = !currentValue;
    setSelectedPermissions(updated);

    // Check if all children are checked, then check parent
    const allChecked = Object.values(updated[parentId]).every((child) => child[action]);
    const parentCheckbox = document.getElementById(`select${action}${parentId}`) as HTMLInputElement;
    if (parentCheckbox) parentCheckbox.checked = allChecked;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current?.checkValidity()) {
      formRef.current?.reportValidity();
      return;
    }

    // Auto-generate role_key (just remove spaces for update in CI3)
    const role_key = formData.role_name.toLowerCase().replace(/\s+/g, "");

    // Build permissions list
    const permissions_list: any[] = [];
    Object.entries(selectedPermissions).forEach(([parentId, children]) => {
      Object.entries(children).forEach(([childId, perms]) => {
        if (perms.view || perms.add || perms.update || perms.delete) {
          permissions_list.push({
            permission_id: parseInt(childId),
            view: perms.view,
            add: perms.add,
            update: perms.update,
            delete: perms.delete,
          });
        }
      });
    });

    try {
      const formDataObj = new FormData();
      formDataObj.append("role_name", formData.role_name);
      formDataObj.append("role_key", role_key);
      formDataObj.append("permissions", JSON.stringify(permissions_list));

      const response = await fetch(`${API_BASE_URL}/api/roles/update`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: formDataObj,
      });

      const result = await response.json();
      if (result.status == 1) {
        if (typeof alertsuccess === "function") {
          alertsuccess(result.message, result.refresh);
        }
        navigate("/college/roles");
      } else {
        if (typeof alerterror === "function") {
          alerterror(result.message, result.refresh);
        }
      }
    } catch (error: any) {
      if (typeof alerterror === "function") {
        alerterror(error.message || "Error updating role", false);
      }
    }
  };

  // Update checkboxes when selectedPermissions change
  useEffect(() => {
    permissionsTree.forEach((parent) => {
      ["view", "add", "update", "delete"].forEach((action) => {
        const children = selectedPermissions[parent.ID];
        if (children) {
          const allChecked = Object.values(children).every((child) => child[action as keyof typeof child]);
          const parentCheckbox = document.getElementById(`select${action}${parent.ID}`) as HTMLInputElement;
          if (parentCheckbox) parentCheckbox.checked = allChecked;
        }
      });
    });
  }, [selectedPermissions, permissionsTree]);

  if (loading) {
    return <div className="content-wrapper">Loading...</div>;
  }

  return (
    <div className="content-wrapper">
      <section className="content-header">
        <h1>Edit Roles</h1>
      </section>
      <section className="content">
        <div className="row">
          <div className="col-md-12 col-sm-12 col-xs-12">
            <div className="box box-primary">
              <div className="box-header"></div>
              <div className="box-body pt-1">
                <form ref={formRef} onSubmit={handleSubmit} className="needs-validation" noValidate>
                  <div className="row">
                    <div className="col-md-12 col-lg-6 col-sm-12 mt-2">
                      <div className="form-group">
                        <label htmlFor="name" className="required">
                          Title
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="role_name"
                          className="form-control"
                          value={formData.role_name}
                          onChange={(e) => setFormData({ role_name: e.target.value })}
                          required
                        />
                        <em className="invalid-feedback"></em>
                        <p className="helper-block mb-0"></p>
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="permission" className="required"></label>
                    <table className="table table-bordered table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Permissions</th>
                          <th>View</th>
                          <th>Add</th>
                          <th>Update</th>
                          <th>delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permissionsTree.map((par) => (
                          <React.Fragment key={par.ID}>
                            <tr>
                              <td>
                                <strong>{par.PERMISSION_NAME}</strong>
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  onClick={() => handleCheckAll(par.ID, "view")}
                                  value={par.ID}
                                  id={`selectview${par.ID}`}
                                />
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  onClick={() => handleCheckAll(par.ID, "add")}
                                  value={par.ID}
                                  id={`selectadd${par.ID}`}
                                />
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  onClick={() => handleCheckAll(par.ID, "update")}
                                  value={par.ID}
                                  id={`selectupdate${par.ID}`}
                                />
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  onClick={() => handleCheckAll(par.ID, "delete")}
                                  value={par.ID}
                                  id={`selectdelete${par.ID}`}
                                />
                              </td>
                            </tr>
                            {par.children?.map((child: any) => (
                              <tr key={child.ID}>
                                <td>{child.PERMISSION_NAME}</td>
                                <td>
                                  <input
                                    type="checkbox"
                                    onClick={() => handleSingleCheck(par.ID, child.ID, "view")}
                                    value={child.ID}
                                    className={`caseview caseview${par.ID}`}
                                    name={`view_permissions[${child.ID}]`}
                                    defaultChecked={selectedPermissions[par.ID]?.[child.ID]?.view || false}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    onClick={() => handleSingleCheck(par.ID, child.ID, "add")}
                                    value={child.ID}
                                    className={`caseadd caseadd${par.ID}`}
                                    name={`add_permissions[${child.ID}]`}
                                    defaultChecked={selectedPermissions[par.ID]?.[child.ID]?.add || false}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    onClick={() => handleSingleCheck(par.ID, child.ID, "update")}
                                    value={child.ID}
                                    className={`caseupdate caseupdate${par.ID}`}
                                    name={`update_permissions[${child.ID}]`}
                                    defaultChecked={selectedPermissions[par.ID]?.[child.ID]?.update || false}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    onClick={() => handleSingleCheck(par.ID, child.ID, "delete")}
                                    value={child.ID}
                                    className={`casedelete casedelete${par.ID}`}
                                    name={`delete_permissions[${child.ID}]`}
                                    defaultChecked={selectedPermissions[par.ID]?.[child.ID]?.delete || false}
                                  />
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-right mt-4">
                    <button className="btn btn-primary mdl-js-ripple-effect mdl-js-button" type="submit">
                      Save
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EditRole;

