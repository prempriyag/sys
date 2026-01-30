import { MenuConfig } from "../../types/menu";

// OCR Verify sidebar menu (matches CI ocrverify sidebar)
export const ocrverifyMenu: MenuConfig = {
  module: "ocrverify",
  items: [
    {
      name: "Dashboard",
      path: "/ocrverify/dashboard",
      icon: "dashboard",
      permission: "ocr_dashboard",
    },
    {
      name: "Verifiers",
      path: "/ocrverify/verifiers",
      icon: "user-circle",
      permission: "ocr_verifiers",
    },
    {
      name: "From-To Assign Batches",
      path: "/ocrverify/assignbatches",
      icon: "users",
      permission: "to_assign_batches",
    },
    {
      name: "To Be Assigned",
      path: "/ocrverify/tobeassignbatches",
      icon: "clock",
      permission: "to_be_assign",
    },
    {
      name: "College Assigned Batches",
      path: "/ocrverify/collegeocrbatches",
      icon: "file-text",
      permission: "college_ocr_data",
      activePaths: ["/ocrverify/collegeocrbatch"],
    },
    {
      name: "School Assigned Batches",
      path: "/ocrverify/schoolocrbatches",
      icon: "file-text",
      permission: "school_ocr_data",
      activePaths: ["/ocrverify/schoolocrbatch"],
    },
    {
      name: "College Header Data",
      path: "/ocrverify/collegehdrdata",
      icon: "database",
      permission: "college_header_data",
      activePaths: ["/ocrverify/collegehdrbatch"],
    },
    {
      name: "School Header Data",
      path: "/ocrverify/schoolhdrdata",
      icon: "database",
      permission: "school_header_data",
      activePaths: ["/ocrverify/schoolhdrbatch"],
    },
    {
      name: "Setup",
      icon: "settings",
      permissions: ["institutions_mapping_ocr"],
      subItems: [
        {
          name: "Institution Mapping",
          path: "/ocrverify/institutionmapping",
          permission: "institutions_mapping_ocr",
        },
        {
          name: "Degree",
          path: "/ocrverify/degreemapping",
          permission: "college_degree",
        },
        {
          name: "Terms",
          path: "/ocrverify/termmapping",
          permission: "college_terms",
        },
        {
          name: "Terms Name",
          path: "/ocrverify/termnamemapping",
          permission: "college_term_names",
        },
        {
          name: "Equivalent Grades",
          path: "/ocrverify/grademapping",
          permission: "par_grade_mapping",
        },
        {
          name: "Skip Keywords",
          path: "/ocrverify/osuskipkeywords",
          permission: "osu_skip_keywords",
        },
        {
          name: "Accepted Grades",
          path: "/ocrverify/acceptGradeMapping",
          permission: "accepted_grades_mapping",
        },
        {
          name: "Accredited Institution",
          path: "/ocrverify/accreditedInstitution",
          permission: "accredited_institution",
        },
        {
          name: "Transfer Grades",
          path: "/ocrverify/transfergrademapping",
          permission: "transfer_grade_mapping",
        },
        {
          name: "Year Mapping",
          path: "/ocrverify/yearmapping",
          permission: "year_mapping",
        },
        {
          name: "Tech Center Mapping",
          path: "/ocrverify/TechInstitutionmapping",
          permission: "institutions_mapping_ocr",
        },
        {
          name: "Skip/Exclude Courses",
          path: "/ocrverify/skipcourses",
          permission: "skip_exclude_courses",
        },
        {
          name: "Override Edit Mapping",
          path: "/ocrverify/overrideeditmapping",
          permission: "override_edit_mapping",
        },
        {
          name: "Suffix Names",
          path: "/ocrverify/suffixname",
          permission: "suffix_names",
        },
        {
          name: "Prefix Names",
          path: "/ocrverify/prefixname",
          permission: "prefix_words",
        },
        {
          name: "Combined Names",
          path: "/ocrverify/combinedname",
          permission: "combine_words",
        },
      ],
    },
  ],
};



