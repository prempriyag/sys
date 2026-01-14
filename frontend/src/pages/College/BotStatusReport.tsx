import { useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/button/Button";
import { API_BASE_URL } from "../../config/api";
import { RefreshIcon } from "../../icons";

export default function BotStatusReport() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [noOfDays, setNoOfDays] = useState(7);
  const [botProcessName, setBotProcessName] = useState("");

  return (
    <PageWrapper>
      <PageMeta title="Bot Status Report | College Module" description="View bot status reports" />
      <PageBreadcrumb pageTitle="Bot Status Report" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Bot Status Report</h3>
          <div className="flex items-center gap-2">
            <input type="number" value={noOfDays} onChange={(e) => setNoOfDays(parseInt(e.target.value) || 7)} placeholder="Days" className="px-3 py-2 border rounded-lg w-20" />
            <input type="text" value={botProcessName} onChange={(e) => setBotProcessName(e.target.value)} placeholder="Process Name" className="px-3 py-2 border rounded-lg w-40" />
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
          </div>
        </div>
        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl="/api/botstatusreport/ajaxlist"
          ajaxData={{ no_of_days: noOfDays, bot_process_name: botProcessName }}
          columns={[
            { data: "JobKey", name: "Job Key", searchable: true, orderable: true },
            { data: "ProcessName", name: "Process Name", searchable: true, orderable: true },
            { data: "WindowsIdentity", name: "Windows Identity", searchable: true, orderable: true },
            { data: "RobotName", name: "Robot Name", searchable: true, orderable: true },
            { data: "Job_Start_Time", name: "Job Start Time", searchable: false, orderable: true },
            { data: "Job_End_Time", name: "Job End Time", searchable: false, orderable: true },
            { data: "Message", name: "Message", searchable: true, orderable: false },
          ]}
        />
      </PageContainer>
    </PageWrapper>
  );
}

