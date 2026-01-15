import { Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Settings from "./pages/Settings";
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
import CollegeDashboard from "./pages/Dashboard/CollegeDashboard";
import TranscriptReports from "./pages/College/transcriptreports/TranscriptReports";
import ArticulationReports from "./pages/College/articulationreports/ArticulationReports";
import DigiScriptReports from "./pages/College/digiscriptreports/DigiScriptReports";
import TranscriptHdrOcr from "./pages/College/ocr/transcripthdrocr/TranscriptHdrOcr";
import TranscriptLineOcr from "./pages/College/ocr/transcriptlineocr/TranscriptLineOcr";
import TranscriptHdrData from "./pages/College/data/transcripthdrdata/TranscriptHdrData";
import TranscriptLineData from "./pages/College/data/transcriptlinedata/TranscriptLineData";
import DigiScriptBotLog from "./pages/College/botlogs/digiscriptbotlog/DigiScriptBotLog";
import ArticulationBotLog from "./pages/College/botlogs/articulationbotlog/ArticulationBotLog";
import StudentLogKickouts from "./pages/College/studentlogs/kickouts/StudentLogKickouts";
import StudentLogProcessed from "./pages/College/studentlogs/processed/StudentLogProcessed";
import StudentLogRerun from "./pages/College/studentlogs/rerun/StudentLogRerun";
import StudentView from "./pages/College/StudentView";
import TranscriptsUpload from "./pages/College/transcripts/TranscriptsUpload";
import TranscriptsList from "./pages/College/transcripts/TranscriptsList";
import StoredProcedure from "./pages/College/setup/storedprocedure/StoredProcedure";
import DegreeMapping from "./pages/College/setup/degreemapping/DegreeMapping";
import TermMapping from "./pages/College/setup/termmapping/TermMapping";
import TermNameMapping from "./pages/College/setup/termnamemapping/TermNameMapping";
import GradeMapping from "./pages/College/setup/grademapping/GradeMapping";
import SkipKeywords from "./pages/College/setup/skipkeywords/SkipKeywords";
import SkipCourses from "./pages/College/setup/skipcourses/SkipCourses";
import YearMapping from "./pages/College/setup/yearmapping/YearMapping";
import BotSchedule from "./pages/College/BotSchedule";
import BotStatusReport from "./pages/College/BotStatusReport";
import SuffixName from "./pages/College/setup/suffixname/SuffixName";
import PrefixName from "./pages/College/setup/prefixname/PrefixName";
import CombinedName from "./pages/College/setup/combinedname/CombinedName";
import AcceptedGradesMapping from "./pages/College/setup/acceptedgradesmapping/AcceptedGradesMapping";
import TransferGradesMapping from "./pages/College/setup/transfergradesmapping/TransferGradesMapping";
import InstitutionMapping from "./pages/College/setup/institutionmapping/InstitutionMapping";
import AccreditedInstitution from "./pages/College/setup/accreditedinstitution/AccreditedInstitution";
import OverrideEditMapping from "./pages/College/setup/overrideeditmapping/OverrideEditMapping";
import ErrorLog from "./pages/College/settings/errorlog/ErrorLog";
import SmtpSetup from "./pages/College/settings/smtpsetup/SmtpSetup";
import MasterSettings from "./pages/College/settings/mastersettings/MasterSettings";
import Permissions from "./pages/College/settings/permissions/Permissions";
import Roles from "./pages/College/settings/roles/Roles";
import AddRole from "./pages/College/settings/roles/AddRole";
import EditRole from "./pages/College/settings/roles/EditRole";
import UserManagement from "./pages/College/users/UserManagement";
import AddUser from "./pages/College/users/AddUser";
import EditUser from "./pages/College/users/EditUser";
import Help from "./pages/College/Help";
import BatchDetails from "./pages/College/BatchDetails";
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
            <Route index element={<CollegeDashboard />} />
            <Route path="/dashboard" element={<CollegeDashboard />} />
            
            {/* College module routes (default module) */}
            <Route path="/college/dashboard" element={<CollegeDashboard />} />
            
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
            <Route path="/college/batchdetails/:batchId" element={<PermissionRoute permission="college_digiscript_reports" action="VIEW"><BatchDetails /></PermissionRoute>} />
            
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
            <Route path="/college/osuskipkeywords" element={<PermissionRoute permission="osu_skip_keywords" action="VIEW"><SkipKeywords /></PermissionRoute>} />
            <Route path="/college/acceptGradeMapping" element={<PermissionRoute permission="accepted_grades_mapping" action="VIEW"><AcceptedGradesMapping /></PermissionRoute>} />
            <Route path="/college/accreditedInstitution" element={<PermissionRoute permission="accredited_institution" action="VIEW"><AccreditedInstitution /></PermissionRoute>} />
            <Route path="/college/transfergrademapping" element={<PermissionRoute permission="transfer_grade_mapping" action="VIEW"><TransferGradesMapping /></PermissionRoute>} />
            <Route path="/college/yearmapping" element={<PermissionRoute permission="year_mapping" action="VIEW"><YearMapping /></PermissionRoute>} />
            <Route path="/college/institutionmapping" element={<PermissionRoute permission="institutions_mapping" action="VIEW"><InstitutionMapping /></PermissionRoute>} />
            <Route path="/college/techinstitutionmapping" element={<PermissionRoute permission="institutions_mapping" action="VIEW"><InstitutionMapping instType="TECH" /></PermissionRoute>} />
            <Route path="/college/skipcourses" element={<PermissionRoute permission="skip_exclude_courses" action="VIEW"><SkipCourses /></PermissionRoute>} />
            <Route path="/college/overrideeditmapping" element={<PermissionRoute permission="override_edit_mapping" action="VIEW"><OverrideEditMapping /></PermissionRoute>} />
            <Route path="/college/suffixname" element={<PermissionRoute permission="suffix_names" action="VIEW"><SuffixName /></PermissionRoute>} />
            <Route path="/college/prefixname" element={<PermissionRoute permission="prefix_words" action="VIEW"><PrefixName /></PermissionRoute>} />
            <Route path="/college/combinedname" element={<PermissionRoute permission="combine_words" action="VIEW"><CombinedName /></PermissionRoute>} />
            <Route path="/college/botschedule" element={<PermissionRoute permission="bot_schedule" action="VIEW"><BotSchedule /></PermissionRoute>} />
            <Route path="/college/botstatusreport" element={<PermissionRoute permission="bot_status_report" action="VIEW"><BotStatusReport /></PermissionRoute>} />
            
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
            <Route path="/college/permissions" element={<Permissions />} />
            <Route path="/college/roles" element={<Roles />} />
            <Route path="/college/roles/add" element={<AddRole />} />
            <Route path="/college/roles/edit/:id" element={<EditRole />} />
            <Route path="/college/roles/view/:id" element={<EditRole />} />
            <Route path="/college/Error_log" element={<ErrorLog />} />
            <Route path="/college/master_setup" element={<MasterSettings />} />
            <Route path="/college/smtp" element={<SmtpSetup />} />
            
            {/* College - User Manual */}
            <Route path="/college/Help" element={<Help />} />
            
            {/* School module routes */}
            <Route path="/school/dashboard" element={<Home />} />
            
            {/* OCR Verify module routes */}
            <Route path="/ocrverify/dashboard" element={<Home />} />

            {/* Others Page */}
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/settings" element={<Settings />} />
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
