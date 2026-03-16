import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = "batice@nirodigital.com";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [
    magicLink({
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: "Sign in to Social Media Manager",
          html: `<p>Click <a href="${url}">here</a> to sign in to Social Media Manager.</p><p>This link expires in 5 minutes.</p>`,
        });
      },
    }),
    organization({
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.BETTER_AUTH_URL}/accept-invitation/${data.id}`;
        await resend.emails.send({
          from: fromEmail,
          to: data.email,
          subject: `You're invited to join ${data.organization.name}`,
          html: `<p>${data.inviter.user.name} invited you to join <strong>${data.organization.name}</strong> on Social Media Manager.</p><p>Click <a href="${inviteLink}">here</a> to accept the invitation.</p>`,
        });
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
