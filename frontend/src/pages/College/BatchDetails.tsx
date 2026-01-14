import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { API_BASE_URL, api } from "../../config/api";
import PageContainer from "../../components/common/PageContainer";

export default function BatchDetails() {
  const { batchId } = useParams<{ batchId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [showMore, setShowMore] = useState(false);
  const [numShown, setNumShown] = useState(10);
  const [transcriptUrl, setTranscriptUrl] = useState<string>("");

  useEffect(() => {
    if (batchId) {
      fetchBatchDetails();
    }
  }, [batchId]);

  useEffect(() => {
    if (data?.rec?.TRANSCRIPT_URL) {
      // Backend returns the encrypted URL, just prepend base URL if needed
      const url = data.rec.TRANSCRIPT_URL;
      if (url.startsWith("http://") || url.startsWith("https://")) {
        setTranscriptUrl(url);
      } else if (url.startsWith("/api/viewfile")) {
        setTranscriptUrl(`${API_BASE_URL.replace("/api", "")}${url}`);
      } else {
        setTranscriptUrl("");
      }
    } else {
      setTranscriptUrl("");
    }
  }, [data?.rec?.TRANSCRIPT_URL]);

  const fetchBatchDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/batchdetails/${batchId}`);
      if (response.status === 1) {
        setData(response.data);
      } else {
        setError("Failed to load batch details");
      }
    } catch (err: any) {
      setError(err.message || "Error loading batch details");
    } finally {
      setLoading(false);
    }
  };


  const toggleShowMore = () => {
    if (showMore) {
      setNumShown(10);
      setShowMore(false);
    } else {
      setNumShown(data?.linedata?.length || 0);
      setShowMore(true);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="text-center py-10">Loading...</div>
      </PageContainer>
    );
  }

  if (error || !data || !data.rec || !data.rec.BATCH_ID) {
    return (
      <PageContainer>
        <div className="content-wrapper">
          <section className="content student-info-box">
            <div className="row justify-content-center my-5">
              <div className="col-md-4 col-xs-12 col-sm-12">
                <div className="text-view">
                  <div className="row justify-content-center">
                    <div className="col-md-12 text-center">
                      <svg
                        version="1.1"
                        width="150"
                        id="Capa_1"
                        xmlns="http://www.w3.org/2000/svg"
                        xmlnsXlink="http://www.w3.org/1999/xlink"
                        x="0px"
                        y="0px"
                        viewBox="0 0 451.74 451.74"
                        style={{ enableBackground: "new 0 0 451.74 451.74" }}
                        xmlSpace="preserve"
                      >
                        <path
                          style={{ fill: "#E24C4B" }}
                          d="M446.324,367.381L262.857,41.692c-15.644-28.444-58.311-28.444-73.956,0L5.435,367.381
    c-15.644,28.444,4.267,64,36.978,64h365.511C442.057,429.959,461.968,395.825,446.324,367.381z"
                        />
                        <path
                          style={{ fill: "#FFFFFF" }}
                          d="M225.879,63.025l183.467,325.689H42.413L225.879,63.025L225.879,63.025z"
                        />
                        <g>
                          <path
                            style={{ fill: "#3F4448" }}
                            d="M196.013,212.359l11.378,75.378c1.422,8.533,8.533,15.644,18.489,15.644l0,0
        c8.533,0,17.067-7.111,18.489-15.644l11.378-75.378c2.844-18.489-11.378-34.133-29.867-34.133l0,0
        C207.39,178.225,194.59,193.87,196.013,212.359z"
                          />
                          <circle style={{ fill: "#3F4448" }} cx="225.879" cy="336.092" r="17.067" />
                        </g>
                      </svg>
                      <h5 className="mt-5">
                        <strong>Invalid Batch ID</strong>
                      </h5>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </PageContainer>
    );
  }

  const rec = data.rec;
  const linedata = data.linedata || [];

  return (
    <PageContainer>
      <div className="content-wrapper">
        <section className="content student-info-box">
          <h3 className="pb-3 mt-0 text-center border-bottom">{rec.INSTITUTION_NAME || ""}</h3>
          <div className="row">
            <div className="col-md-5 col-xs-12 col-sm-12 detail-index">
              <div className="nav-tabs-custom studentdetails">
                {transcriptUrl ? (
                  <>
                    <a href={transcriptUrl} target="_blank" rel="noopener noreferrer">
                      Transcript (Open in New Window)
                    </a>
                    <div className="tab-content no-padding">
                      <div className="tab-pane active" id="image-view">
                        <iframe
                          style={{ width: "100%", height: "500px" }}
                          src={transcriptUrl}
                          title="Transcript"
                        ></iframe>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="tab-content no-padding">
                    <div className="tab-pane active" id="image-view">
                      <center>
                        <h3>
                          <img src="/img/notfound.png" alt="Transcript not found" width="100" />
                        </h3>
                        <h3>Error loading transcript!</h3>
                        <div>&nbsp;</div>
                      </center>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="col-md-7 col-xs-12 col-sm-12 detail-index" style={{ display: "block" }} id="DownloadBatch">
              <div className="text-view">
                <div className="row">
                  <div className="col-md-6 col-xs-12 col-sm-12">
                    <h4>Student Details</h4>
                    <p>
                      <strong>Student Name</strong> &nbsp;{rec.STUDENT_FULL_NAME || ""}
                    </p>
                    <p>
                      <strong>Student ID</strong> &nbsp;{rec.STUDENT_ID || ""}
                    </p>
                    <p>
                      <strong>Date of Birth</strong> &nbsp;{rec.DATE_OF_BIRTH || ""}
                    </p>
                    <p>
                      <strong>SSN</strong> &nbsp;{rec.SSN || ""}
                    </p>
                    <p>
                      <strong>CGPA</strong> &nbsp;{rec.CGPA || ""}
                    </p>
                    <p>
                      <strong>Total Credits Earned</strong> &nbsp;{rec.TOTAL_CREDITS_EARNED || ""}
                    </p>
                  </div>
                  <div className="col-md-6 col-xs-12 col-sm-12">
                    <h4 className="text-white">Institution Details</h4>
                    <p>
                      <strong>Banner Institution Name</strong> &nbsp;{rec.INSTITUTION_NAME || ""}
                    </p>
                    <p>
                      <strong>Transcript Institution Name</strong> &nbsp;{rec.EXTERNAL_INSTITUTION_NAME || ""}
                    </p>
                    <p>
                      <strong>Institution ID</strong> &nbsp;{rec.INSTITUTION_ID || ""}
                    </p>
                  </div>
                </div>

                <div className="row">
                  {rec.DEGREE_CD && (
                    <div className="col-md-10 col-md-offset-1 my-2">
                      <table className="table table-bordered student-details-term">
                        <tr>
                          <td className="text-center">
                            <strong>Degree</strong> &nbsp;{rec.DEGREE_CD}
                          </td>
                          <td className="text-center">
                            <strong>Degree Date</strong> &nbsp;{rec.DEGREE_RECEIVED_DATE || ""}
                          </td>
                        </tr>
                      </table>
                    </div>
                  )}

                  <div className="col-md-12 col-xs-12 col-sm-12 my-2 text-view">
                    <table className="table table-bordered student-details-term my-3 tbl">
                      <thead>
                        <tr>
                          <th className="text-center">
                            <strong>Term</strong>
                          </th>
                          <th className="text-center">
                            <strong>Subject</strong>
                          </th>
                          <th className="text-center">
                            <strong>Course ID</strong>
                          </th>
                          <th className="text-center">
                            <strong>Course Title</strong>
                          </th>
                          <th className="text-center">
                            <strong>Credit Hours</strong>
                          </th>
                          <th className="text-center">
                            <strong>Grade</strong>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {linedata.slice(0, numShown).map((line: any, idx: number) => (
                          <tr key={idx}>
                            <td className="text-center">{line.START_TERM || ""}</td>
                            <td className="text-center">{line.SUBJECT || ""}</td>
                            <td className="text-center">{line.COURSE_ID || ""}</td>
                            <td className="text-center">{line.COURSE_TITLE || ""}</td>
                            <td className="text-center">{line.CREDIT_HOURS_EARNED || ""}</td>
                            <td className="text-center">{line.GRADE || ""}</td>
                          </tr>
                        ))}
                        {linedata.length > 10 && (
                          <tr>
                            <td colSpan={6} className="text-center">
                              <span
                                id="btn"
                                onClick={toggleShowMore}
                                style={{ cursor: "pointer", color: "#007bff" }}
                              >
                                {showMore ? "Show less..." : "Show more..."}
                              </span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

