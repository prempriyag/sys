import { MenuConfig } from "../../types/menu";

// College menu configuration (mapped from admin folder)
export const collegeMenu: MenuConfig = {
  module: "college",
  items: [
    {
      name: "Dashboard",
      path: "/college/dashboard",
      icon: "dashboard",
      permission: "college_dashboard",
    },
    {
      name: "User Management",
      path: "/college/users",
      icon: "user-circle",
      permission: "user_management",
    },
    {
      name: "Transcripts",
      icon: "file-text",
      permissions: ["college_transcripts_kickouts", "transcript_articulationkickouts", "college_processed", "college_rerun","college_digiscript_reports"],
      subItems: [
        {
          name: "Transcript Kickouts",
          path: "/college/transcriptkickouts",
          permission: "college_digiscript_reports",
          icon: "alert",
        },
        {
          name: "Articulation Kickouts",
          path: "/college/transcript_articulationkickouts",
          permission: "college_digiscript_reports",
          icon: "alert",
        },
        {
          name: "Processed",
          path: "/college/transcriptprocessed",
          permission: "college_digiscript_reports",
          icon: "check-circle",
        },
        {
          name: "Rerun",
          path: "/college/transcriptrerun",
          permission: "college_digiscript_reports",
          icon: "refresh",
        },
      ],
    },
    {
      name: "Articulation",
      icon: "settings",
      permissions: ["articulation_kickouts", "articulation_phase2_kickouts", "articulation_processed", "articulation_rerun","college_digiscript_reports"],
      subItems: [
        {
          name: "Kickouts",
          path: "/college/articulationkickouts",
          permission: "college_digiscript_reports",
          icon: "alert",
        },
        {
          name: "To be Processed Manually",
          path: "/college/articulationphase2kickouts",
          permission: "college_digiscript_reports",
          icon: "alert",
        },
        {
          name: "Processed",
          path: "/college/articulationprocessed",
          permission: "college_digiscript_reports",
          icon: "check-circle",
        },
        {
          name: "Rerun",
          path: "/college/articulationrerun",
          permission: "college_digiscript_reports",
          icon: "refresh",
        },
      ],
    },
    {
      name: "Student Action Center",
      icon: "users",
      // Uses checkallpermission - show if user has any of these permissions
      permissions: ["student_log_kickout", "student_log_processed", "student_log_rerun", "student_view"],
      subItems: [
        {
          name: "Ready for Articulation",
          icon: "file-text",
          // Uses checkallpermission - show if user has any of these permissions
          permissions: ["student_log_kickout", "student_log_processed", "student_log_rerun"],
          subItems: [
            {
              name: "Kickouts",
              path: "/college/studentlogkickouts",
              permission: "student_log_kickout",
            },
            {
              name: "Processed",
              path: "/college/studentlogprocessed",
              permission: "student_log_processed",
            },
            {
              name: "Rerun",
              path: "/college/studentlogreprocessed",
              permission: "student_log_rerun",
            },
          ],
        },
        {
          name: "Student to Transcripts",
          path: "/college/studentview",
          permission: "student_view",
        },
      ],
    },
    {
      name: "Reports",
      icon: "bar-chart",
      // PHP shows this menu without permission check - sub-items have individual checks
      // Use checkallpermission with sub-item permissions
      permissions: ["college_transcript_reports", "college_equivalent_roll_mismatch", "college_articulation_reports", "college_digiscript_reports"],
      subItems: [
        {
          name: "Transcripts",
          path: "/college/transcriptreports",
          permission: "college_digiscript_reports",
          icon: "file-text",
        },
        {
          name: "Equivalent Roll Mismatch",
          path: "/college/transcriptequivalenthours",
          permission: "college_digiscript_reports",
          icon: "alert",
        },
        {
          name: "Articulation",
          path: "/college/articulationreports",
          permission: "college_digiscript_reports",
          icon: "settings",
        },
        {
          name: "DigiScript",
          path: "/college/digiscriptreports",
          permission: "college_digiscript_reports",
          icon: "page",
        },
      ],
    },
    {
      name: "College Uploads",
      icon: "upload",
      // Uses checkallpermission - show if user has any of these permissions
      permissions: ["college_upload_transcripts", "college_downloaded_transcripts"],
      subItems: [
        {
          name: "Upload Transcript",
          path: "/college/transcripts/add",
          permission: "college_upload_transcripts",
          icon: "upload",
        },
        {
          name: "Uploaded Transcripts",
          path: "/college/transcripts",
          permission: "college_downloaded_transcripts",
          icon: "file-text",
        },
      ],
    },
    {
      name: "Setup",
      icon: "settings",
      // Uses checkallpermission - show if user has any of these permissions
      permissions: ["college_degree", "college_terms", "college_term_names", "osu_skip_keywords", "skip_exclude_courses", "institutions_mapping", "accredited_institution", "suffix_names", "prefix_words", "combine_words"],
      subItems: [
        {
          name: "Degree",
          path: "/college/degreemapping",
          permission: "college_degree",
          icon: "page",
        },
        {
          name: "Terms",
          path: "/college/termmapping",
          permission: "college_terms",
          icon: "calendar",
        },
        {
          name: "Terms Name",
          path: "/college/termnamemapping",
          permission: "college_term_names",
          icon: "list",
        },
        {
          name: "Equivalent Grades",
          path: "/college/grademapping",
          permission: "par_grade_mapping",
          icon: "table",
        },
        {
          name: "Skip Keywords",
          path: "/college/osuskipkeywords",
          permission: "osu_skip_keywords",
          icon: "pencil",
        },
        {
          name: "Accepted Grades",
          path: "/college/acceptGradeMapping",
          permission: "accepted_grades_mapping",
          icon: "check-circle",
        },
        {
          name: "Accredited Institution",
          path: "/college/accreditedInstitution",
          permission: "accredited_institution",
          icon: "box",
        },
        {
          name: "Transfer Grades",
          path: "/college/transfergrademapping",
          permission: "transfer_grade_mapping",
          icon: "arrow-right",
        },
        {
          name: "Year Mapping",
          path: "/college/yearmapping",
          permission: "year_mapping",
          icon: "calendar",
        },
        {
          name: "Institution Mapping",
          path: "/college/institutionmapping",
          permission: "institutions_mapping",
          icon: "folder",
        },
        {
          name: "Tech Center Mapping",
          path: "/college/techinstitutionmapping",
          permission: "institutions_mapping",
          icon: "box-cube",
        },
        {
          name: "Skip/Exclude Courses",
          path: "/college/skipcourses",
          permission: "skip_exclude_courses",
          icon: "list",
        },
        {
          name: "Override Edit Mapping",
          path: "/college/overrideeditmapping",
          permission: "override_edit_mapping",
          icon: "pencil",
        },
        {
          name: "Suffix Names",
          path: "/college/suffixname",
          permission: "suffix_names",
          icon: "file-text",
        },
        {
          name: "Prefix Names",
          path: "/college/prefixname",
          permission: "prefix_words",
          icon: "file-text",
        },
        {
          name: "Combined Names",
          path: "/college/combinedname",
          permission: "combine_words",
          icon: "list",
        },
        {
          name: "Bot Schedule",
          path: "/college/botschedule",
          permission: "bot_schedule",
        },
        {
          name: "Bot Status Report",
          path: "/college/botstatusreport",
          permission: "bot_status_report",
        },
      ],
    },
    {
      name: "OCR [P1]",
      icon: "eye",
      // Uses checkallpermission - show if user has any of these permissions
      permissions: ["college_transcript_header_ocr", "college_transcript_line_ocr"],
      subItems: [
        {
          name: "Transcript Header OCR",
          path: "/college/transcripthdrocr",
          permission: "college_transcript_header_ocr",
        },
        {
          name: "Transcript Line OCR",
          path: "/college/transcriptlineocr",
          permission: "college_transcript_line_ocr",
        },
      ],
    },
    {
      name: "DATA [P2]",
      icon: "database",
      // Uses checkallpermission - show if user has any of these permissions
      permissions: ["college_transcript_header_data", "college_transcript_line_data"],
      subItems: [
        {
          name: "Transcript Header DATA",
          path: "/college/transcripthdrdata",
          permission: "college_transcript_header_data",
        },
        {
          name: "Transcript Line DATA",
          path: "/college/transcriptlinedata",
          permission: "college_transcript_line_data",
        },
      ],
    },
    {
      name: "Audit Log [P3]",
      icon: "file-text",
      // PHP uses checkallpermission with transcript_log and articulation_log
      permissions: ["transcript_log", "articulation_log"],
      subItems: [
        {
          name: "Transcript Log",
          path: "/college/digiscriptbotlog",
          permission: "transcript_log",
        },
        {
          name: "Articulation Log",
          path: "/college/articulationbotlog",
          permission: "articulation_log",
        },
      ],
    },
    {
      name: "Reset Batch ID",
      path: "/college/storedprocedure",
      icon: "refresh",
      permission: "stored_procedure",
    },
    {
      name: "Settings",
      icon: "settings",
      // PHP uses checkallpermission with smtp_setup, configurations, permissions, role
      permissions: ["smtp_setup", "configurations", "permissions", "role"],
      subItems: [
        {
          name: "Permissions",
          path: "/college/permissions",
          permission: "permissions",
        },
        {
          name: "Roles",
          path: "/college/roles",
          permission: "role",
        },
        {
          name: "Error Logs",
          path: "/college/Error_log",
        },
      ],
    },
    {
      name: "User Manual",
      path: "/college/Help",
      icon: "book",
    },
  ],
};

