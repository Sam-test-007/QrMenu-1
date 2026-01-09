import { useState, useRef } from "react";
import { useLocation } from "wouter";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Mail, Lock } from "lucide-react";

export default function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const captchaRef = useRef<HCaptcha>(null);

  async function handleSignUp() {
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Email and password are required",
        variant: "destructive",
      });
      return;
    }

    if (!captchaToken) {
      toast({
        title: "Error",
        description: "Please complete the CAPTCHA",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          captchaToken,
        },
      });

      if (error) throw error;

      // Create profile for the new user if auto-confirmation is enabled
      if (data.user && !data.user.email_confirmed_at) {
        toast({
          title: "Success",
          description: "Check your email for the confirmation link!",
        });
      } else if (data.user) {
        // If auto-confirmation is enabled, create profile immediately
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: data.user.id,
            full_name:
              data.user.email || data.user.user_metadata?.full_name || null,
          })
          .select();

        if (profileError) {
          console.warn("Profile creation warning:", profileError);
        }

        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      // Reset captcha on error
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Email and password are required",
        variant: "destructive",
      });
      return;
    }

    if (!captchaToken) {
      toast({
        title: "Error",
        description: "Please complete the CAPTCHA",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken,
        },
      });

      if (error) throw error;

      // Create profile if it doesn't exist
      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: data.user.id,
            full_name:
              data.user.email || data.user.user_metadata?.full_name || null,
          })
          .select();

        if (profileError) {
          console.warn("Profile creation warning:", profileError);
        }
      }

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      // Reset captcha on error
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address to reset your password",
        variant: "destructive",
      });
      return;
    }

    if (!captchaToken) {
      toast({
        title: "Error",
        description: "Please complete the CAPTCHA",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
        captchaToken,
      });
      if (error) throw error;

      toast({
        title: "Check your inbox",
        description:
          "If an account exists for that email, a password reset link has been sent.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to send reset link",
        variant: "destructive",
      });
      // Reset captcha on error
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-50 to-white">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-xl flex items-center justify-center mb-6">
            <QrCode className="text-white text-2xl h-8 w-8" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            QR Menu SaaS
          </h2>
          <p className="text-gray-600">
            Manage your restaurant menus with ease
          </p>
        </div>

        <Card className="shadow-xl border-gray-100">
          <CardHeader className="pb-4">
            <CardTitle className="sr-only">Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin" data-testid="tab-signin">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" data-testid="tab-signup">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4">
                <div>
                  <Label htmlFor="signin-email">Email address</Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative mt-2">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-password"
                    />
                  </div>
                </div>

                <div className="flex justify-center py-4">
                  <HCaptcha
                    ref={captchaRef}
                    sitekey={import.meta.env.VITE_HCAPTCHA_SITEKEY || ""}
                    onVerify={(token) => setCaptchaToken(token)}
                    onError={() => {
                      setCaptchaToken(null);
                      toast({
                        title: "CAPTCHA Error",
                        description:
                          "Failed to verify CAPTCHA. Please try again.",
                        variant: "destructive",
                      });
                    }}
                  />
                </div>

                <Button
                  onClick={handleSignIn}
                  className="w-full"
                  disabled={loading}
                  data-testid="button-signin"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="text-sm text-primary-600 hover:underline"
                    data-testid="button-forgot-password"
                  >
                    Forgot password?
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <div>
                  <Label htmlFor="signup-email">Email address</Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-email-signup"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative mt-2">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Enter your password"
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-password-signup"
                    />
                  </div>
                </div>

                <div className="flex justify-center py-4">
                  <HCaptcha
                    ref={captchaRef}
                    sitekey={import.meta.env.VITE_HCAPTCHA_SITEKEY || ""}
                    onVerify={(token) => setCaptchaToken(token)}
                    onError={() => {
                      setCaptchaToken(null);
                      toast({
                        title: "CAPTCHA Error",
                        description:
                          "Failed to verify CAPTCHA. Please try again.",
                        variant: "destructive",
                      });
                    }}
                  />
                </div>

                <Button
                  onClick={handleSignUp}
                  className="w-full"
                  disabled={loading}
                  data-testid="button-signup"
                >
                  {loading ? "Signing up..." : "Sign Up"}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
