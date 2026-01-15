import React, { useState, useRef, useEffect } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import PageContainer from "../components/common/PageContainer";
import Button from "../components/ui/button/Button";
import { useThemeColor } from "../context/ThemeColorContext";
import { API_BASE_URL } from "../config/api";

export default function Settings() {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileIconInputRef = useRef<HTMLInputElement>(null);
  const fileLightInputRef = useRef<HTMLInputElement>(null);
  const fileDarkInputRef = useRef<HTMLInputElement>(null);

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
    { name: "Blue", value: "#465fff" },
    { name: "Purple", value: "#7a5af8" },
    { name: "Green", value: "#10b981" },
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f59e0b" },
    { name: "Pink", value: "#ec4899" },
    { name: "Indigo", value: "#6366f1" },
    { name: "Teal", value: "#14b8a6" },
  ];

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    updateThemeColor(color);
  };

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setSelectedColor(color);
    updateThemeColor(color);
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

      // Upload to server (optional)
      const formData = new FormData();
      formData.append("logo", file);
      formData.append("type", type);

      const token = localStorage.getItem("auth_token");
      try {
        const response = await fetch(`${API_BASE_URL}/api/settings/upload-logo`, {
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
              break;
            case "icon":
              setLogoIconUrl(logoUrl as string);
              break;
            case "light":
              setLogoLightUrl(logoUrl as string);
              break;
            case "dark":
              setLogoDarkUrl(logoUrl as string);
              break;
          }
        }
      } catch (error) {
        // Fallback: already saved locally via FileReader
        console.log("Logo saved locally");
      }
    } catch (error) {
      console.error("Error uploading logo:", error);
      alert("Error uploading logo");
    } finally {
      setUploading(false);
    }
  };

  const handleResetColor = () => {
    const defaultColor = "#465fff";
    setSelectedColor(defaultColor);
    updateThemeColor(defaultColor);
  };

  const handleResetLogo = (type: "main" | "icon" | "light" | "dark") => {
    switch (type) {
      case "main":
        setLogoPreview("/images/logo/logo.svg");
        setLogoUrl("/images/logo/logo.svg");
        break;
      case "icon":
        setLogoIconPreview("/images/logo/logo-icon.svg");
        setLogoIconUrl("/images/logo/logo-icon.svg");
        break;
      case "light":
        setLogoLightPreview("/images/logo/connors-color.png");
        setLogoLightUrl("/images/logo/connors-color.png");
        break;
      case "dark":
        setLogoDarkPreview("/images/logo/connors-white.png");
        setLogoDarkUrl("/images/logo/connors-white.png");
        break;
    }
  };

  const handleResetColors = () => {
    setHeaderBgColor("#ffffff");
    setHeaderTextColor("#1d2939");
    setSidebarBgColor("#ffffff");
    setSidebarTextColor("#1d2939");
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

  const applyDerivedColors = () => {
    const derived = getDerivedColors(primaryColor);
    setHeaderBgColor(derived.bg);
    setSidebarBgColor(derived.bg);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Show a temporary success message
      const button = document.getElementById(`copy-${label}`);
      if (button) {
        const originalText = button.textContent;
        button.textContent = "Copied!";
        button.classList.add("bg-green-500");
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove("bg-green-500");
        }, 2000);
      }
    }).catch((err) => {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard");
    });
  };

  return (
    <>
      <PageMeta title="Settings | OSUCSC" description="Application settings and customization" />
      <PageBreadcrumb pageTitle="Settings" />
      <PageContainer>
        <div className="space-y-6">
          {/* Theme Color Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              Theme Color
            </h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              Customize the primary theme color for your application. Changes will be applied immediately.
            </p>

            {/* Color Presets */}
            <div className="mb-6">
              <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Preset Colors
              </label>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => handleColorChange(color.value)}
                    className={`relative h-12 w-full rounded-lg border-2 transition-all hover:scale-110 ${
                      selectedColor === color.value
                        ? "border-gray-900 dark:border-white ring-2 ring-offset-2 ring-brand-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    {selectedColor === color.value && (
                      <svg
                        className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow-lg"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Color Picker */}
            <div className="mb-6">
              <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Custom Color
              </label>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={handleColorInputChange}
                    className="h-12 w-full cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600"
                  />
                </div>
                <input
                  type="text"
                  value={selectedColor}
                  onChange={handleColorInputChange}
                  className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  placeholder="#465fff"
                />
                <Button 
                  id="copy-primaryColor"
                  onClick={() => copyToClipboard(selectedColor, "primaryColor")}
                  variant="outline" 
                  className="whitespace-nowrap"
                >
                  Copy
                </Button>
                <Button onClick={handleResetColor} variant="outline" className="whitespace-nowrap">
                  Reset
                </Button>
              </div>
            </div>

            {/* Current Color Preview */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <div className="flex items-center gap-4">
                <div
                  className="h-12 w-12 rounded-lg border-2 border-gray-300 dark:border-gray-600"
                  style={{ backgroundColor: selectedColor }}
                />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Current Theme Color
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedColor}</p>
                    <button
                      onClick={() => copyToClipboard(selectedColor, "currentColor")}
                      className="rounded p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                      title="Copy color code"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Logo Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              Logo Settings
            </h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              Upload logos for different parts of the application. Recommended formats: PNG, SVG. Max file size: 5MB.
            </p>

            <div className="space-y-6">
              {/* Main Logo (Expanded Sidebar - Light) */}
              <div>
                <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sidebar Logo (Expanded - Light Mode)
                </label>
                <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                  <div className="flex h-16 items-center justify-center rounded-lg bg-white p-3 dark:bg-gray-900">
                    <img
                      src={logoLightPreview}
                      alt="Logo Light"
                      className="max-h-12 max-w-48 object-contain"
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

              {/* Dark Logo (Expanded Sidebar - Dark) */}
              <div>
                <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sidebar Logo (Expanded - Dark Mode)
                </label>
                <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                  <div className="flex h-16 items-center justify-center rounded-lg bg-gray-900 p-3">
                    <img
                      src={logoDarkPreview}
                      alt="Logo Dark"
                      className="max-h-12 max-w-48 object-contain"
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
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
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
                    onChange={(e) => setHeaderBgColor(e.target.value)}
                    className="h-12 w-32 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600"
                  />
                  <input
                    type="text"
                    value={headerBgColor}
                    onChange={(e) => setHeaderBgColor(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <Button 
                    id="copy-headerBgColor"
                    onClick={() => copyToClipboard(headerBgColor, "headerBgColor")}
                    variant="outline" 
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    Copy
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
                    onChange={(e) => setHeaderTextColor(e.target.value)}
                    className="h-12 w-32 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600"
                  />
                  <input
                    type="text"
                    value={headerTextColor}
                    onChange={(e) => setHeaderTextColor(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <Button 
                    id="copy-headerTextColor"
                    onClick={() => copyToClipboard(headerTextColor, "headerTextColor")}
                    variant="outline" 
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Preview
                </p>
                <div
                  className="rounded-lg p-4"
                  style={{ backgroundColor: headerBgColor, color: headerTextColor }}
                >
                  <p className="text-sm">Header Preview Text</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Colors Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
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
                    onChange={(e) => setSidebarBgColor(e.target.value)}
                    className="h-12 w-32 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600"
                  />
                  <input
                    type="text"
                    value={sidebarBgColor}
                    onChange={(e) => setSidebarBgColor(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <Button 
                    id="copy-sidebarBgColor"
                    onClick={() => copyToClipboard(sidebarBgColor, "sidebarBgColor")}
                    variant="outline" 
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    Copy
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
                    onChange={(e) => setSidebarTextColor(e.target.value)}
                    className="h-12 w-32 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600"
                  />
                  <input
                    type="text"
                    value={sidebarTextColor}
                    onChange={(e) => setSidebarTextColor(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <Button 
                    id="copy-sidebarTextColor"
                    onClick={() => copyToClipboard(sidebarTextColor, "sidebarTextColor")}
                    variant="outline" 
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Preview
                </p>
                <div
                  className="rounded-lg p-4"
                  style={{ backgroundColor: sidebarBgColor, color: sidebarTextColor }}
                >
                  <p className="text-sm">Sidebar Preview Text</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={applyDerivedColors} variant="outline">
                  Apply Colors Based on Theme
                </Button>
                <Button onClick={handleResetColors} variant="outline">
                  Reset to Default
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
