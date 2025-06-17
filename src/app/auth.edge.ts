import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-compatible NextAuth configuration
// This file is used in edge environments (like middleware)
// It doesn't include the Prisma adapter which isn't edge-compatible
export const { auth } = NextAuth(authConfig);
