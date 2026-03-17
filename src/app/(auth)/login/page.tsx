"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CommandIcon, ArrowLeftIcon } from "lucide-react";

type Status = "email" | "sending" | "otp" | "verifying" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<Status>("email");
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });

    if (error) {
      setStatus("error");
      setErrorMessage(
        error.message || "No account found — you need an invitation to access this app."
      );
    } else {
      setStatus("otp");
    }
  };

  const handleVerifyOTP = async (code: string) => {
    setStatus("verifying");
    setErrorMessage("");

    const { error } = await authClient.signIn.emailOtp({
      email,
      otp: code,
    });

    if (error) {
      setStatus("otp");
      setErrorMessage(error.message || "Invalid or expired code. Please try again.");
      setOtp("");
    } else {
      // Set the active organization before redirecting to dashboard
      try {
        const res = await fetch("/api/auth/organization/list", {
          credentials: "include",
        });
        if (res.ok) {
          const orgs = await res.json();
          if (Array.isArray(orgs) && orgs.length > 0) {
            await authClient.organization.setActive({ organizationId: orgs[0].id });
          }
        }
      } catch {
        // AppSidebar has a fallback that will set the org
      }
      router.push("/dashboard");
    }
  };

  const handleOtpChange = (value: string) => {
    setOtp(value);
    if (value.length === 6) {
      handleVerifyOTP(value);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center gap-2 mb-6">
        <CommandIcon className="size-8 text-primary" />
        <h1 className="text-xl font-bold">Social Media Manager</h1>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>
            {status === "otp" || status === "verifying"
              ? `Enter the 6-digit code sent to ${email}`
              : "Enter your email to receive a sign-in code"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "otp" || status === "verifying" ? (
            <div className="flex flex-col items-center gap-4">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={handleOtpChange}
                disabled={status === "verifying"}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>

              {status === "verifying" && (
                <p className="text-sm text-muted-foreground">Verifying...</p>
              )}

              {errorMessage && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatus("email");
                    setOtp("");
                    setErrorMessage("");
                  }}
                >
                  <ArrowLeftIcon className="size-4 mr-1" />
                  Change email
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    setOtp("");
                    setErrorMessage("");
                    await authClient.emailOtp.sendVerificationOtp({
                      email,
                      type: "sign-in",
                    });
                  }}
                >
                  Resend code
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === "sending"}
                />
              </div>

              {errorMessage && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={status === "sending"}
              >
                {status === "sending" ? "Sending..." : "Continue"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
