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
        <DataTable
          refreshTrigger={refreshTrigger}
          toolbarActions={<><input type="number" value={noOfDays} onChange={(e) => setNoOfDays(parseInt(e.target.value) || 7)} placeholder="Days" className="px-3 py-1.5 border rounded text-sm w-20 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /><input type="text" value={botProcessName} onChange={(e) => setBotProcessName(e.target.value)} placeholder="Process Name" className="px-3 py-1.5 border rounded text-sm w-40 dark:border-gray-700 dark:bg-gray-800 dark:text-white" /><button onClick={() => setRefreshTrigger((prev) => prev + 1)} className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"><RefreshIcon className="w-4 h-4" /> Refresh</button></>}
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

