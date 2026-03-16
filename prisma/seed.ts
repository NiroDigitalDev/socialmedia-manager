import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import crypto from "crypto";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function genId() {
  return crypto.randomUUID();
}

async function main() {
  console.log("Seeding...");

  // 1. Create or find the seed user
  let user = await prisma.user.findUnique({
    where: { email: "dev@nirodigital.com" },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: genId(),
        name: "Rok",
        email: "dev@nirodigital.com",
        emailVerified: true,
      },
    });
    console.log("User created:", user.id, user.email);
  } else {
    console.log("User exists:", user.id, user.email);
  }

  // 2. Create account record for magic link provider
  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "email-otp" },
  });
  if (!existingAccount) {
    await prisma.account.create({
      data: {
        id: genId(),
        userId: user.id,
        accountId: user.id,
        providerId: "email-otp",
      },
    });
    console.log("Account created for email-otp provider");
  }

  // 3. Create organization
  let org = await prisma.organization.findUnique({
    where: { slug: "niro-digital" },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        id: genId(),
        name: "Niro Digital",
        slug: "niro-digital",
        createdAt: new Date(),
      },
    });
    console.log("Organization created:", org.id, org.name);
  } else {
    console.log("Organization exists:", org.id, org.name);
  }

  // 4. Create member (owner)
  const existingMember = await prisma.member.findFirst({
    where: { userId: user.id, organizationId: org.id },
  });
  if (!existingMember) {
    await prisma.member.create({
      data: {
        id: genId(),
        userId: user.id,
        organizationId: org.id,
        role: "owner",
        createdAt: new Date(),
      },
    });
    console.log("Member created: Rok as owner of Niro Digital");
  }

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
