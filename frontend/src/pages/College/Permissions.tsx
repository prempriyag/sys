import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL, api } from "../../config/api";

declare const alertsuccess: any;
declare const alerterror: any;

const Permissions: React.FC = () => {
  const [permissionsTree, setPermissionsTree] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: 0,
    permission_name: "",
    permission_key: "",
    type: "parent",
  });
  const [addFormData, setAddFormData] = useState({
    permission_name: "",
    permission_key: "",
    type: "parent",
  });
  const [showKeyField, setShowKeyField] = useState(false);
  const [showEditKeyField, setShowEditKeyField] = useState(false);
  const addFormRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetchPermissions();

    // Handle Bootstrap modal events
    const addModal = document.getElementById("Addpermissions");
    const editModal = document.getElementById("Editpermissions");

    const handleAddModalShow = () => {
      setShowAddModal(true);
      setAddFormData({ permission_name: "", permission_key: "", type: "parent" });
      setShowKeyField(false);
    };

    const handleAddModalHide = () => {
      setShowAddModal(false);
      setAddFormData({ permission_name: "", permission_key: "", type: "parent" });
      setShowKeyField(false);
    };

    const handleEditModalShow = () => {
      setShowEditModal(true);
    };

    const handleEditModalHide = () => {
      setShowEditModal(false);
      setEditFormData({ id: 0, permission_name: "", permission_key: "", type: "parent" });
      setShowEditKeyField(false);
    };

    if (addModal) {
      addModal.addEventListener("show.bs.modal", handleAddModalShow);
      addModal.addEventListener("hide.bs.modal", handleAddModalHide);
    }

    if (editModal) {
      editModal.addEventListener("show.bs.modal", handleEditModalShow);
      editModal.addEventListener("hide.bs.modal", handleEditModalHide);
    }

    return () => {
      if (addModal) {
        addModal.removeEventListener("show.bs.modal", handleAddModalShow);
        addModal.removeEventListener("hide.bs.modal", handleAddModalHide);
      }
      if (editModal) {
        editModal.removeEventListener("show.bs.modal", handleEditModalShow);
        editModal.removeEventListener("hide.bs.modal", handleEditModalHide);
      }
    };
  }, []);

  const fetchPermissions = async () => {
    try {
      const response = await api.get("/api/permissions/tree");
      console.log("Permissions tree response:", response);
      if (response.status === 1) {
        console.log("Permissions tree data:", response.data);
        setPermissionsTree(response.data || []);
      } else {
        console.error("Permissions tree response error:", response);
      }

      const listResponse = await api.get("/api/permissions/list");
      console.log("Permissions list response:", listResponse);
      if (listResponse.status === 1) {
        setAllPermissions(listResponse.data || []);
      }
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
      if (typeof alerterror === "function") {
        alerterror(error.message || "Error fetching permissions", false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddTypeChange = (type: string) => {
    setAddFormData({ ...addFormData, type, permission_key: "" });
    setShowKeyField(type !== "parent");
  };

  const handleEditTypeChange = (type: string) => {
    setEditFormData({ ...editFormData, type, permission_key: type === "parent" ? "" : editFormData.permission_key });
    setShowEditKeyField(type !== "parent");
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormRef.current?.checkValidity()) {
      addFormRef.current?.reportValidity();
      return;
    }

    try {
      // Auto-generate permission key if parent
      let permission_key = addFormData.permission_key;
      if (addFormData.type === "parent") {
        permission_key = "par_" + addFormData.permission_name.toLowerCase().replace(/\s+/g, "_");
      }

      const formData = new FormData();
      formData.append("permission_name", addFormData.permission_name);
      formData.append("permission_key", permission_key);
      formData.append("type", addFormData.type);

      const response = await fetch(`${API_BASE_URL}/api/permissions/add`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (result.status == 1) {
        if (typeof alertsuccess === "function") {
          alertsuccess(result.message, result.refresh);
        }
              if (result.refresh) {
                // Close modal using Bootstrap
                const modal = document.getElementById("Addpermissions");
                if (modal) {
                  const bsModal = (window as any).bootstrap?.Modal?.getInstance(modal);
                  if (bsModal) {
                    bsModal.hide();
                  }
                }
                setAddFormData({ permission_name: "", permission_key: "", type: "parent" });
                setShowKeyField(false);
                fetchPermissions();
              }
      } else {
        if (typeof alerterror === "function") {
          alerterror(result.message, result.refresh);
        }
      }
    } catch (error: any) {
      if (typeof alerterror === "function") {
        alerterror(error.message || "Error adding permission", false);
      }
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormRef.current?.checkValidity()) {
      editFormRef.current?.reportValidity();
      return;
    }

    try {
      // Auto-generate permission key if parent
      let permission_key = editFormData.permission_key;
      if (editFormData.type === "parent") {
        permission_key = "par_" + editFormData.permission_name.toLowerCase().replace(/\s+/g, "_");
      }

      const formData = new FormData();
      formData.append("permission_name", editFormData.permission_name);
      formData.append("permission_key", permission_key);
      formData.append("type", editFormData.type);

      const response = await fetch(`${API_BASE_URL}/api/permissions/update/${editFormData.id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (result.status == 1) {
        if (typeof alertsuccess === "function") {
          alertsuccess(result.message, result.refresh);
        }
        if (result.refresh) {
          // Close modal using Bootstrap
          const modal = document.getElementById("Editpermissions");
          if (modal) {
            const bsModal = (window as any).bootstrap?.Modal?.getInstance(modal);
            if (bsModal) {
              bsModal.hide();
            }
          }
          setEditFormData({ id: 0, permission_name: "", permission_key: "", type: "parent" });
          setShowEditKeyField(false);
          fetchPermissions();
        }
      } else {
        if (typeof alerterror === "function") {
          alerterror(result.message, result.refresh);
        }
      }
    } catch (error: any) {
      if (typeof alerterror === "function") {
        alerterror(error.message || "Error updating permission", false);
      }
    }
  };

  const getPerValue = async (id: number, key: string | null = null) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/permissions/getpermission`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ id, key }),
      });

      const data = await response.json();
      const isParent = data.per_type === "parent";
      setEditFormData({
        id: data.id,
        permission_name: data.per_name,
        permission_key: data.per_key,
        type: isParent ? "parent" : data.per_type,
      });
      setShowEditKeyField(!isParent);

      // Update the select dropdown with options
      const selectElement = document.getElementById("edit_per_list") as HTMLSelectElement;
      if (selectElement) {
        selectElement.innerHTML = data.per_list;
      }

      // Show modal using Bootstrap
      const modal = document.getElementById("Editpermissions");
      if (modal) {
        const bsModal = new (window as any).bootstrap.Modal(modal);
        bsModal.show();
      }
    } catch (error: any) {
      if (typeof alerterror === "function") {
        alerterror(error.message || "Error fetching permission", false);
      }
    }
  };

  if (loading) {
    return <div className="content-wrapper">Loading...</div>;
  }

  const dev_per = 1; // Set to 1 to show Add/Edit buttons

  return (
    <div className="content-wrapper">
      <section className="content-header">
        <h1>Permissions</h1>
      </section>
      <section className="content">
        <div className="row">
          <div className="col-xs-12">
            <div className="box box-primary">
              <div className="box-header">
                {dev_per == 1 && (
                  <h3 className="box-title text-right">
                    <a
                      href="#"
                      className="btn btn-sm btn-primary mt-3 add-btn ml-3 mdl-js-ripple-effect mdl-js-button"
                      data-bs-toggle="modal"
                      data-bs-target="#Addpermissions"
                    >
                      Add Permission
                    </a>
                  </h3>
                )}
              </div>
              <div className="box-body permission-table">
                <table id="example" className="table table-bordered table-striped permission_width">
                  <thead>
                    <tr>
                      <th>Sl.No</th>
                      <th>Module Name</th>
                      <th>Function Name</th>
                      <th>Key</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissionsTree.map((par, i) => (
                      <React.Fragment key={par.ID}>
                        <tr>
                          <td>{i + 1}</td>
                          <td colSpan={3}>
                            <b style={{ float: "left" }}>{par.PERMISSION_NAME}</b>
                          </td>
                          {dev_per == 1 && (
                            <td className="text-center">
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  getPerValue(par.ID);
                                }}
                                className="fa-duotone fa-pen-to-square"
                                title="Edit"
                                data-bs-toggle="modal"
                                data-bs-target="#Editpermissions"
                              >
                                &nbsp;
                              </a>
                            </td>
                          )}
                        </tr>
                        {par.childs?.map((child: any, j: number) => (
                          <tr key={child.ID}>
                            <td>
                              {i + 1}.{j + 1}
                            </td>
                            <td colSpan={2}>
                              <span className="float-right">{child.PERMISSION_NAME}</span>
                            </td>
                            <td>{child.PERMISSION_KEY}</td>
                            {dev_per == 1 && (
                              <td className="text-center">
                                <a
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    getPerValue(child.ID, child.PERMISSION_KEY);
                                  }}
                                  className="fa-duotone fa-pen-to-square"
                                  title="Edit"
                                  data-bs-toggle="modal"
                                  data-bs-target="#Editpermissions"
                                >
                                  &nbsp;
                                </a>
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
        </div>
      </section>

      {/* Add Permission Modal */}
      <div className="modal fade" id="Addpermissions" tabIndex={-1} aria-labelledby="Addpermissions" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="Addpermissions">
                Add Permissions
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
              <div className="modal-body">
                <form role="form" ref={addFormRef} id="permissionsform" onSubmit={handleAddSubmit} className="needs-validation" noValidate>
                  <div className="form-group">
                    <label htmlFor="permission_name">Title</label>
                    <input
                      type="text"
                      name="permission_name"
                      className="form-control formFields"
                      value={addFormData.permission_name}
                      onChange={(e) => setAddFormData({ ...addFormData, permission_name: e.target.value })}
                      required
                    />
                    <div className="invalid-feedback">Please select a valid Permission Name.</div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="type">Select</label>
                    <select
                      name="type"
                      id="field_type"
                      className="form-select"
                      value={addFormData.type}
                      onChange={(e) => handleAddTypeChange(e.target.value)}
                      required
                    >
                      <option value="parent">This is parent</option>
                      {allPermissions
                        .filter((p) => p.TYPE === "parent")
                        .map((per) => (
                          <option key={per.ID} value={per.ID}>
                            {per.PERMISSION_NAME}
                          </option>
                        ))}
                    </select>
                  </div>
                  {showKeyField && (
                    <div className="form-group" id="key_id">
                      <label htmlFor="permission_key">Permission Key</label>
                      <input
                        type="text"
                        name="permission_key"
                        className="form-control"
                        value={addFormData.permission_key}
                        onChange={(e) => setAddFormData({ ...addFormData, permission_key: e.target.value })}
                        required={showKeyField}
                      />
                    </div>
                  )}
                  <hr />
                  <div className="text-left">
                    <button type="submit" className="btn btn-primary mdl-js-ripple-effect mdl-js-button">
                      Submit
                    </button>
                    <button type="button" className="btn btn-outline-primary mdl-js-ripple-effect mdl-js-button" data-bs-dismiss="modal">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

      {/* Edit Permission Modal */}
      <div className="modal fade" id="Editpermissions" tabIndex={-1} aria-labelledby="Editpermissions" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="Editpermissions">
                Edit Permissions
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
              <div className="modal-body">
                <form role="form" ref={editFormRef} id="editpermissionsform" onSubmit={handleEditSubmit} className="needs-validation" noValidate>
                  <div className="form-group">
                    <label htmlFor="edit_per_name">Title</label>
                    <input
                      type="text"
                      name="permission_name"
                      id="edit_per_name"
                      className="form-control formFields"
                      value={editFormData.permission_name}
                      onChange={(e) => setEditFormData({ ...editFormData, permission_name: e.target.value })}
                      required
                    />
                    <div className="invalid-feedback">Please select a valid Permission Name.</div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="edit_per_list">Select</label>
                    <select
                      name="type"
                      id="edit_per_list"
                      className="form-select"
                      value={editFormData.type}
                      onChange={(e) => handleEditTypeChange(e.target.value)}
                      required
                    >
                      <option value="parent">This is parent</option>
                    </select>
                  </div>
                  {showEditKeyField && (
                    <div className="form-group" id="edit_key_id">
                      <label htmlFor="edit_per_key">Permission Key</label>
                      <input
                        type="text"
                        id="edit_per_key"
                        name="permission_key"
                        className="form-control"
                        value={editFormData.permission_key}
                        onChange={(e) => setEditFormData({ ...editFormData, permission_key: e.target.value })}
                        required={showEditKeyField}
                      />
                    </div>
                  )}
                  <hr />
                  <div className="text-left">
                    <button type="submit" className="btn btn-primary mdl-js-ripple-effect mdl-js-button">
                      Submit
                    </button>
                    <button type="button" className="btn btn-outline-primary mdl-js-ripple-effect mdl-js-button" data-bs-dismiss="modal">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
};

export default Permissions;
