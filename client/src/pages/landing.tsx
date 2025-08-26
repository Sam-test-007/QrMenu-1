import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white p-6">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-6">
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-12 w-12 bg-primary-600 rounded-xl flex items-center justify-center">
                <QrCode className="text-white h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl">QR Menu SaaS</CardTitle>
              </div>
            </div>
            <p className="text-gray-600">
              Create contactless, editable menus for your restaurant. Sign in to manage your menu and generate QR links.
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild data-testid="button-get-started">
              <Link to="/auth">Get started (owner)</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2">
              <li>Sign up / sign in as owner</li>
              <li>Create a restaurant (slug)</li>
              <li>Add items and generate QR link</li>
              <li>Guests scan the QR and place quantities — they see the total bill</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
