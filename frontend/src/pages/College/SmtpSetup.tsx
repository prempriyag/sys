import React, { useState } from "react";
import DataTable from "../../components/ui/DataTable";
import { API_BASE_URL } from "../../config/api";
import { API_ENDPOINTS } from "../../config/api";

const SmtpSetup: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    host: "",
    username: "",
    password: "",
    port: "",
  });
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const columns = [
    { data: "host", title: "Host" },
    { data: "username", title: "Username" },
    { data: "password", title: "Password" },
    { data: "port", title: "Port" },
    {
      data: "ACTION",
      title: "Action",
      orderable: false,
      render: (data: any, type: any, row: any) => {
        return `
          <button class="btn btn-sm btn-primary edit-btn" data-id="${row.id}">Edit</button>
          <button class="btn btn-sm btn-danger delete-btn ml-2" data-id="${row.id}">Delete</button>
        `;
      },
    },
  ];

  React.useEffect(() => {
    const handleEdit = async (id: number) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/smtp/get`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify({ id }),
        });
        const result = await response.json();
        if (result.id) {
          setFormData({
            host: result.host || "",
            username: result.username || "",
            password: result.password || "",
            port: result.port || "",
          });
          setEditingId(id);
          setShowEditModal(true);
        }
      } catch (error: any) {
        setMessage({ type: "error", text: error.message || "Error fetching SMTP data" });
      }
    };

    const handleDelete = async (id: number) => {
      if (!window.confirm("Are you sure you want to delete this SMTP configuration?")) return;
      try {
        const response = await fetch(`${API_BASE_URL}/api/smtp/delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify({ id }),
        });
        const result = await response.json();
        if (result.status === "Success") {
          setMessage({ type: "success", text: "Successfully deleted" });
          window.location.reload();
        } else {
          setMessage({ type: "error", text: "Failed to delete" });
        }
      } catch (error: any) {
        setMessage({ type: "error", text: error.message || "Error deleting SMTP" });
      }
    };

    const attachListeners = () => {
      document.querySelectorAll(".edit-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const id = parseInt((e.target as HTMLElement).getAttribute("data-id") || "0");
          if (id) handleEdit(id);
        });
      });
      document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const id = parseInt((e.target as HTMLElement).getAttribute("data-id") || "0");
          if (id) handleDelete(id);
        });
      });
    };

    const timer = setInterval(() => {
      attachListeners();
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();
    setMessage(null);
    try {
      const endpoint = isEdit ? "/api/smtp/update" : "/api/smtp/insert";
      const body = isEdit ? { id: editingId, ...formData } : formData;
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (result.status === 1) {
        setMessage({ type: "success", text: result.message });
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ host: "", username: "", password: "", port: "" });
        setEditingId(null);
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMessage({ type: "error", text: result.message });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error saving SMTP configuration" });
    }
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h3 className="card-title">SMTP Setup</h3>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setFormData({ host: "", username: "", password: "", port: "" });
                  setShowAddModal(true);
                }}
              >
                Add SMTP
              </button>
            </div>
            <div className="card-body">
              {message && (
                <div className={`alert alert-${message.type === "success" ? "success" : "danger"}`}>
                  {message.text}
                </div>
              )}
              <DataTable
                ajaxUrl="/api/smtp/ajaxlist"
                columns={columns}
                method="POST"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add SMTP Configuration</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddModal(false)}
                ></button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, false)}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Host</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.host}
                      onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Port</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit SMTP Configuration</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowEditModal(false)}
                ></button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, true)}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Host</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.host}
                      onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Port</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Update
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmtpSetup;

