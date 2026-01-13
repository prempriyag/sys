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
import TranscriptsList from "./pages/College/TranscriptsList";
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
          <Route path="/signin" element={<SignIn />} />
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
            <Route path="/college/transcriptkickouts" element={<PermissionRoute permission="college_transcripts_kickouts" action="VIEW"><TranscriptReports /></PermissionRoute>} />
            <Route path="/college/transcript_articulationkickouts" element={<PermissionRoute permission="college_articulation_kickouts" action="VIEW"><TranscriptReports /></PermissionRoute>} />
            <Route path="/college/transcriptprocessed" element={<PermissionRoute permission="college_processed" action="VIEW"><TranscriptReports /></PermissionRoute>} />
            <Route path="/college/reprocessed" element={<PermissionRoute permission="college_rerun" action="VIEW"><TranscriptReports /></PermissionRoute>} />
            
            {/* College - Articulation */}
            <Route path="/college/articulationkickouts" element={<CollegePage title="Articulation Kickouts" />} />
            <Route path="/college/articulationphase2kickouts" element={<CollegePage title="Articulation Phase-2 Kickouts" />} />
            <Route path="/college/articulationprocessed" element={<CollegePage title="Articulation - Processed" />} />
            <Route path="/college/articulationrerun" element={<CollegePage title="Articulation - Rerun" />} />
            
            {/* College - Student Action Center */}
            <Route path="/college/studentlogkickouts" element={<CollegePage title="Student Log Kickouts" />} />
            <Route path="/college/studentlogprocessed" element={<CollegePage title="Student Log Processed" />} />
            <Route path="/college/studentlogreprocessed" element={<CollegePage title="Student Log Rerun" />} />
            <Route path="/college/studentview" element={<CollegePage title="Student to Transcripts" />} />
            
            {/* College - Reports */}
            <Route path="/college/transcriptreports" element={<PermissionRoute permission="college_transcript_reports" action="VIEW"><TranscriptReports /></PermissionRoute>} />
            <Route path="/college/transcriptequivalenthours" element={<PermissionRoute permission="college_equivalent_roll_mismatch" action="VIEW"><TranscriptReports /></PermissionRoute>} />
            <Route path="/college/articulationreports" element={<ArticulationReports />} />
            <Route path="/college/digiscriptreports" element={<CollegePage title="DigiScript Reports" />} />
            
            {/* College - Uploads */}
            <Route path="/college/transcripts/add" element={<CollegePage title="Upload Transcript" />} />
            <Route path="/college/transcripts" element={<TranscriptsList />} />
            
            {/* College - Setup */}
            <Route path="/college/degreemapping" element={<CollegePage title="Degree Mapping" />} />
            <Route path="/college/termmapping" element={<CollegePage title="Terms Mapping" />} />
            <Route path="/college/termnamemapping" element={<CollegePage title="Terms Name Mapping" />} />
            <Route path="/college/grademapping" element={<CollegePage title="Equivalent Grades Mapping" />} />
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
            <Route path="/college/transcripthdrocr" element={<CollegePage title="Transcript Header OCR" />} />
            <Route path="/college/transcriptlineocr" element={<CollegePage title="Transcript Line OCR" />} />
            
            {/* College - DATA [P2] */}
            <Route path="/college/transcripthdrdata" element={<CollegePage title="Transcript Header DATA" />} />
            <Route path="/college/transcriptlinedata" element={<CollegePage title="Transcript Line DATA" />} />
            
            {/* College - Audit Log [P3] */}
            <Route path="/college/digiscriptbotlog" element={<CollegePage title="Transcript Log" />} />
            <Route path="/college/articulationbotlog" element={<CollegePage title="Articulation Log" />} />
            
            {/* College - Reset Batch ID */}
            <Route path="/college/storedprocedure" element={<CollegePage title="Reset Batch ID" />} />
            
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
