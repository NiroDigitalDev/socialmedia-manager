"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getInvitationDetails(invitationId: string) {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, status: "pending" },
    include: { organization: true },
  });

  if (!invitation) {
    return { error: "Invitation not found or has expired." };
  }

  return {
    id: invitation.id,
    email: invitation.email,
    organizationName: invitation.organization.name,
  };
}

export async function acceptInvitationAndSendMagicLink(
  invitationId: string,
  name: string
) {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, status: "pending" },
  });

  if (!invitation) {
    return { error: "Invitation not found or has expired." };
  }

  let user = await prisma.user.findFirst({
    where: { email: invitation.email },
  });

  if (!user) {
    const userId = crypto.randomUUID();
    user = await prisma.user.create({
      data: {
        id: userId,
        name,
        email: invitation.email,
        emailVerified: false,
        createdAt: new Date(),
      },
    });

    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "magic-link",
        createdAt: new Date(),
      },
    });
  }

  try {
    await auth.api.signInMagicLink({
      body: { email: invitation.email, callbackURL: "/dashboard" },
      headers: await headers(),
    });
  } catch {
    return { error: "Failed to send magic link. Please try again." };
  }

  return { success: true, email: invitation.email };
}
