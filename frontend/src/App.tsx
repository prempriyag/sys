import { Routes, Route, Navigate } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import ForgotPassword from "./pages/AuthPages/ForgotPassword";
import TwoWayVerify from "./pages/AuthPages/TwoWayVerify";
import SSOCallback from "./pages/AuthPages/SSOCallback";
import SSORedirect from "./pages/AuthPages/SSORedirect";
import NotFound from "./pages/OtherPage/NotFound";
import ServerError from "./pages/OtherPage/ServerError";
import UserProfiles from "./pages/UserProfiles";
import Settings from "./pages/Settings";

// SIR Pages
import SIRDashboard from "./pages/SIR/Dashboard";
import UploadPage from "./pages/SIR/UploadPage";
import RollDataPage from "./pages/SIR/RollDataPage";
import PdfExtractPage from "./pages/SIR/PdfExtractPage";
import EciDownloadPage from "./pages/SIR/EciDownloadPage";
import OcrPdfDetector from "./pages/SIR/OcrPdfDetector";
import BoothAnalysis from "./pages/SIR/BoothAnalysis";
import BoothKPIs from "./pages/SIR/BoothKPIs";
import RiskHeatmap from "./pages/SIR/RiskHeatmap";
import FieldValidation from "./pages/SIR/FieldValidation";
import Reports from "./pages/SIR/Reports";

// User Management Pages
import Permissions from "./pages/College/settings/permissions/Permissions";
import Roles from "./pages/College/settings/roles/Roles";
import AddRole from "./pages/College/settings/roles/AddRole";
import EditRole from "./pages/College/settings/roles/EditRole";
import UserManagement from "./pages/College/users/UserManagement";
import AddUser from "./pages/College/users/AddUser";
import EditUser from "./pages/College/users/EditUser";
import MasterSettings from "./pages/College/settings/mastersettings/MasterSettings";

import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import ToastContainer from "./components/ui/toast/ToastContainer";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PermissionRoute from "./components/auth/PermissionRoute";

export default function App() {
  return (
    <>
      <ScrollToTop />
      <ToastContainer />
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<SignIn />} />
        <Route path="/verify" element={<TwoWayVerify />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset-password" element={<ForgotPassword />} />
        <Route path="/sso/callback" element={<SSOCallback />} />
        <Route path="/sso/client" element={<SSORedirect />} />
        <Route path="/sso/ktech" element={<SSORedirect />} />
        <Route path="/server-error" element={<ServerError />} />

        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          {/* SIR Dashboard (Default) */}
          <Route index element={<SIRDashboard />} />
          <Route path="/dashboard" element={<SIRDashboard />} />
          
          {/* Data Upload */}
          <Route path="/upload/pre-sir" element={<UploadPage type="pre" />} />
          <Route path="/upload/post-sir" element={<UploadPage type="post" />} />
          <Route path="/upload/matching" element={<UploadPage type="matching" />} />
          <Route path="/upload/roll-data" element={<RollDataPage />} />
          <Route path="/upload/pdf-extract" element={<PdfExtractPage />} />
          <Route path="/upload/eci-download" element={<EciDownloadPage />} />
          <Route path="/upload/ocr-pdf-detector" element={<OcrPdfDetector />} />
          <Route path="/upload" element={<UploadPage />} />

          {/* Booth Analysis */}
          <Route path="/booths" element={<BoothKPIs />} />
          <Route path="/booths/risk-map" element={<RiskHeatmap />} />
          <Route path="/booths/analysis" element={<BoothAnalysis />} />
          <Route path="/booth-analysis/:boothId" element={<BoothAnalysis />} />
          <Route path="/booth-analysis" element={<BoothAnalysis />} />

          {/* Field Validation */}
          <Route path="/validation/sampling" element={<FieldValidation type="sampling" />} />
          <Route path="/validation/results" element={<FieldValidation type="results" />} />

          {/* Reports */}
          <Route path="/reports/summary" element={<Reports type="summary" />} />
          <Route path="/reports/action-plan" element={<Reports type="action-plan" />} />
          <Route path="/reports/constituency" element={<Reports type="constituency" />} />

          {/* User Management */}
          <Route
            path="/users"
            element={
              // <PermissionRoute permission="user_management" action="VIEW">
                <UserManagement />
              // </PermissionRoute>
            }
          />
          <Route
            path="/users/add"
            element={
              <PermissionRoute permission="user_management" action="ADD">
                <AddUser />
              </PermissionRoute>
            }
          />
          <Route
            path="/users/edit/:id"
            element={
              <PermissionRoute permission="user_management" action="UPDATE">
                <EditUser />
              </PermissionRoute>
            }
          />

          {/* Roles & Permissions */}
          <Route path="/roles" element={<Roles />} />
          <Route path="/roles/add" element={<AddRole />} />
          <Route path="/roles/edit/:id" element={<EditRole />} />
          <Route path="/permissions" element={<Permissions />} />

          {/* Master Settings */}
          <Route path="/master-settings" element={<MasterSettings />} />

          {/* Settings & Profile */}
          <Route path="/profile" element={<UserProfiles />} />
          <Route path="/settings" element={<Settings />} />

        </Route>

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
