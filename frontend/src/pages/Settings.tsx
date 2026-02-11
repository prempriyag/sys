import React, { useState, useRef, useEffect } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import PageContainer from "../components/common/PageContainer";
import ThemedLoader from "../components/common/ThemedLoader";
import Button from "../components/ui/button/Button";
import { useThemeColor } from "../context/ThemeColorContext";
import { API_BASE_URL, API_ENDPOINTS, api } from "../config/api";
import { useToast } from "../context/ToastContext";
import { useSettings } from "../context/SettingsContext";
import SmtpSetup from "./College/settings/smtpsetup/SmtpSetup";
import SearchableMultiSelect from "../components/form/SearchableMultiSelect";

type SettingsTab = "system" | "sms-smtp" | "logo" | "theme";

interface SystemSettings {
  system_name: string;
  system_title: string;
  address: string;
  mobile: string;
  system_email: string;
  email_password: string;
  terms: string;
  facebook: string;
  twiter: string;
  youtube: string;
  skype: string;
  pinterest: string;
  privacy: string;
  two_way_auth: string;
  two_way_auth_exept: string;
  trigger_update: string;
  trigger_update_mail: string;
  ktech_SSO_client_secret: string;
  ktech_SSO_clientId: string;
  ktech_SSO_tenantId: string;
  bot_process_name: string;
  Develper_mail: string;
}

interface SmsSettings {
  sms_username: string;
  sms_sender: string;
  sms_hash: string;
}

interface SmtpSettings {
  smtp_port: string;
  smtp_host: string;
  smtp_username: string;
  smtp_password: string;
}

interface Role {
  ROLE_KEY: string;
  ROLE_NAME: string;
}

export default function Settings() {
  const { refreshSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>("system");
  
  // System Settings State
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    system_name: '',
    system_title: '',
    address: '',
    mobile: '',
    system_email: '',
    email_password: '',
    terms: '',
    facebook: '',
    twiter: '',
    youtube: '',
    skype: '',
    pinterest: '',
    privacy: '',
    two_way_auth: '',
    two_way_auth_exept: '[]',
    trigger_update: '',
    trigger_update_mail: '',
    ktech_SSO_client_secret: '',
    ktech_SSO_clientId: '',
    ktech_SSO_tenantId: '',
    bot_process_name: '',
    Develper_mail: ''
  });
  
  // SMS & SMTP Settings State
  const [smsSettings, setSmsSettings] = useState<SmsSettings>({
    sms_username: '',
    sms_sender: '',
    sms_hash: ''
  });
  
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>({
    smtp_port: '',
    smtp_host: '',
    smtp_username: '',
    smtp_password: ''
  });
  
  // Logo Settings State
  const [logoFiles, setLogoFiles] = useState<{
    BLACK_LOGO: File | null;
    SMALL_LOGO: File | null;
  }>({
    BLACK_LOGO: null,
    SMALL_LOGO: null
  });
  
  const [logoPreviews, setLogoPreviews] = useState<{
    blackLogo: string;
    smallLogo: string;
  }>({
    blackLogo: '',
    smallLogo: ''
  });
  
  // System Settings helpers
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedAuthRoles, setSelectedAuthRoles] = useState<string[]>([]);
  const [triggerEmails, setTriggerEmails] = useState<string[]>([]);
  const [newTriggerEmail, setNewTriggerEmail] = useState('');
  const [systemSaving, setSystemSaving] = useState(false);
  const [systemMessage, setSystemMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [systemLoading, setSystemLoading] = useState(true);
  const {
    primaryColor,
    setPrimaryColor,
    logoUrl,
    setLogoUrl,
    logoIconUrl,
    setLogoIconUrl,
    logoLightUrl,
    setLogoLightUrl,
    logoDarkUrl,
    setLogoDarkUrl,
    headerBgColor,
    setHeaderBgColor,
    headerTextColor,
    setHeaderTextColor,
    sidebarBgColor,
    setSidebarBgColor,
    sidebarTextColor,
    setSidebarTextColor,
    updateThemeColor,
  } = useThemeColor();

  const [selectedColor, setSelectedColor] = useState(primaryColor);
  const [logoPreview, setLogoPreview] = useState(logoUrl);
  const [logoIconPreview, setLogoIconPreview] = useState(logoIconUrl);
  const [logoLightPreview, setLogoLightPreview] = useState(logoLightUrl);
  const [logoDarkPreview, setLogoDarkPreview] = useState(logoDarkUrl);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileIconInputRef = useRef<HTMLInputElement>(null);
  const fileLightInputRef = useRef<HTMLInputElement>(null);
  const fileDarkInputRef = useRef<HTMLInputElement>(null);
  const { alertsuccess, alerterror } = useToast();

  // Load all settings from backend on mount
  useEffect(() => {
    const loadAllSettings = async () => {
      try {
        // Load theme settings SILENTLY - no loading screen for theme changes
        try {
          const themeSettings = await api.get(API_ENDPOINTS.SETTINGS);
          if (themeSettings.primaryColor) {
            setPrimaryColor(themeSettings.primaryColor);
            setSelectedColor(themeSettings.primaryColor);
          }
          if (themeSettings.logoUrl) setLogoUrl(themeSettings.logoUrl);
          if (themeSettings.logoIconUrl) setLogoIconUrl(themeSettings.logoIconUrl);
          if (themeSettings.logoLightUrl) setLogoLightUrl(themeSettings.logoLightUrl);
          if (themeSettings.logoDarkUrl) setLogoDarkUrl(themeSettings.logoDarkUrl);
          
          // IMPORTANT: Always keep header/sidebar backgrounds WHITE
          // Do NOT apply derived colors from API to background elements
          setHeaderBgColor("#ffffff");
          setHeaderTextColor("#1d2939");
          setSidebarBgColor("#ffffff");
          setSidebarTextColor("#1d2939");
        } catch (e) {
          console.error("Error loading theme settings:", e);
        }
        
        // Show loading only for system settings
        setSystemLoading(true);
        const settingsResponse = await api.get("/api/mastersettings/get");
        if (settingsResponse.status === 1 && settingsResponse.data) {
          setSystemSettings(prev => ({
            ...prev,
            ...settingsResponse.data
          }));
          
          if (settingsResponse.data.two_way_auth_exept) {
            try {
              const parsedRoles = JSON.parse(settingsResponse.data.two_way_auth_exept);
              if (Array.isArray(parsedRoles)) {
                setSelectedAuthRoles(parsedRoles);
              }
            } catch (e) {
              console.error("Error parsing auth roles:", e);
            }
          }
          
          if (settingsResponse.data.trigger_update_mail) {
            setTriggerEmails(settingsResponse.data.trigger_update_mail.split(','));
          }
        }
        
        // Load SMS settings
        const smsResponse = await api.get("/api/settings/sms");
        if (smsResponse.status === 1 && smsResponse.data) {
          setSmsSettings(prev => ({
            ...prev,
            ...smsResponse.data
          }));
        }
        
        // Load SMTP settings
        const smtpResponse = await api.get("/api/settings/smtp");
        if (smtpResponse.status === 1 && smtpResponse.data) {
          setSmtpSettings(prev => ({
            ...prev,
            ...smtpResponse.data
          }));
        }
        
        // Load roles
        const rolesResponse = await api.get("/api/roles/list");
        if (rolesResponse.status === 1) {
          setRoles(rolesResponse.data || []);
        }
        
        // Mark initial page load as complete
        setLoading(false);
        
      } catch (error) {
        console.error("Error loading settings:", error);
        alerterror("Failed to load settings");
        setLoading(false);
      } finally {
        setSystemLoading(false);
      }
    };

    loadAllSettings();
  }, [setPrimaryColor, setLogoUrl, setLogoIconUrl, setLogoLightUrl, setLogoDarkUrl, setHeaderBgColor, setHeaderTextColor, setSidebarBgColor, setSidebarTextColor, alerterror]);

  // Sync states with context
  useEffect(() => {
    setSelectedColor(primaryColor);
  }, [primaryColor]);

  useEffect(() => {
    setLogoPreview(logoUrl);
  }, [logoUrl]);

  useEffect(() => {
    setLogoIconPreview(logoIconUrl);
  }, [logoIconUrl]);

  useEffect(() => {
    setLogoLightPreview(logoLightUrl);
  }, [logoLightUrl]);

  useEffect(() => {
    setLogoDarkPreview(logoDarkUrl);
  }, [logoDarkUrl]);

  // Predefined color options
  const colorOptions = [
    { name: "OSU Orange", value: "#e57124" },
    { name: "Blue", value: "#465fff" },
    { name: "Purple", value: "#7a5af8" },
    { name: "Green", value: "#10b981" },
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f59e0b" },
    { name: "Pink", value: "#ec4899" },
    { name: "Indigo", value: "#6366f1" },
    { name: "Teal", value: "#14b8a6" },
  ];

  // Save settings to backend
  const saveSettings = async (updates: Record<string, string>) => {
    try {
      setSaving(true);
      await api.put(API_ENDPOINTS.SETTINGS, updates);
      // Don't show success for every change to avoid spam
    } catch (error) {
      console.error("Error saving settings:", error);
      alerterror("Failed to save settings");
      throw error; // Re-throw to allow caller to handle
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = async (color: string) => {
    setSelectedColor(color);
    updateThemeColor(color);
    // Keep header and sidebar backgrounds white when changing primary color
    await saveSettings({ 
      primaryColor: color,
      headerBgColor: "#ffffff",
      sidebarBgColor: "#ffffff",
      headerTextColor: "#1d2939",
      sidebarTextColor: "#1d2939"
    });
    // Update context to reflect white backgrounds
    setHeaderBgColor("#ffffff");
    setSidebarBgColor("#ffffff");
    setHeaderTextColor("#1d2939");
    setSidebarTextColor("#1d2939");
  };

  const handleColorInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setSelectedColor(color);
    updateThemeColor(color);
    // Keep header and sidebar backgrounds white when changing primary color
    await saveSettings({ 
      primaryColor: color,
      headerBgColor: "#ffffff",
      sidebarBgColor: "#ffffff",
      headerTextColor: "#1d2939",
      sidebarTextColor: "#1d2939"
    });
    // Update context to reflect white backgrounds
    setHeaderBgColor("#ffffff");
    setSidebarBgColor("#ffffff");
    setHeaderTextColor("#1d2939");
    setSidebarTextColor("#1d2939");
  };

  const handleLogoUpload = async (
    file: File,
    type: "main" | "icon" | "light" | "dark"
  ) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        switch (type) {
          case "main":
            setLogoPreview(result);
            setLogoUrl(result);
            break;
          case "icon":
            setLogoIconPreview(result);
            setLogoIconUrl(result);
            break;
          case "light":
            setLogoLightPreview(result);
            setLogoLightUrl(result);
            break;
          case "dark":
            setLogoDarkPreview(result);
            setLogoDarkUrl(result);
            break;
        }
      };
      reader.readAsDataURL(file);

      // Upload to server
      const formData = new FormData();
      formData.append("logo", file);
      formData.append("type", type);

      const token = localStorage.getItem("auth_token");
      try {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.SETTINGS_UPLOAD_LOGO}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          const logoUrl = data.logoUrl || reader.result;
          switch (type) {
            case "main":
              setLogoUrl(logoUrl as string);
              await saveSettings({ logoUrl: logoUrl as string });
              break;
            case "icon":
              setLogoIconUrl(logoUrl as string);
              await saveSettings({ logoIconUrl: logoUrl as string });
              break;
            case "light":
              setLogoLightUrl(logoUrl as string);
              await saveSettings({ logoLightUrl: logoUrl as string });
              break;
            case "dark":
              setLogoDarkUrl(logoUrl as string);
              await saveSettings({ logoDarkUrl: logoUrl as string });
              break;
          }
          alertsuccess("Logo uploaded successfully");
        } else {
          throw new Error("Upload failed");
        }
      } catch (error) {
        console.error("Error uploading logo:", error);
        alerterror("Failed to upload logo");
      }
    } catch (error) {
      console.error("Error uploading logo:", error);
      alerterror("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleResetColor = async () => {
    const defaultColor = "#e57124";
    setSelectedColor(defaultColor);
    updateThemeColor(defaultColor);
    await saveSettings({ primaryColor: defaultColor });
  };

  const handleResetLogo = async (type: "main" | "icon" | "light" | "dark") => {
    let defaultUrl = "";
    switch (type) {
      case "main":
        defaultUrl = "/images/logo/logo.svg";
        setLogoPreview(defaultUrl);
        setLogoUrl(defaultUrl);
        await saveSettings({ logoUrl: defaultUrl });
        break;
      case "icon":
        defaultUrl = "/images/logo/logo-icon.svg";
        setLogoIconPreview(defaultUrl);
        setLogoIconUrl(defaultUrl);
        await saveSettings({ logoIconUrl: defaultUrl });
        break;
      case "light":
        defaultUrl = "/images/logo/connors-color.png";
        setLogoLightPreview(defaultUrl);
        setLogoLightUrl(defaultUrl);
        await saveSettings({ logoLightUrl: defaultUrl });
        break;
      case "dark":
        defaultUrl = "/images/logo/connors-white.png";
        setLogoDarkPreview(defaultUrl);
        setLogoDarkUrl(defaultUrl);
        await saveSettings({ logoDarkUrl: defaultUrl });
        break;
    }
  };

  const handleResetColors = async () => {
    const defaults = {
      headerBgColor: "#ffffff",
      headerTextColor: "#1d2939",
      sidebarBgColor: "#ffffff",
      sidebarTextColor: "#1d2939",
    };
    setHeaderBgColor(defaults.headerBgColor);
    setHeaderTextColor(defaults.headerTextColor);
    setSidebarBgColor(defaults.sidebarBgColor);
    setSidebarTextColor(defaults.sidebarTextColor);
    await saveSettings(defaults);
  };

  // Calculate derived colors based on primary color
  const getDerivedColors = (baseColor: string) => {
    const hex = baseColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return {
      light: `rgb(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)})`,
      dark: `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`,
      bg: `rgb(${Math.min(255, r + 240)}, ${Math.min(255, g + 240)}, ${Math.min(255, b + 240)})`,
    };
  };

  const applyDerivedColors = async () => {
    const derived = getDerivedColors(primaryColor);
    setHeaderBgColor(derived.bg);
    setSidebarBgColor(derived.bg);
    await saveSettings({
      headerBgColor: derived.bg,
      sidebarBgColor: derived.bg,
    });
  };

  // System Settings Handlers
  const handleSystemSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemSaving(true);
    setSystemMessage(null);
    
    try {
      const dataToSend = {
        ...systemSettings,
        two_way_auth_exept: JSON.stringify(selectedAuthRoles),
        trigger_update_mail: triggerEmails.join(',')
      };
      
      const response = await api.post("/api/mastersettings/update", dataToSend);
      
      if (response.status === 1) {
        setSystemMessage({ type: 'success', text: response.message });
        alertsuccess(response.message);
        // Refresh system settings (including system_name) to update page titles
        await refreshSettings();
      } else {
        setSystemMessage({ type: 'error', text: response.message });
        alerterror(response.message);
      }
    } catch (error: any) {
      const errorMsg = error.message || "Error updating settings";
      setSystemMessage({ type: 'error', text: errorMsg });
      alerterror(errorMsg);
    } finally {
      setSystemSaving(false);
    }
  };

  const handleSmsSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemSaving(true);
    setSystemMessage(null);
    
    try {
      const response = await api.post("/api/settings/sms/update", smsSettings);
      
      if (response.status === 1) {
        setSystemMessage({ type: 'success', text: response.message });
        alertsuccess(response.message);
      } else {
        setSystemMessage({ type: 'error', text: response.message });
        alerterror(response.message);
      }
    } catch (error: any) {
      const errorMsg = error.message || "Error updating SMS settings";
      setSystemMessage({ type: 'error', text: errorMsg });
      alerterror(errorMsg);
    } finally {
      setSystemSaving(false);
    }
  };

  const handleSmtpSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemSaving(true);
    setSystemMessage(null);
    
    try {
      const response = await api.post("/api/settings/smtp/update", smtpSettings);
      
      if (response.status === 1) {
        setSystemMessage({ type: 'success', text: response.message });
        alertsuccess(response.message);
      } else {
        setSystemMessage({ type: 'error', text: response.message });
        alerterror(response.message);
      }
    } catch (error: any) {
      const errorMsg = error.message || "Error updating SMTP settings";
      setSystemMessage({ type: 'error', text: errorMsg });
      alerterror(errorMsg);
    } finally {
      setSystemSaving(false);
    }
  };

  const handleLogoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSystemSaving(true);
    setSystemMessage(null);
    
    try {
      const formData = new FormData();
      
      if (logoFiles.BLACK_LOGO) {
        formData.append('BLACK_LOGO', logoFiles.BLACK_LOGO);
      }
      
      if (logoFiles.SMALL_LOGO) {
        formData.append('SMALL_LOGO', logoFiles.SMALL_LOGO);
      }
      
      const response = await api.post("/api/settings/logo/update", formData);
      
      if (response.status === 1) {
        setSystemMessage({ type: 'success', text: response.message });
        alertsuccess(response.message);
        setLogoFiles({ BLACK_LOGO: null, SMALL_LOGO: null });
        setLogoPreviews({ blackLogo: '', smallLogo: '' });
      } else {
        setSystemMessage({ type: 'error', text: response.message });
        alerterror(response.message);
      }
    } catch (error: any) {
      const errorMsg = error.message || "Error uploading logos";
      setSystemMessage({ type: 'error', text: errorMsg });
      alerterror(errorMsg);
    } finally {
      setSystemSaving(false);
    }
  };

  const handleLogoFileChange = (field: 'BLACK_LOGO' | 'SMALL_LOGO', file: File | null) => {
    setLogoFiles(prev => ({ ...prev, [field]: file }));
    
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (field === 'BLACK_LOGO') {
          setLogoPreviews(prev => ({ ...prev, blackLogo: reader.result as string }));
        } else {
          setLogoPreviews(prev => ({ ...prev, smallLogo: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addTriggerEmail = () => {
    if (newTriggerEmail.trim() && !triggerEmails.includes(newTriggerEmail.trim())) {
      setTriggerEmails([...triggerEmails, newTriggerEmail.trim()]);
      setNewTriggerEmail('');
    }
  };

  const removeTriggerEmail = (email: string) => {
    setTriggerEmails(triggerEmails.filter(e => e !== email));
  };

  const handleRoleToggle = (roleKey: string) => {
    setSelectedAuthRoles(prev => 
      prev.includes(roleKey) 
        ? prev.filter(key => key !== roleKey)
        : [...prev, roleKey]
    );
  };

  if (loading) {
    return (
      <>
        <PageMeta title="Settings | OSUCSC" description="Application settings and customization" />
        <PageBreadcrumb pageTitle="Settings" />
        <PageContainer>
          <div className="flex items-center justify-center min-h-[400px]">
            <ThemedLoader 
              size={80} 
              className="text-brand-500" 
              label="Loading settings"
              title="Loading Settings"
              description="Please wait while we load your settings..."
              showProgress={true}
            />
          </div>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <PageMeta title="Settings | OSUCSC" description="Application settings and customization" />
      <PageBreadcrumb pageTitle="Settings" />
      <PageContainer>
        {/* Tabs Navigation */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-800">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("system")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "system"
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              System Settings
            </button>
            <button
              onClick={() => setActiveTab("sms-smtp")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "sms-smtp"
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              SMS & SMTP Settings
            </button>
            <button
              onClick={() => setActiveTab("logo")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "logo"
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Logo Settings
            </button>
            <button
              onClick={() => setActiveTab("theme")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "theme"
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Theme Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === "system" && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {systemMessage && (
                <div className={`mb-6 p-4 rounded-lg ${
                  systemMessage.type === 'success' 
                    ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                    : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                }`}>
                  {systemMessage.text}
                </div>
              )}
              
              {systemLoading ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <ThemedLoader 
                    size={80} 
                    className="text-brand-500" 
                    label="Loading system settings"
                    title="Loading System Settings"
                    description="Please wait while we load your system configuration..."
                    showProgress={true}
                  />
                </div>
              ) : (
                <form onSubmit={handleSystemSettingsSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column - System Settings fields from MasterSettings */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          System Name *
                        </label>
                        <input
                          type="text"
                          value={systemSettings.system_name}
                          onChange={(e) => setSystemSettings({...systemSettings, system_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Address
                        </label>
                        <input
                          type="text"
                          value={systemSettings.address}
                          onChange={(e) => setSystemSettings({...systemSettings, address: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          System Email *
                        </label>
                        <input
                          type="email"
                          value={systemSettings.system_email}
                          onChange={(e) => setSystemSettings({...systemSettings, system_email: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Facebook URL
                        </label>
                        <input
                          type="text"
                          value={systemSettings.facebook}
                          onChange={(e) => setSystemSettings({...systemSettings, facebook: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          YouTube URL
                        </label>
                        <input
                          type="text"
                          value={systemSettings.youtube}
                          onChange={(e) => setSystemSettings({...systemSettings, youtube: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Privacy Policy URL
                        </label>
                        <input
                          type="text"
                          value={systemSettings.privacy}
                          onChange={(e) => setSystemSettings({...systemSettings, privacy: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Two Way Authentication
                        </label>
                        <select
                          value={systemSettings.two_way_auth}
                          onChange={(e) => setSystemSettings({...systemSettings, two_way_auth: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="">Select One Option</option>
                          <option value="0">YES</option>
                          <option value="1">NO</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Trigger Update
                        </label>
                        <select
                          value={systemSettings.trigger_update}
                          onChange={(e) => setSystemSettings({...systemSettings, trigger_update: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="">Select One Option</option>
                          <option value="1">YES</option>
                          <option value="0">NO</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Bot Processed Name
                        </label>
                        <input
                          type="text"
                          value={systemSettings.bot_process_name}
                          onChange={(e) => setSystemSettings({...systemSettings, bot_process_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Ktech SSO Client Id
                        </label>
                        <input
                          type="text"
                          value={systemSettings.ktech_SSO_clientId}
                          onChange={(e) => setSystemSettings({...systemSettings, ktech_SSO_clientId: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                    </div>
                    
                    {/* Right Column */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          System Title
                        </label>
                        <input
                          type="text"
                          value={systemSettings.system_title}
                          onChange={(e) => setSystemSettings({...systemSettings, system_title: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Mobile
                        </label>
                        <input
                          type="text"
                          value={systemSettings.mobile}
                          onChange={(e) => setSystemSettings({...systemSettings, mobile: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Email Password
                        </label>
                        <input
                          type="password"
                          value={systemSettings.email_password}
                          onChange={(e) => setSystemSettings({...systemSettings, email_password: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Twitter URL
                        </label>
                        <input
                          type="text"
                          value={systemSettings.twiter}
                          onChange={(e) => setSystemSettings({...systemSettings, twiter: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Skype
                        </label>
                        <input
                          type="text"
                          value={systemSettings.skype}
                          onChange={(e) => setSystemSettings({...systemSettings, skype: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Terms & Conditions URL
                        </label>
                        <input
                          type="text"
                          value={systemSettings.terms}
                          onChange={(e) => setSystemSettings({...systemSettings, terms: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <SearchableMultiSelect
                          label="Two Way Authentication Except Roles"
                          options={roles.map(role => ({ value: role.ROLE_KEY, label: role.ROLE_NAME }))}
                          value={selectedAuthRoles}
                          onChange={setSelectedAuthRoles}
                          placeholder="Select roles to exclude..."
                          searchPlaceholder="Search roles..."
                          maxHeight="200px"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Trigger Update Emails
                        </label>
                        <div className="space-y-2">
                          <div className="flex">
                            <input
                              type="email"
                              value={newTriggerEmail}
                              onChange={(e) => setNewTriggerEmail(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTriggerEmail())}
                              placeholder="Enter email and press Enter"
                              className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                            />
                            <button
                              type="button"
                              onClick={addTriggerEmail}
                              className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
                            >
                              Add
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {triggerEmails.map(email => (
                              <div key={email} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {email}
                                <button
                                  type="button"
                                  onClick={() => removeTriggerEmail(email)}
                                  className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Developer Email
                        </label>
                        <input
                          type="email"
                          value={systemSettings.Develper_mail}
                          onChange={(e) => setSystemSettings({...systemSettings, Develper_mail: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Ktech SSO TenantId
                        </label>
                        <input
                          type="text"
                          value={systemSettings.ktech_SSO_tenantId}
                          onChange={(e) => setSystemSettings({...systemSettings, ktech_SSO_tenantId: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Ktech SSO Client Secret
                        </label>
                        <input
                          type="password"
                          value={systemSettings.ktech_SSO_client_secret}
                          onChange={(e) => setSystemSettings({...systemSettings, ktech_SSO_client_secret: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      type="submit"
                      disabled={systemSaving}
                    >
                      {systemSaving ? "Saving..." : "Update System Settings"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === "sms-smtp" && (
            <div className="space-y-6">
              {systemMessage && (
                <div className={`p-4 rounded-lg ${
                  systemMessage.type === 'success' 
                    ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                    : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                }`}>
                  {systemMessage.text}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SMS Settings */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">SMS Settings</h3>
                  <form onSubmit={handleSmsSettingsSubmit}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          User Name
                        </label>
                        <input
                          type="text"
                          value={smsSettings.sms_username}
                          onChange={(e) => setSmsSettings({...smsSettings, sms_username: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          SMS Sender
                        </label>
                        <input
                          type="text"
                          value={smsSettings.sms_sender}
                          onChange={(e) => setSmsSettings({...smsSettings, sms_sender: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          SMS Hash
                        </label>
                        <input
                          type="text"
                          value={smsSettings.sms_hash}
                          onChange={(e) => setSmsSettings({...smsSettings, sms_hash: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <Button type="submit" disabled={systemSaving}>
                        {systemSaving ? 'Saving...' : 'Update SMS Settings'}
                      </Button>
                    </div>
                  </form>
                </div>

                {/* SMTP Settings */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">SMTP Settings</h3>
                  <form onSubmit={handleSmtpSettingsSubmit}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Port
                        </label>
                        <input
                          type="text"
                          value={smtpSettings.smtp_port}
                          onChange={(e) => setSmtpSettings({...smtpSettings, smtp_port: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Host
                        </label>
                        <input
                          type="text"
                          value={smtpSettings.smtp_host}
                          onChange={(e) => setSmtpSettings({...smtpSettings, smtp_host: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          User Name
                        </label>
                        <input
                          type="text"
                          value={smtpSettings.smtp_username}
                          onChange={(e) => setSmtpSettings({...smtpSettings, smtp_username: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          SMTP Password
                        </label>
                        <input
                          type="password"
                          value={smtpSettings.smtp_password}
                          onChange={(e) => setSmtpSettings({...smtpSettings, smtp_password: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      <Button type="submit" disabled={systemSaving}>
                        {systemSaving ? 'Saving...' : 'Update SMTP Settings'}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {activeTab === "logo" && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {systemMessage && (
                <div className={`mb-6 p-4 rounded-lg ${
                  systemMessage.type === 'success' 
                    ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                    : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                }`}>
                  {systemMessage.text}
                </div>
              )}
              
              <form onSubmit={handleLogoSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Main Logo */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Main Logo</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Upload Main Logo
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleLogoFileChange('BLACK_LOGO', e.target.files?.[0] || null)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      {logoPreviews.blackLogo && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Preview:</p>
                          <img 
                            src={logoPreviews.blackLogo} 
                            alt="Main logo preview" 
                            className="max-w-xs h-auto border border-gray-300 dark:border-gray-600 rounded"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Small Logo */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Small Logo</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Upload Small Logo
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleLogoFileChange('SMALL_LOGO', e.target.files?.[0] || null)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                      {logoPreviews.smallLogo && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Preview:</p>
                          <img 
                            src={logoPreviews.smallLogo} 
                            alt="Small logo preview" 
                            className="max-w-xs h-auto border border-gray-300 dark:border-gray-600 rounded"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    type="submit"
                    disabled={systemSaving || (!logoFiles.BLACK_LOGO && !logoFiles.SMALL_LOGO)}
                  >
                    {systemSaving ? "Uploading..." : "Upload Logos"}
                  </Button>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Upload at least one logo (Main or Small) to update
                  </p>
                </div>
              </form>
            </div>
          )}

          {activeTab === "theme" && (
            <div className="space-y-6">
              {/* Primary Color Section */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
                  Primary Color
                </h3>
                <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                  Choose your primary brand color. This will be used throughout the application.
                </p>

                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Color Picker
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="h-12 w-32 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600"
                    />
                    <input
                      type="text"
                      value={selectedColor}
                      onChange={handleColorInputChange}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                    <Button onClick={handleResetColor} variant="outline">
                      Reset
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Quick Select
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => handleColorChange(color.value)}
                        className={`h-10 w-10 rounded-lg border-2 transition-all ${
                          selectedColor === color.value
                            ? "border-brand-500 scale-110 shadow-lg"
                            : "border-gray-300 hover:scale-105 dark:border-gray-600"
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Logo Section */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
                  Logos
                </h3>
                <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                  Upload and manage your application logos for different contexts.
                </p>

                <div className="space-y-6">
                  {/* Main Logo */}
                  <div>
                    <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Main Logo
                    </label>
                    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                      <div className="flex h-16 w-32 items-center justify-center rounded-lg bg-white p-3 dark:bg-gray-900">
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/logo/logo.svg";
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Logo Preview
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Recommended: 220x40px
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload(file, "main");
                          }}
                          className="hidden"
                        />
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="whitespace-nowrap"
                        >
                          Upload
                        </Button>
                        <Button
                          onClick={() => handleResetLogo("main")}
                          variant="outline"
                          className="whitespace-nowrap"
                        >
                          Reset
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Light Logo */}
                  <div>
                    <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Light Mode Logo
                    </label>
                    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                      <div className="flex h-16 w-32 items-center justify-center rounded-lg bg-white p-3 dark:bg-gray-900">
                        <img
                          src={logoLightPreview}
                          alt="Light Logo"
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/logo/connors-color.png";
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Logo Preview
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Recommended: 220x40px
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={fileLightInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload(file, "light");
                          }}
                          className="hidden"
                        />
                        <Button
                          onClick={() => fileLightInputRef.current?.click()}
                          disabled={uploading}
                          className="whitespace-nowrap"
                        >
                          Upload
                        </Button>
                        <Button
                          onClick={() => handleResetLogo("light")}
                          variant="outline"
                          className="whitespace-nowrap"
                        >
                          Reset
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Dark Logo */}
                  <div>
                    <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Dark Mode Logo
                    </label>
                    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                      <div className="flex h-16 w-32 items-center justify-center rounded-lg bg-white p-3 dark:bg-gray-900">
                        <img
                          src={logoDarkPreview}
                          alt="Dark Logo"
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/logo/connors-white.png";
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Logo Preview
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Recommended: 220x40px
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={fileDarkInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload(file, "dark");
                          }}
                          className="hidden"
                        />
                        <Button
                          onClick={() => fileDarkInputRef.current?.click()}
                          disabled={uploading}
                          className="whitespace-nowrap"
                        >
                          Upload
                        </Button>
                        <Button
                          onClick={() => handleResetLogo("dark")}
                          variant="outline"
                          className="whitespace-nowrap"
                        >
                          Reset
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Icon Logo (Collapsed Sidebar) */}
                  <div>
                    <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Sidebar Icon (Collapsed)
                    </label>
                    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white p-3 dark:bg-gray-900">
                        <img
                          src={logoIconPreview}
                          alt="Logo Icon"
                          className="h-12 w-12 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/images/logo/logo-icon.svg";
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Icon Preview
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Recommended: 32x32px (Square)
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={fileIconInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload(file, "icon");
                          }}
                          className="hidden"
                        />
                        <Button
                          onClick={() => fileIconInputRef.current?.click()}
                          disabled={uploading}
                          className="whitespace-nowrap"
                        >
                          Upload
                        </Button>
                        <Button
                          onClick={() => handleResetLogo("icon")}
                          variant="outline"
                          className="whitespace-nowrap"
                        >
                          Reset
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Header Colors Section */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
                  Header Colors
                </h3>
                <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                  Customize header background and text colors.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Background Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={headerBgColor}
                        onChange={async (e) => {
                          setHeaderBgColor(e.target.value);
                          await saveSettings({ headerBgColor: e.target.value });
                        }}
                        className="h-12 w-32 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600"
                      />
                      <input
                        type="text"
                        value={headerBgColor}
                        onChange={async (e) => {
                          setHeaderBgColor(e.target.value);
                          await saveSettings({ headerBgColor: e.target.value });
                        }}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      />
                      <Button onClick={applyDerivedColors} variant="outline">
                        Apply from Primary
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Text Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={headerTextColor}
                        onChange={async (e) => {
                          setHeaderTextColor(e.target.value);
                          await saveSettings({ headerTextColor: e.target.value });
                        }}
                        className="h-12 w-32 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600"
                      />
                      <input
                        type="text"
                        value={headerTextColor}
                        onChange={async (e) => {
                          setHeaderTextColor(e.target.value);
                          await saveSettings({ headerTextColor: e.target.value });
                        }}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                  </div>
                  <Button onClick={handleResetColors} variant="outline">
                    Reset to Defaults
                  </Button>
                </div>
              </div>

              {/* Sidebar Colors Section */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
                  Sidebar Colors
                </h3>
                <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                  Customize sidebar background and text colors.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Background Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={sidebarBgColor}
                        onChange={async (e) => {
                          setSidebarBgColor(e.target.value);
                          await saveSettings({ sidebarBgColor: e.target.value });
                        }}
                        className="h-12 w-32 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600"
                      />
                      <input
                        type="text"
                        value={sidebarBgColor}
                        onChange={async (e) => {
                          setSidebarBgColor(e.target.value);
                          await saveSettings({ sidebarBgColor: e.target.value });
                        }}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      />
                      <Button onClick={applyDerivedColors} variant="outline">
                        Apply from Primary
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Text Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={sidebarTextColor}
                        onChange={async (e) => {
                          setSidebarTextColor(e.target.value);
                          await saveSettings({ sidebarTextColor: e.target.value });
                        }}
                        className="h-12 w-32 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600"
                      />
                      <input
                        type="text"
                        value={sidebarTextColor}
                        onChange={async (e) => {
                          setSidebarTextColor(e.target.value);
                          await saveSettings({ sidebarTextColor: e.target.value });
                        }}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                  </div>
                  <Button onClick={handleResetColors} variant="outline">
                    Reset to Defaults
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}
