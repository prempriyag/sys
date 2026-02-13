import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE_URL, API_ENDPOINTS, getAuthToken } from "../../config/api";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  category: string;
  link: string;
  is_read: boolean;
  is_global: boolean;
  created_at: string;
  created_by: string;
}

// Type badge colours
const TYPE_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  info: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-600 dark:text-blue-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  success: {
    bg: "bg-green-100 dark:bg-green-900/40",
    text: "text-green-600 dark:text-green-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  warning: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-600 dark:text-amber-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
  },
  error: {
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-600 dark:text-red-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

/**
 * Safe fetch that never redirects on error – notifications should fail silently.
 * Returns parsed JSON or null on any failure.
 */
async function notificationFetch(endpoint: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<any | null> {
  try {
    const token = getAuthToken();
    if (!token) {
      console.warn("[Notifications] No auth token found – skipping fetch");
      return null;
    }
    const url = `${API_BASE_URL}${endpoint}`;
    console.debug(`[Notifications] ${method} ${url}`);
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      console.warn(`[Notifications] ${method} ${endpoint} returned ${res.status} ${res.statusText}`);
      try {
        const errBody = await res.clone().text();
        console.warn("[Notifications] Response body:", errBody);
      } catch { /* ignore */ }
      return null;
    }
    const data = await res.json();
    console.debug(`[Notifications] ${method} ${endpoint} =>`, data);
    return data;
  } catch (err) {
    console.error("[Notifications] Fetch error:", err);
    return null;
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Fetch unread count (lightweight, for badge) ---- //
  // Commented out - endpoint disabled for now
  // const fetchUnreadCount = useCallback(async () => {
  //   const data = await notificationFetch(API_ENDPOINTS.NOTIFICATIONS_UNREAD_COUNT);
  //   if (data) setUnreadCount(data.unread_count ?? 0);
  // }, []);

  // ---- Fetch full notification list ---- //
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const data = await notificationFetch(`${API_ENDPOINTS.NOTIFICATIONS_LIST}?limit=25`);
    if (data) {
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
    }
    setLoading(false);
  }, []);

  // ---- Poll unread count every 60 seconds ---- //
  // Commented out - endpoint disabled for now
  // useEffect(() => {
  //   fetchUnreadCount(); // initial
  //   pollRef.current = setInterval(fetchUnreadCount, 60_000);
  //   return () => {
  //     if (pollRef.current) clearInterval(pollRef.current);
  //   };
  // }, [fetchUnreadCount]);

  // ---- Fetch list when dropdown opens ---- //
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  // ---- Close on outside click ---- //
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // ---- Trigger notification jobs now (generate fresh notifications) ---- //
  const triggerNow = async () => {
    setLoading(true);
    await notificationFetch(API_ENDPOINTS.NOTIFICATIONS_TRIGGER_NOW, "POST");
    // Small delay to let DB write complete, then refresh
    setTimeout(() => fetchNotifications(), 500);
  };

  // ---- Mark single as read ---- //
  const markAsRead = async (id: number) => {
    const res = await notificationFetch(API_ENDPOINTS.NOTIFICATIONS_MARK_READ, "POST", { notification_id: id });
    if (res) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  // ---- Mark all as read ---- //
  const markAllRead = async () => {
    const res = await notificationFetch(API_ENDPOINTS.NOTIFICATIONS_MARK_ALL_READ, "POST");
    if (res) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  // ---- Click on a notification row ---- //
  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.link) {
      setIsOpen(false);
      window.location.href = n.link;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute -right-[240px] sm:right-0 mt-[17px] flex w-[380px] flex-col rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark z-[99999]"
          style={{ maxHeight: "520px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-brand-500 px-2 py-0.5 text-xs font-medium text-white">
                  {unreadCount}
                </span>
              )}
            </h5>
            <div className="flex items-center gap-2">
              <button
                onClick={triggerNow}
                disabled={loading}
                className="text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors disabled:opacity-40"
                title="Refresh notifications"
              >
                <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* List */}
          <ul className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: "420px" }}>
            {loading && notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-400">Loading...</li>
            ) : notifications.length === 0 ? (
              <li className="px-4 py-12 text-center">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">You're all caught up!</p>
              </li>
            ) : (
              notifications.map((n) => {
                const style = TYPE_STYLES[n.type] || TYPE_STYLES.info;
                return (
                  <li
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800 cursor-pointer transition-colors
                      ${n.is_read
                        ? "bg-white dark:bg-gray-dark hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        : "bg-brand-25 dark:bg-brand-500/5 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                      }`}
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${style.bg} ${style.text}`}>
                      {style.icon}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${
                          n.is_read
                            ? "text-gray-700 dark:text-gray-300"
                            : "font-semibold text-gray-900 dark:text-white"
                        }`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="mt-1.5 flex-shrink-0 h-2 w-2 rounded-full bg-brand-500" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                        <span>{timeAgo(n.created_at)}</span>
                        {n.category && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                            <span className="capitalize">{n.category.replace("_", " ")}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2.5">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Could navigate to a full notifications page in the future
                }}
                className="w-full text-center text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors"
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
