import React from "react";
import DataTable from "../../components/ui/DataTable";
import { API_BASE_URL } from "../../config/api";
import { API_ENDPOINTS } from "../../config/api";

const ErrorLog: React.FC = () => {
  const columns = [
    { data: "ID", title: "ID" },
    { data: "ERROR_TYPE", title: "Error Type" },
    { data: "ERROR_MESSAGE", title: "Error Message" },
    { data: "FILE_NAME", title: "File Name" },
    { data: "LINE_NUMBER", title: "Line Number" },
    { data: "CONTROLLER", title: "Controller" },
    { data: "METHOD", title: "Method" },
    { data: "URL", title: "URL" },
    { data: "IP_ADDRESS", title: "IP Address" },
    { data: "HOSTNAME", title: "Hostname" },
    { data: "SESSION_USERNAME", title: "Username" },
    { data: "SESSION_EMAIL", title: "Email" },
    { data: "CREATED_ON", title: "Created On" },
    {
      data: "STATUS",
      title: "Status",
      render: (data: any, row: any) => {
        const status = row?.STATUS || "";
        const statusClass =
          status === "Resolved"
            ? "badge bg-success"
            : status === "Open" || status === "Unresolved"
            ? "badge bg-danger"
            : "badge bg-secondary";
        return `<span class="${statusClass}">${status}</span>`;
      },
    },
    {
      data: "ACTION",
      title: "Action",
      orderable: false,
      render: (data: any, row: any) => {
        const status = row?.STATUS || "";
        const newStatus =
          status === "Open" || status === "Unresolved"
            ? "Resolved"
            : "Unresolved";
        const buttonText =
          status === "Open" || status === "Unresolved"
            ? "Mark Resolved"
            : "Mark Unresolved";
        return `<button class="btn btn-sm btn-primary update-status-btn" data-id="${row?.ID}" data-status="${status}">${buttonText}</button>`;
      },
    },
  ];

  React.useEffect(() => {
    // Handle status update button clicks
    const handleStatusUpdate = async (id: number, status: string) => {
      try {
        const response = await fetch(
          `${API_BASE_URL}${API_ENDPOINTS.ERROR_LOG_UPDATE_STATUS}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            },
            body: JSON.stringify({ id, status }),
          }
        );
        const result = await response.json();
        if (result.status === 1) {
          // Reload the table
          window.location.reload();
        } else {
          alert(result.message || "Failed to update status");
        }
      } catch (error: any) {
        alert(error.message || "Error updating status");
      }
    };

    // Attach event listeners to status update buttons
    const attachListeners = () => {
      document.querySelectorAll(".update-status-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.target as HTMLElement;
          const id = parseInt(target.getAttribute("data-id") || "0");
          const status = target.getAttribute("data-status") || "";
          if (id && status) {
            handleStatusUpdate(id, status);
          }
        });
      });
    };

    // Attach listeners after a short delay to ensure table is rendered
    const timer = setInterval(() => {
      attachListeners();
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Error Logs</h3>
            </div>
            <div className="card-body">
              <DataTable
                ajaxUrl={API_ENDPOINTS.ERROR_LOG_LIST}
                columns={columns}
                method="POST"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorLog;

