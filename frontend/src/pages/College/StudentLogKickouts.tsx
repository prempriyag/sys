import { useLocation } from "react-router";
import TranscriptReports from "./transcriptreports/TranscriptReports";

/**
 * Student Log Kickouts page
 * Uses TranscriptReports component with Search_Field="Failed"
 * This matches CI3 behavior where studentlogkickouts uses transcript reports with Failed status
 */
export default function StudentLogKickouts() {
  // This component redirects to transcript reports with the appropriate type
  // The TranscriptReports component will detect the path and set Search_Field accordingly
  return <TranscriptReports />;
}

