import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../../../config/api";

const MasterSettings: React.FC = () => {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mastersettings/get`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      const result = await response.json();
      if (result.status === 1) {
        setSettings(result.data || {});
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error fetching settings" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mastersettings/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (result.status === 1) {
        setMessage({ type: "success", text: result.message });
      } else {
        setMessage({ type: "error", text: result.message });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error updating settings" });
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return <div className="container-fluid">Loading...</div>;
  }

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Master Settings</h3>
            </div>
            <div className="card-body">
              {message && (
                <div className={`alert alert-${message.type === "success" ? "success" : "danger"}`}>
                  {message.text}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">System Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={settings.system_name || ""}
                        onChange={(e) => handleChange("system_name", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">System Title</label>
                      <input
                        type="text"
                        className="form-control"
                        value={settings.system_title || ""}
                        onChange={(e) => handleChange("system_title", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Address</label>
                      <input
                        type="text"
                        className="form-control"
                        value={settings.address || ""}
                        onChange={(e) => handleChange("address", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Mobile</label>
                      <input
                        type="text"
                        className="form-control"
                        value={settings.mobile || ""}
                        onChange={(e) => handleChange("mobile", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">System Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={settings.system_email || ""}
                        onChange={(e) => handleChange("system_email", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Email Password</label>
                      <input
                        type="password"
                        className="form-control"
                        value={settings.email_password || ""}
                        onChange={(e) => handleChange("email_password", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Developer Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={settings.Develper_mail || ""}
                        onChange={(e) => handleChange("Develper_mail", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Bot Process Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={settings.bot_process_name || ""}
                        onChange={(e) => handleChange("bot_process_name", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <button type="submit" className="btn btn-primary">
                    Update Settings
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

export default MasterSettings;

