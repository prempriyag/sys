import { Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import CollegePage from "./pages/College/CollegePage";
import TranscriptReports from "./pages/College/transcriptreports/TranscriptReports";
import ArticulationReports from "./pages/College/ArticulationReports";
import DigiScriptReports from "./pages/College/DigiScriptReports";
import TranscriptHdrOcr from "./pages/College/TranscriptHdrOcr";
import TranscriptLineOcr from "./pages/College/TranscriptLineOcr";
import TranscriptHdrData from "./pages/College/TranscriptHdrData";
import TranscriptLineData from "./pages/College/TranscriptLineData";
import DigiScriptBotLog from "./pages/College/DigiScriptBotLog";
import ArticulationBotLog from "./pages/College/ArticulationBotLog";
import StudentLogKickouts from "./pages/College/StudentLogKickouts";
import StudentLogProcessed from "./pages/College/StudentLogProcessed";
import StudentLogRerun from "./pages/College/StudentLogRerun";
import StudentView from "./pages/College/StudentView";
import TranscriptsUpload from "./pages/College/TranscriptsUpload";
import TranscriptsList from "./pages/College/TranscriptsList";
import PlaceholderPage from "./pages/College/PlaceholderPage";
import StoredProcedure from "./pages/College/StoredProcedure";
import DegreeMapping from "./pages/College/DegreeMapping";
import TermMapping from "./pages/College/TermMapping";
import TermNameMapping from "./pages/College/TermNameMapping";
import GradeMapping from "./pages/College/GradeMapping";
import SkipKeywords from "./pages/College/SkipKeywords";
import UserManagement from "./pages/College/users/UserManagement";
import AddUser from "./pages/College/users/AddUser";
import EditUser from "./pages/College/users/EditUser";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PermissionRoute from "./components/auth/PermissionRoute";

export default function App() {
  return (
    <>
      <ScrollToTop />
        <Routes>
          {/* Auth Layout - Public Routes */}
          {/* <Route path="/signin" element={<SignIn />} /> */}
          <Route path="/login" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Protected Routes - Require Authentication */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Default route - college dashboard */}
            <Route index element={<Home />} />
            <Route path="/dashboard" element={<Home />} />
            
            {/* College module routes (default module) */}
            <Route path="/college/dashboard" element={<Home />} />
            
                    {/* College - User Management */}
                    <Route 
                      path="/college/users" 
                      element={
                        <PermissionRoute permission="user_management" action="VIEW">
                          <UserManagement />
                        </PermissionRoute>
                      } 
                    />
                    <Route 
                      path="/college/users/add" 
                      element={
                        <PermissionRoute permission="user_management" action="ADD">
                          <AddUser />
                        </PermissionRoute>
                      } 
                    />
                    <Route 
                      path="/college/users/edit/:id" 
                      element={
                        <PermissionRoute permission="user_management" action="UPDATE">
                          <EditUser />
                        </PermissionRoute>
                      } 
                    />
            
            {/* College - Transcripts (all handled by single TranscriptReports component with type parameter) */}
            <Route path="/college/transcriptkickouts" element={<PermissionRoute permission="college_digiscript_reports" action="VIEW"><TranscriptReports /></PermissionRoute>} />
            <Route path="/college/transcript_articulationkickouts" element={<PermissionRoute permission="college_digiscript_reports" action="VIEW"><TranscriptReports /></PermissionRoute>} />
            <Route path="/college/transcriptprocessed" element={<PermissionRoute permission="college_digiscript_reports" action="VIEW"><TranscriptReports /></PermissionRoute>} />
            <Route path="/college/transcriptrerun" element={<PermissionRoute permission="college_digiscript_reports" action="VIEW"><TranscriptReports /></PermissionRoute>} />
            
            {/* College - Articulation */}
            <Route path="/college/articulationkickouts" element={<PermissionRoute permission="college_digiscript_reports" action="VIEW"><ArticulationReports /></PermissionRoute>} />
            <Route path="/college/articulationphase2kickouts" element={<PermissionRoute permission="college_digiscript_reports" action="VIEW"><ArticulationReports /></PermissionRoute>} />
            <Route path="/college/articulationprocessed" element={<PermissionRoute permission="college_digiscript_reports" action="VIEW"><ArticulationReports /></PermissionRoute>} />
            <Route path="/college/articulationrerun" element={<PermissionRoute permission="college_digiscript_reports" action="VIEW"><ArticulationReports /></PermissionRoute>} />
            
            {/* College - Student Action Center */}
            <Route path="/college/studentlogkickouts" element={<PermissionRoute permission="student_log_kickout" action="VIEW"><StudentLogKickouts /></PermissionRoute>} />
            <Route path="/college/studentlogprocessed" element={<PermissionRoute permission="student_log_processed" action="VIEW"><StudentLogProcessed /></PermissionRoute>} />
            <Route path="/college/studentlogreprocessed" element={<PermissionRoute permission="student_log_rerun" action="VIEW"><StudentLogRerun /></PermissionRoute>} />
            <Route path="/college/studentview" element={<PermissionRoute permission="student_view" action="VIEW"><StudentView /></PermissionRoute>} />
            
            {/* College - Reports */}
            <Route path="/college/transcriptreports" element={<PermissionRoute permission="college_digiscript_reports" action="VIEW"><TranscriptReports /></PermissionRoute>} />
            <Route path="/college/transcriptequivalenthours" element={<PermissionRoute permission="college_equivalent_roll_mismatch" action="VIEW"><TranscriptReports /></PermissionRoute>} />
            <Route path="/college/articulationreports" element={<ArticulationReports />} />
            <Route path="/college/digiscriptreports" element={<PermissionRoute permission="college_digiscript_reports" action="VIEW"><DigiScriptReports /></PermissionRoute>} />
            
            {/* College - Uploads */}
            <Route
              path="/college/transcripts/add"
              element={
                <PermissionRoute permission="college_upload_transcripts">
                  <TranscriptsUpload />
                </PermissionRoute>
              }
            />
            <Route
              path="/college/transcripts"
              element={
                <PermissionRoute permission="college_downloaded_transcripts">
                  <TranscriptsList />
                </PermissionRoute>
              }
            />
            
            {/* College - Setup */}
            <Route
              path="/college/degreemapping"
              element={
                <PermissionRoute permission="college_degree">
                  <DegreeMapping />
                </PermissionRoute>
              }
            />
            <Route
              path="/college/termmapping"
              element={
                <PermissionRoute permission="college_terms">
                  <TermMapping />
                </PermissionRoute>
              }
            />
            <Route
              path="/college/termnamemapping"
              element={
                <PermissionRoute permission="college_term_names">
                  <TermNameMapping />
                </PermissionRoute>
              }
            />
            <Route
              path="/college/grademapping"
              element={
                <PermissionRoute permission="par_grade_mapping">
                  <GradeMapping />
                </PermissionRoute>
              }
            />
            <Route path="/college/osuskipkeywords" element={<CollegePage title="Skip Keywords" />} />
            <Route path="/college/acceptGradeMapping" element={<CollegePage title="Accepted Grades Mapping" />} />
            <Route path="/college/accreditedInstitution" element={<CollegePage title="Accredited Institution" />} />
            <Route path="/college/transfergrademapping" element={<CollegePage title="Transfer Grades Mapping" />} />
            <Route path="/college/yearmapping" element={<CollegePage title="Year Mapping" />} />
            <Route path="/college/institutionmapping" element={<CollegePage title="Institution Mapping" />} />
            <Route path="/college/techinstitutionmapping" element={<CollegePage title="Tech Center Mapping" />} />
            <Route path="/college/skipcourses" element={<CollegePage title="Skip/Exclude Courses" />} />
            <Route path="/college/overrideeditmapping" element={<CollegePage title="Override Edit Mapping" />} />
            <Route path="/college/suffixname" element={<CollegePage title="Suffix Names" />} />
            <Route path="/college/prefixname" element={<CollegePage title="Prefix Names" />} />
            <Route path="/college/combinedname" element={<CollegePage title="Combined Names" />} />
            <Route path="/college/botschedule" element={<CollegePage title="Bot Schedule" />} />
            <Route path="/college/botstatusreport" element={<CollegePage title="Bot Status Report" />} />
            
            {/* College - OCR [P1] */}
            <Route path="/college/transcripthdrocr" element={<PermissionRoute permission="college_transcript_header_ocr" action="VIEW"><TranscriptHdrOcr /></PermissionRoute>} />
            <Route path="/college/transcriptlineocr" element={<PermissionRoute permission="college_transcript_line_ocr" action="VIEW"><TranscriptLineOcr /></PermissionRoute>} />
            
            {/* College - DATA [P2] */}
            <Route path="/college/transcripthdrdata" element={<PermissionRoute permission="college_transcript_header_data" action="VIEW"><TranscriptHdrData /></PermissionRoute>} />
            <Route path="/college/transcriptlinedata" element={<PermissionRoute permission="college_transcript_line_data" action="VIEW"><TranscriptLineData /></PermissionRoute>} />
            
            {/* College - Audit Log [P3] */}
            <Route path="/college/digiscriptbotlog" element={<PermissionRoute permission="transcript_log" action="VIEW"><DigiScriptBotLog /></PermissionRoute>} />
            <Route path="/college/articulationbotlog" element={<PermissionRoute permission="articulation_log" action="VIEW"><ArticulationBotLog /></PermissionRoute>} />
            
            {/* College - Reset Batch ID */}
            <Route
              path="/college/storedprocedure"
              element={
                <PermissionRoute permission="stored_procedure">
                  <StoredProcedure />
                </PermissionRoute>
              }
            />
            
            {/* College - Settings */}
            <Route path="/college/permissions" element={<CollegePage title="Permissions" />} />
            <Route path="/college/roles" element={<CollegePage title="Roles" />} />
            <Route path="/college/Error_log" element={<CollegePage title="Error Logs" />} />
            <Route path="/college/master_setup" element={<CollegePage title="Master Settings" />} />
            <Route path="/college/smtp" element={<CollegePage title="SMTP Setup" />} />
            
            {/* College - User Manual */}
            <Route path="/college/Help" element={<CollegePage title="User Manual" />} />
            
            {/* School module routes */}
            <Route path="/school/dashboard" element={<Home />} />
            
            {/* OCR Verify module routes */}
            <Route path="/ocrverify/dashboard" element={<Home />} />

            {/* Others Page */}
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/blank" element={<Blank />} />

            {/* Forms */}
            <Route path="/form-elements" element={<FormElements />} />

            {/* Tables */}
            <Route path="/basic-tables" element={<BasicTables />} />

            {/* Ui Elements */}
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/avatars" element={<Avatars />} />
            <Route path="/badge" element={<Badges />} />
            <Route path="/buttons" element={<Buttons />} />
            <Route path="/images" element={<Images />} />
            <Route path="/videos" element={<Videos />} />

            {/* Charts */}
            <Route path="/line-chart" element={<LineChart />} />
            <Route path="/bar-chart" element={<BarChart />} />
          </Route>

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
    </>
  );
}
