"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CommandIcon } from "lucide-react";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/dashboard",
    });

    if (error) {
      setStatus("error");
      setErrorMessage(
        error.message || "No account found — you need an invitation to access this app."
      );
    } else {
      setStatus("sent");
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
            Enter your email to receive a magic link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {urlError && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {urlError === "expired"
                ? "Link expired — request a new one."
                : "Invalid link — please try again."}
            </div>
          )}

          {status === "sent" ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Check your email for a sign-in link.
              </p>
              <p className="text-xs text-muted-foreground">
                Sent to <strong>{email}</strong>
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatus("idle")}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {status === "error" && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={status === "sending"}
              >
                {status === "sending" ? "Sending..." : "Send magic link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
