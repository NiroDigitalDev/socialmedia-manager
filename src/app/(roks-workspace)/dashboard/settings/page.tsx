"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export default function SettingsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const [name, setName] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);

  if (session?.user && !nameLoaded) {
    setName(session.user.name || "");
    setNameLoaded(true);
  }

  const membersQuery = useQuery(
    trpc.org.members.queryOptions({
      organizationId: activeOrg?.id || "",
    })
  );

  const invitationsQuery = useQuery(
    trpc.org.invitations.queryOptions({
      organizationId: activeOrg?.id || "",
    })
  );

  const updateName = useMutation(
    trpc.user.updateName.mutationOptions({
      onSuccess: () => {
        toast.success("Name updated");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    setInviting(true);

    const { error } = await authClient.organization.inviteMember({
      email: inviteEmail,
      role: "member",
      organizationId: activeOrg.id,
    });

    if (error) {
      toast.error(error.message || "Failed to send invitation");
    } else {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: trpc.org.invitations.queryKey() });
    }
    setInviting(false);
  };

  const handleRevoke = async (invitationId: string) => {
    const { error } = await authClient.organization.cancelInvitation({
      invitationId,
    });

    if (error) {
      toast.error("Failed to revoke invitation");
    } else {
      toast.success("Invitation revoked");
      queryClient.invalidateQueries({ queryKey: trpc.org.invitations.queryKey() });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your account settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
              <Button
                onClick={() => updateName.mutate({ name })}
                disabled={updateName.isPending || name === session?.user?.name}
              >
                {updateName.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={session?.user?.email || ""} disabled />
          </div>
        </CardContent>
      </Card>

      {activeOrg && (
        <Card>
          <CardHeader>
            <CardTitle>Members — {activeOrg.name}</CardTitle>
            <CardDescription>Manage organization members</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersQuery.data?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.user.name}</TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell className="capitalize">{member.role}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {invitationsQuery.data && invitationsQuery.data.length > 0 && (
              <>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Pending Invitations
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitationsQuery.data.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>{inv.email}</TableCell>
                        <TableCell>
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(inv.id)}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}

            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                disabled={inviting}
              />
              <Button type="submit" disabled={inviting}>
                {inviting ? "Sending..." : "Invite"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
