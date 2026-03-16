"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getInvitationDetails(invitationId: string) {
  try {
    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, status: "pending" },
      include: { organization: true },
    });

    if (!invitation) {
      return { error: "Invitation not found or has already been accepted." };
    }

    // Check expiry
    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return { error: "This invitation has expired. Please ask for a new one." };
    }

    return {
      id: invitation.id,
      email: invitation.email,
      organizationName: invitation.organization.name,
    };
  } catch (e) {
    console.error("Failed to fetch invitation:", e);
    return { error: "Failed to load invitation details." };
  }
}

export async function acceptInvitationAndSendMagicLink(
  invitationId: string,
  name: string
) {
  try {
    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, status: "pending" },
    });

    if (!invitation) {
      return { error: "Invitation not found or has already been accepted." };
    }

    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return { error: "This invitation has expired. Please ask for a new one." };
    }

    // Create user if they don't exist
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

    // Create member record to add user to the organization
    const existingMember = await prisma.member.findFirst({
      where: { userId: user.id, organizationId: invitation.organizationId },
    });

    if (!existingMember) {
      await prisma.member.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role || "member",
          createdAt: new Date(),
        },
      });
    }

    // Mark invitation as accepted
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    });

    // Send magic link so they can sign in
    try {
      await auth.api.signInMagicLink({
        body: { email: invitation.email, callbackURL: "/dashboard" },
        headers: await headers(),
      });
    } catch (emailError) {
      console.error("Failed to send magic link:", emailError);
      // Invitation was accepted but email failed — they can still login manually
      return { success: true, email: invitation.email, emailFailed: true };
    }

    return { success: true, email: invitation.email };
  } catch (e) {
    console.error("Failed to accept invitation:", e);
    return { error: "Something went wrong. Please try again." };
  }
}
