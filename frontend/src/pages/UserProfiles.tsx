import { useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import UserMetaCard from "../components/UserProfile/UserMetaCard";
import UserInfoCard from "../components/UserProfile/UserInfoCard";
import UserAddressCard from "../components/UserProfile/UserAddressCard";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../context/AuthContext";
import { api, API_ENDPOINTS } from "../config/api";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  location?: string;
  bio?: string;
  avatar?: string;
  role_id: number;
  status: number;
}

export default function UserProfiles() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        // You can adjust the endpoint based on your backend API
        // For now, we'll use the user data from auth context
        const profileData: UserProfile = {
          id: user.id,
          name: user.name || "User",
          email: user.email || "",
          phone: undefined,
          designation: "Team Member",
          location: "United States",
          bio: "Professional user profile",
          avatar: undefined,
          role_id: user.role_id,
          status: user.status,
        };
        
        setProfile(profileData);
      } catch (error) {
        console.error("Error fetching profile:", error);
        setProfile({
          id: user?.id || 0,
          name: user?.name || "User",
          email: user?.email || "",
          role_id: user?.role_id || 0,
          status: user?.status || 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  if (loading) {
    return (
      <>
        <PageMeta
          title="User Profile | OSUCSC"
          description="User profile page"
        />
        <PageBreadcrumb pageTitle="Profile" />
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 lg:p-6">
          <p className="text-gray-500 dark:text-gray-400">Loading profile...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title="User Profile | OSUCSC"
        description="User profile page with account information and settings"
      />
      <PageBreadcrumb pageTitle="Profile" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
          Profile
        </h3>
        <div className="space-y-6">
          {profile && (
            <>
              <UserMetaCard userData={profile} />
              <UserInfoCard userData={profile} />
              <UserAddressCard userData={profile} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
