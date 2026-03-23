import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import Landing from "@/pages/landing";
import Auth from "@/pages/auth";
import ResetPassword from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard";
import Menu from "@/pages/menu";
import NotFound from "@/pages/not-found";
import { Analytics } from "@vercel/analytics/react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={Auth} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/menu/:slug" component={Menu} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path="/" component={Landing} />
            <Route path="/auth" component={Auth} />
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/menu/:slug" component={Menu} />
            <Route component={NotFound} />
          </Switch>
          <Analytics />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
