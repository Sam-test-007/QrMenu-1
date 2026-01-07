import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Supabase will set the session automatically when the user clicks the link,
  // but depending on the auth settings we may need to handle the token from URL.
  useEffect(() => {
    // Parse access_token/type from URL (Supabase sends them in the hash)
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const params = new URLSearchParams(
      hash.startsWith("#") ? `?${hash.slice(1)}` : search
    );
    const type = params.get("type");
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (type === "recovery" && access_token) {
      (async () => {
        setLoading(true);
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token || undefined,
          });
          if (error) throw error;

          // remove tokens from URL for security
          try {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          } catch (e) {
            // ignore
          }

          toast({
            title: "Ready",
            description: "You may now set a new password.",
          });
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message || "Unable to establish session.",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      })();
    }
  }, []);

  async function handleUpdate() {
    if (!password) {
      toast({
        title: "Error",
        description: "Please enter a new password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Update the user's password. supabase.auth.updateUser requires the user to be authenticated.
      // If the session wasn't set by the redirect, Supabase shows a form in the hosted page.
      // Here we try to update via SDK; if it fails, show an error instructing to use the email link.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({
        title: "Success",
        description:
          "Password updated. You can now sign in with your new password.",
      });
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.message ||
          "Unable to update password. Please use the link from your email.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-50 to-white">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Reset Password
          </h2>
          <p className="text-gray-600">
            Enter a new password to update your account.
          </p>
        </div>

        <div className="bg-white shadow-xl rounded-lg p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2"
              />
            </div>

            <Button
              onClick={handleUpdate}
              className="w-full"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update password"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
