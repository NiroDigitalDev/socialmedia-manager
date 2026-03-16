"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getInvitationDetails, acceptInvitationAndSendMagicLink } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CommandIcon } from "lucide-react";

type Status = "loading" | "ready" | "processing" | "sent" | "error";

export default function AcceptInvitationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [invitation, setInvitation] = useState<{
    id: string;
    email: string;
    organizationName: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      const result = await getInvitationDetails(id);
      if ("error" in result) {
        setStatus("error");
        setErrorMessage(result.error!);
      } else {
        setInvitation(result as typeof invitation);
        setStatus("ready");
      }
    }
    load();
  }, [id]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    setStatus("processing");

    const result = await acceptInvitationAndSendMagicLink(invitation.id, name);

    if ("error" in result && result.error) {
      setStatus("error");
      setErrorMessage(result.error);
    } else {
      setSentEmail(result.email || invitation.email);
      setStatus("sent");
    }
  };

  if (status === "loading") {
    return (
      <div className="w-full max-w-md text-center">
        <p className="text-sm text-muted-foreground">Loading invitation...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button variant="outline" onClick={() => router.push("/login")}>
              Go to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Check your email to complete setup.
            </p>
            <p className="text-xs text-muted-foreground">
              Sent to <strong>{sentEmail}</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center gap-2 mb-6">
        <CommandIcon className="size-8 text-primary" />
        <h1 className="text-xl font-bold">Social Media Manager</h1>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            Join {invitation?.organizationName}
          </CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as a member
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={invitation?.email || ""}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={status === "processing"}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={status === "processing"}
            >
              {status === "processing" ? "Joining..." : "Accept & join"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
