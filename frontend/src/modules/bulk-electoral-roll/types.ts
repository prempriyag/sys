/** Progress during bulk processing */
export interface BulkProgress {
  current: number;
  total: number;
  pdf_name: string;
  records_so_far: number;
}

/** Result of bulk electoral roll processing */
export interface BulkResult {
  total_found?: number;
  inserted?: number;
  duplicates_skipped?: number;
  invalid_epic_count?: number;
  invalid_epics?: string[];
  pdf_count?: number;
  moved_count?: number;
  extracted_folder?: string;
  message?: string;
  errors?: string[];
}
