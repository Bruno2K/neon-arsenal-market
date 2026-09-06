import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { track, type AnalyticsRole } from "@/lib/analytics";

export function PageViewTracker() {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    const role: AnalyticsRole = user?.role ?? "guest";
    track("page_view", { path: location.pathname, role });
  }, [location.pathname, isLoading, user?.role]);

  return null;
}
