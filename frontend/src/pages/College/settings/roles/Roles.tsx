import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { API_BASE_URL, api } from "../../../../config/api";

declare const alertsuccess: any;
declare const alerterror: any;

const Roles: React.FC = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await api.get("/api/roles/list");
      if (response.status === 1) {
        setRoles(response.data || []);
      }
    } catch (error: any) {
      console.error("Error fetching roles:", error);
      if (typeof alerterror === "function") {
        alerterror(error.message || "Error fetching roles", false);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="content-wrapper">Loading...</div>;
  }

  return (
    <div className="content-wrapper">
      <section className="content-header">
        <h1>Roles</h1>
      </section>
      <section className="content">
        <div className="row">
          <div className="col-xs-12">
            <div className="box box-primary">
              <div className="box-header">
                <div className="col-lg-12 col-sm-12">
                  <h3 className="box-title text-right">
                    <a
                      href="#"
                      className="btn btn-primary mt-3 btn-sm add-btn ml-3 mdl-js-ripple-effect mdl-js-button"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/college/roles/add");
                      }}
                    >
                      Add Roles
                    </a>
                  </h3>
                </div>
              </div>
              <div className="box-body roles-table-align">
                <table id="example" className="table table-bordered table-striped termmapping_table">
                  <thead>
                    <tr>
                      <th>Id</th>
                      <th>Title</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((role) => (
                      <tr key={role.ID}>
                        <td>{role.ID}</td>
                        <td>{role.ROLE_NAME}</td>
                        <td className="text-center">
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/college/roles/view/${role.ID}`);
                            }}
                            className="btn-sm eye-icon"
                            title="View"
                          >
                            <i className="fa fa-eye"></i>
                          </a>
                          &nbsp;
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/college/roles/edit/${role.ID}`);
                            }}
                            className="btn-sm"
                            title="Edit"
                          >
                            <i className="fa-duotone fa-pen-to-square"></i>
                          </a>
                          &nbsp;
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Roles;
