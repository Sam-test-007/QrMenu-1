import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import AdminDashboard from "@/components/admin-dashboard";
import ProfileCompletionDialog from "@/components/profile-completion-dialog";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    async function checkProfileCompletion() {
      if (!user) return;

      try {
        setProfileLoading(true);
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("full_name, phone_number")
          .eq("id", user.id)
          .single();

        if (error) {
          // Profile doesn't exist yet
          setShowProfileDialog(true);
          setProfileLoading(false);
          return;
        }

        // Check if profile is incomplete
        if (!profile?.full_name || !profile?.phone_number) {
          setShowProfileDialog(true);
        }
      } catch (error) {
        console.error("Error checking profile:", error);
        setShowProfileDialog(true);
      } finally {
        setProfileLoading(false);
      }
    }

    checkProfileCompletion();
  }, [user]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <>
      <AdminDashboard />
      <ProfileCompletionDialog
        userId={user.id}
        open={showProfileDialog}
        onComplete={() => setShowProfileDialog(false)}
      />
    </>
  );
}
