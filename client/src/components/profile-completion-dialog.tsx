import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ProfileCompletionDialogProps {
  userId: string;
  open: boolean;
  onComplete: () => void;
}

export default function ProfileCompletionDialog({
  userId,
  open,
  onComplete,
}: ProfileCompletionDialogProps) {
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  function normalizePhone(input: string) {
    const trimmed = input.trim();
    const hasPlusAtStart = trimmed.startsWith("+");
    const digitsOnly = trimmed.replace(/[^\d]/g, "");
    return {
      normalized: `${hasPlusAtStart ? "+" : ""}${digitsOnly}`,
      digitsCount: digitsOnly.length,
      hasPlusAtStart,
      raw: trimmed,
    };
  }

  async function handleSaveProfile() {
    if (!fullName.trim()) {
      toast({
        title: "Error",
        description: "Full name is required",
        variant: "destructive",
      });
      return;
    }

    if (!phoneNumber.trim()) {
      toast({
        title: "Error",
        description: "Phone number is required",
        variant: "destructive",
      });
      return;
    }

    const phoneCheck = normalizePhone(phoneNumber);
    const allowedChars = /^[\d\s\-\+\(\)]+$/;
    if (!allowedChars.test(phoneCheck.raw)) {
      toast({
        title: "Error",
        description:
          "Phone number can only contain digits, spaces, +, -, and parentheses",
        variant: "destructive",
      });
      return;
    }
    const plusCount = (phoneCheck.raw.match(/\+/g) || []).length;
    if (plusCount > 1 || (plusCount === 1 && !phoneCheck.hasPlusAtStart)) {
      toast({
        title: "Error",
        description: "Use a single + at the start of the phone number only",
        variant: "destructive",
      });
      return;
    }
    if (phoneCheck.digitsCount < 10 || phoneCheck.digitsCount > 15) {
      toast({
        title: "Error",
        description: "Phone number must have 10 to 15 digits",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: existingProfile, error: existingError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (existingError) throw existingError;

      const profilePayload = {
        full_name: fullName.trim(),
        phone_number: phoneCheck.normalized,
      };

      const { error } = existingProfile
        ? await supabase.from("profiles").update(profilePayload).eq("id", userId)
        : await supabase.from("profiles").insert({
            id: userId,
            created_at: new Date().toISOString(),
            ...profilePayload,
          });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile completed successfully!",
      });

      onComplete();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}} modal={true}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            We need some information to get started. These fields are required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number *</Label>
            <Input
              id="phoneNumber"
              placeholder="Enter your phone number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={loading}
              type="tel"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            onClick={handleSaveProfile}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
