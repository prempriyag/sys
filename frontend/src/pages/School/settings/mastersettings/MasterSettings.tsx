import React, { useState, useEffect } from "react";
import { api } from "../../../../config/api";
import PageContainer from "../../../../components/common/PageContainer";
import { alertsuccess, alerterror } from "../../../../utils/toast";

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

const MasterSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'system' | 'sms-smtp' | 'logo'>('system');
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
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedAuthRoles, setSelectedAuthRoles] = useState<string[]>([]);
  const [triggerEmails, setTriggerEmails] = useState<string[]>([]);
  const [newTriggerEmail, setNewTriggerEmail] = useState('');
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
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch system settings
      const settingsResponse = await api.get("/api/mastersettings/get");
      if (settingsResponse.status === 1 && settingsResponse.data) {
        setSystemSettings(prev => ({
          ...prev,
          ...settingsResponse.data
        }));
        
        // Parse selected auth roles
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
        
        // Parse trigger emails
        if (settingsResponse.data.trigger_update_mail) {
          setTriggerEmails(settingsResponse.data.trigger_update_mail.split(','));
        }
      }
      
      // Fetch SMS settings
      const smsResponse = await api.get("/api/settings/sms");
      if (smsResponse.status === 1 && smsResponse.data) {
        setSmsSettings(smsResponse.data);
      }
      
      // Fetch SMTP settings
      const smtpResponse = await api.get("/api/settings/smtp");
      if (smtpResponse.status === 1 && smtpResponse.data) {
        setSmtpSettings(smtpResponse.data);
      }
      
      // Fetch roles for dropdown
      const rolesResponse = await api.get("/api/roles/list");
      if (rolesResponse.status === 1) {
        setRoles(rolesResponse.data || []);
      }
      
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      alerterror(error.message || "Error fetching settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSystemSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Prepare data with JSON string for arrays
      const dataToSend = {
        ...systemSettings,
        two_way_auth_exept: JSON.stringify(selectedAuthRoles),
        trigger_update_mail: triggerEmails.join(',')
      };
      
      const response = await api.post("/api/mastersettings/update", dataToSend);
      
      if (response.status === 1) {
        alertsuccess(response.message);
      } else {
        alerterror(response.message);
      }
    } catch (error: any) {
      alerterror(error.message || "Error updating settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSmsSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const response = await api.post("/api/settings/sms/update", smsSettings);
      
      if (response.status === 1) {
        alertsuccess(response.message);
      } else {
        alerterror(response.message);
      }
    } catch (error: any) {
      alerterror(error.message || "Error updating SMS settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSmtpSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const response = await api.post("/api/settings/smtp/update", smtpSettings);
      
      if (response.status === 1) {
        alertsuccess(response.message);
      } else {
        alerterror(response.message);
      }
    } catch (error: any) {
      alerterror(error.message || "Error updating SMTP settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const formData = new FormData();
      
      if (logoFiles.BLACK_LOGO) {
        formData.append('BLACK_LOGO', logoFiles.BLACK_LOGO);
      }
      
      if (logoFiles.SMALL_LOGO) {
        formData.append('SMALL_LOGO', logoFiles.SMALL_LOGO);
      }
      
      const response = await api.post("/api/settings/logo/update", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.status === 1) {
        alertsuccess(response.message);
        // Reset files after successful upload
        setLogoFiles({ BLACK_LOGO: null, SMALL_LOGO: null });
        setLogoPreviews({ blackLogo: '', smallLogo: '' });
      } else {
        alerterror(response.message);
      }
    } catch (error: any) {
      alerterror(error.message || "Error uploading logos");
    } finally {
      setSaving(false);
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
      <PageContainer>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading settings...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Global Configurations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Configure system settings, SMS/SMTP, and logos
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('system')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'system'
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                System Settings
              </button>
              <button
                onClick={() => setActiveTab('sms-smtp')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'sms-smtp'
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                SMS & SMTP Settings
              </button>
              <button
                onClick={() => setActiveTab('logo')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'logo'
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Logo
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* System Settings Tab */}
            {activeTab === 'system' && (
              <form onSubmit={handleSystemSettingsSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column */}
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Two Way Authentication Except Roles
                      </label>
                      <div className="border border-gray-300 dark:border-gray-600 rounded-md p-2 max-h-40 overflow-y-auto">
                        {roles.map(role => (
                          <div key={role.ROLE_KEY} className="flex items-center mb-2">
                            <input
                              type="checkbox"
                              id={`role-${role.ROLE_KEY}`}
                              checked={selectedAuthRoles.includes(role.ROLE_KEY)}
                              onChange={() => handleRoleToggle(role.ROLE_KEY)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor={`role-${role.ROLE_KEY}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                              {role.ROLE_NAME}
                            </label>
                          </div>
                        ))}
                      </div>
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
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Update System Settings
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* SMS & SMTP Settings Tab */}
            {activeTab === 'sms-smtp' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SMS Settings */}
                <div className="bg-gray-50 dark:bg-gray-700/30 p-6 rounded-lg">
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
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? 'Saving...' : 'Update SMS Settings'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* SMTP Settings */}
                <div className="bg-gray-50 dark:bg-gray-700/30 p-6 rounded-lg">
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
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? 'Saving...' : 'Update SMTP Settings'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Logo Tab */}
            {activeTab === 'logo' && (
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
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
                  <button
                    type="submit"
                    disabled={saving || (!logoFiles.BLACK_LOGO && !logoFiles.SMALL_LOGO)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload Logos
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Upload at least one logo (Main or Small) to update
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default MasterSettings;