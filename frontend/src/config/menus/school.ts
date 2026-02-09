import { MenuConfig } from "../../types/menu";

// School menu configuration
export const schoolMenu: MenuConfig = {
  module: "school",
  items: [
    {
      name: "Dashboard",
      path: "/school/dashboard",
      icon: "dashboard",
      permission: "school_dashboard",
    },
    {
      name: "Transcripts",
      icon: "file-text",
      permission: "school_transcripts",
      subItems: [
        {
          name: "Transcript Kickouts",
          path: "/school/transcriptkickouts",
          permission: "college_transcripts_kickouts",
          icon: "alert",
        },
        {
          name: "Processed",
          path: "/school/processed",
          permission: "college_processed",
          icon: "check-circle",
        },
        {
          name: "Rerun",
          path: "/school/reprocessed",
          permission: "college_rerun",
          icon: "refresh",
        },
      ],
    },
    {
      name: "Transcripts",
      icon: "file-text",
      permission: "school_digiscript_reports",
      subItems: [
        {
          name: "Kickouts",
          path: "/school/transcriptkickouts",
          icon: "alert",
        },
        {
          name: "Processed",
          path: "/school/transcriptprocessed",
          icon: "check-circle",
        },
        {
          name: "Rerun",
          path: "/school/transcriptrerun",
          icon: "refresh",
        },
      ],
    },
    {
      name: "Reports",
      path: "/school/transcriptreports",
      icon: "bar-chart",
    },
    {
      name: "Student Action Center",
      icon: "users",
      //permission: "student_action_center",
      permissions: ["student_log_kickout", "student_log_processed", "student_log_rerun", "student_view"],
      subItems: [
        {
          name: "Ready for Articulation",
          icon: "file-text",
          permissions: ["student_log_kickout", "student_log_processed", "student_log_rerun"],
          subItems: [
            {
              name: "Kickouts",
              path: "/school/studentlogkickouts",
              permission: "student_log_kickout",
            },
            {
              name: "Processed",
              path: "/school/studentlogprocessed",
              permission: "student_log_processed",
            },
            {
              name: "Rerun",
              path: "/school/studentlogreprocessed",
              permission: "student_log_rerun",
            },
          ],
        },
        {
          name: "Student to Transcripts",
          icon: "arrow-right",
          path: "/school/Studentview",
          permission: "student_view",
        },
      ],
    },
    {
      name: "To be Reviewed",
      icon: "eye",
      permission: "school_review",
      subItems: [
        {
          name: "Multiple Levels in Course Name",
          path: "/school/multiplelevelcoursename",
          permission: "multiple_levels_course_name",
        },
        {
          name: "Unrecognized Grades",
          path: "/school/unrecognizedgrades",
          permission: "unrecognized_grades",
        },
        {
          name: "Multiple or Unrecognized Course Name",
          path: "/school/multipleorunrecognizedlevelcoursename",
          permission: "unrecognized_course_name",
        },
      ],
    },
    {
      name: "High School Uploads",
      icon: "upload",
      //permission: "school_uploads",
      subItems: [
        {
          name: "Upload Transcript",
          path: "/school/transcripts/add",
          permission: "school_upload_transcripts",
          icon: "upload",
        },
        {
          name: "Uploaded Transcripts",
          path: "/school/transcripts",
          permission: "school_upload_transcripts",
          icon: "file-text",
        },
      ],
    },
    {
      name: "Setup",
      icon: "settings",
      // Uses checkallpermission - show if user has any of these permissions
      permissions: ["school_maths", "school_science", "gpa_pick_mapping", "gpa_scale_mapping", "institutions_mapping"],
      subItems: [
        {
          name: "Maths",
          path: "/school/maths",
          permission: "school_maths",
          icon: "calculator",
        },
        {
          name: "Science",
          path: "/school/science",
          permission: "school_science",
          icon: "flask",
        },
        {
          name: "GPA Pick",
          path: "/school/GpapickMapping",
          permission: "gpa_pick_mapping",
          icon: "list",
        },
        {
          name: "GPA Scale",
          path: "/school/Gpascalemapping",
          permission: "gpa_scale_mapping",
          icon: "bar-chart",
        },
        {
          name: "Institution Mapping",
          path: "/school/institutionmapping",
          permission: "institutions_mapping",
          icon: "folder",
        },
        {
          name: "Tech Center Mapping",
          path: "/school/techinstitutionmapping",
          permission: "institutions_mapping",
          icon: "box-cube",
        },
      ],
    },
    {
      name: "User Manual",
      path: "/school/Help",
      icon: "book",
    },
    {
      name: "OCR [P1]",
      icon: "eye",
      permission: "school_ocr",
      subItems: [
        {
          name: "School Header OCR",
          path: "/school/schoolhdrocr",
          permission: "school_transcript_header_ocr",
        },
      ],
    },
    {
      name: "DATA [P2]",
      icon: "database",
      permission: "school_data",
      subItems: [
        {
          name: "School Header DATA",
          path: "/school/schoolhdrdata",
          permission: "school_transcript_header_data",
        },
      ],
    },
    {
      name: "Profiler",
      path: "/school/profiler",
      icon: "gauge",
      // Access controlled by backend - only KTech users can view
    },
  ],
};



