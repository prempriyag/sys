import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { API_BASE_URL, api } from "../../config/api";

declare const alertsuccess: any;
declare const alerterror: any;

const AddRole: React.FC = () => {
  const [permissionsTree, setPermissionsTree] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    role_name: "",
  });
  const [selectedPermissions, setSelectedPermissions] = useState<
    Record<number, Record<number, { view: boolean; add: boolean; update: boolean; delete: boolean }>>
  >({});
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPermissions();
    // Initialize all permissions as checked (default in CI3)
    setTimeout(() => {
      initializeAllChecked();
    }, 100);
  }, []);

  const fetchPermissions = async () => {
    try {
      const response = await api.get("/api/permissions/tree");
      if (response.status === 1) {
        setPermissionsTree(response.data || []);
        initializePermissions(response.data || []);
      }
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
      if (typeof alerterror === "function") {
        alerterror(error.message || "Error fetching permissions", false);
      }
    }
  };

  const initializePermissions = (tree: any[]) => {
    const initPerms: typeof selectedPermissions = {};
    tree.forEach((parent) => {
      initPerms[parent.ID] = {};
      parent.children?.forEach((child: any) => {
        initPerms[parent.ID][child.ID] = {
          view: true, // All checked by default in CI3
          add: true,
          update: true,
          delete: true,
        };
      });
    });
    setSelectedPermissions(initPerms);
  };

  const initializeAllChecked = () => {
    // Set all parent checkboxes as checked
    permissionsTree.forEach((parent) => {
      ["view", "add", "update", "delete"].forEach((action) => {
        const checkbox = document.getElementById(`select${action}${parent.ID}`) as HTMLInputElement;
        if (checkbox) checkbox.checked = true;
      });
    });
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

    // Auto-generate role_key
    const role_key = formData.role_name
      .toLowerCase()
      .replace(/['",;<>&\s]/g, "_");

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

      const response = await fetch(`${API_BASE_URL}/api/roles/add`, {
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
        alerterror(error.message || "Error adding role", false);
      }
    }
  };

  return (
    <div className="content-wrapper">
      <section className="content-header">
        <h1>Add Roles</h1>
      </section>
      <section className="content">
        <div className="row">
          <div className="col-md-12 col-sm-12 col-xs-12">
            <div className="box box-primary">
              <div className="box-header"></div>
              <div className="box-body pt-1">
                <form ref={formRef} onSubmit={handleSubmit} className="needs-validation" noValidate>
                  <div className="row">
                    <div className="col-lg-6 col-md-12 col-sm-12 mt-2">
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
                        <div className="invalid-feedback">Please select a valid Role Name.</div>
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
                                  defaultChecked
                                />
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  onClick={() => handleCheckAll(par.ID, "add")}
                                  value={par.ID}
                                  id={`selectadd${par.ID}`}
                                  defaultChecked
                                />
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  onClick={() => handleCheckAll(par.ID, "update")}
                                  value={par.ID}
                                  id={`selectupdate${par.ID}`}
                                  defaultChecked
                                />
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  onClick={() => handleCheckAll(par.ID, "delete")}
                                  value={par.ID}
                                  id={`selectdelete${par.ID}`}
                                  defaultChecked
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
                                    defaultChecked
                                  />
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    onClick={() => handleSingleCheck(par.ID, child.ID, "add")}
                                    value={child.ID}
                                    className={`caseadd caseadd${par.ID}`}
                                    name={`add_permissions[${child.ID}]`}
                                    defaultChecked
                                  />
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    onClick={() => handleSingleCheck(par.ID, child.ID, "update")}
                                    value={child.ID}
                                    className={`caseupdate caseupdate${par.ID}`}
                                    name={`update_permissions[${child.ID}]`}
                                    defaultChecked
                                  />
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    onClick={() => handleSingleCheck(par.ID, child.ID, "delete")}
                                    value={child.ID}
                                    className={`casedelete casedelete${par.ID}`}
                                    name={`delete_permissions[${child.ID}]`}
                                    defaultChecked
                                  />
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-right mt-4 mb-0">
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

export default AddRole;

