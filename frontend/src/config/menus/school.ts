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
        },
        {
          name: "Processed",
          path: "/school/processed",
          permission: "college_processed",
        },
        {
          name: "Rerun",
          path: "/school/reprocessed",
          permission: "college_rerun",
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
          path: "/school/hdrreports?type=Failed",
        },
        {
          name: "Processed",
          path: "/school/hdrreports?type=Processed",
        },
        {
          name: "Rerun",
          path: "/school/hdrreports?type=Rerun",
        },
      ],
    },
    {
      name: "Reports",
      path: "/school/hdrreports",
      icon: "bar-chart",
    },
    {
      name: "Student Action Center",
      icon: "users",
      permission: "student_action_center",
      subItems: [
        {
          name: "Ready for Articulation",
          icon: "file-text",
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
      permission: "school_uploads",
      subItems: [
        {
          name: "Upload Transcript",
          path: "/school/download/add",
          permission: "school_upload_transcripts",
        },
        {
          name: "Uploaded Transcripts",
          path: "/school/download",
          permission: "school_upload_transcripts",
        },
      ],
    },
    {
      name: "Setup",
      icon: "settings",
      permission: "school_setup",
      subItems: [
        {
          name: "Maths",
          path: "/school/maths",
          permission: "school_maths",
        },
        {
          name: "Science",
          path: "/school/science",
          permission: "school_science",
        },
        {
          name: "GPA Pick",
          path: "/school/GpapickMapping",
          permission: "gpa_pick_mapping",
        },
        {
          name: "GPA Scale",
          path: "/school/Gpascalemapping",
          permission: "gpa_scale_mapping",
        },
        {
          name: "Institution Mapping",
          path: "/school/institutionmapping",
          permission: "institutions_mapping",
        },
        {
          name: "Tech Center Mapping",
          path: "/school/techinstitutionmapping",
          permission: "institutions_mapping",
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
  ],
};



