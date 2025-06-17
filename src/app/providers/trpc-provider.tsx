"use client";

import { TRPCProvider } from "@/app/utils/trpc";

export default function TRPCProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TRPCProvider>{children}</TRPCProvider>;
}
