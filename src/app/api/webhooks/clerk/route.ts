import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  let evt: WebhookEvent;

  // In development, skip verification if no webhook secret is set
  if (
    process.env.NODE_ENV === "development" &&
    !process.env.CLERK_WEBHOOK_SECRET
  ) {
    console.log("⚠️  Webhook verification skipped in development mode");
    evt = payload as WebhookEvent;
  } else {
    // Create a new Svix instance with your secret
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);

    // Verify the payload with the headers
    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      console.error("Error verifying webhook:", err);
      return new Response("Error occured", {
        status: 400,
      });
    }
  }

  // Handle the webhook
  const eventType = evt.type;

  console.log(`📨 Clerk Webhook received: ${eventType}`, {
    userId: evt.data.id,
    timestamp: new Date().toISOString(),
  });

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, image_url, first_name, last_name } = evt.data;

    const email = email_addresses[0]?.email_address;
    const name = [first_name, last_name].filter(Boolean).join(" ") || null;

    try {
      // Check if this is the first user - if so, make them admin
      const userCount = await prisma.user.count();
      const isFirstUser = userCount === 0;

      // Create or update user
      const user = await prisma.user.upsert({
        where: { clerkId: id },
        update: {
          email,
          name,
          image: image_url,
        },
        create: {
          clerkId: id,
          email,
          name,
          image: image_url,
          role: isFirstUser ? Role.ADMIN : Role.USER,
        },
      });

      // Create permissions for new user
      if (eventType === "user.created") {
        await prisma.permission.create({
          data: {
            userId: user.id,
            canCreateProjects: isFirstUser, // Only admin (first user) can create projects by default
            canUploadAssets: true,
            maxProjects: isFirstUser ? 1000 : 0, // Admin gets 1000, regular users get 0 by default
            maxAssetStorage: isFirstUser ? 107374182400 : 1073741824, // 100GB for admin, 1GB for users
          },
        });
      }

      console.log(`User ${eventType}: ${user.id}`);
    } catch (error) {
      console.error(`Error handling ${eventType}:`, error);
      return new Response("Error processing webhook", { status: 500 });
    }
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;

    try {
      await prisma.user.delete({
        where: { clerkId: id },
      });
      console.log(`User deleted: ${id}`);
    } catch (error) {
      console.error("Error deleting user:", error);
      return new Response("Error processing webhook", { status: 500 });
    }
  }

  return new Response("", { status: 200 });
}
