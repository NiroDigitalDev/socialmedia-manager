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
import { Loader2Icon } from "lucide-react";

export default function SettingsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();


  // Profile state
  const [name, setName] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);

  if (session?.user && !nameLoaded) {
    setName(session.user.name || "");
    setNameLoaded(true);
  }

  // tRPC queries — only run when activeOrg is available
  const membersQuery = useQuery({
    ...trpc.org.members.queryOptions(
      { organizationId: activeOrg?.id || "" },
    ),
    enabled: !!activeOrg?.id,
  });

  const invitationsQuery = useQuery({
    ...trpc.org.invitations.queryOptions(
      { organizationId: activeOrg?.id || "" },
    ),
    enabled: !!activeOrg?.id,
  });

  // Update name mutation
  const updateName = useMutation(
    trpc.user.updateName.mutationOptions({
      onSuccess: () => toast.success("Name updated"),
      onError: (err) => toast.error(err.message),
    })
  );

  // Remove member mutation
  const removeMember = useMutation(
    trpc.org.removeMember.mutationOptions({
      onSuccess: () => {
        toast.success("Member removed");
        queryClient.invalidateQueries({ queryKey: trpc.org.members.queryKey() });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    setInviting(true);

    try {
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
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    try {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId,
      });

      if (error) {
        toast.error("Failed to revoke invitation");
      } else {
        toast.success("Invitation revoked");
        queryClient.invalidateQueries({ queryKey: trpc.org.invitations.queryKey() });
      }
    } catch {
      toast.error("Failed to revoke invitation");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile Section */}
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

      {/* Members Section */}
      {activeOrg && (
        <Card>
          <CardHeader>
            <CardTitle>Members — {activeOrg.name}</CardTitle>
            <CardDescription>Manage organization members</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {membersQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading members...
              </div>
            )}

            {membersQuery.isError && (
              <p className="text-sm text-destructive">
                Failed to load members. {membersQuery.error.message}
              </p>
            )}

            {membersQuery.data && membersQuery.data.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersQuery.data.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.user.name}</TableCell>
                      <TableCell>{member.user.email}</TableCell>
                      <TableCell className="capitalize">{member.role}</TableCell>
                      <TableCell>
                        {member.user.id !== session?.user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              removeMember.mutate({
                                memberId: member.id,
                                organizationId: activeOrg.id,
                              })
                            }
                            disabled={removeMember.isPending}
                          >
                            Remove
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {membersQuery.data && membersQuery.data.length === 0 && (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            )}

            {/* Pending Invitations */}
            {invitationsQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading invitations...
              </div>
            )}

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

            {/* Invite Form */}
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

      {!activeOrg && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No organization found. Contact an administrator.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
