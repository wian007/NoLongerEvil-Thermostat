"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/lib/theme-provider";
import { QueryProvider } from "@/lib/query-client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
console.log('[Providers] Initializing Convex with URL:', convexUrl);

if (!convexUrl) {
  console.error('[Providers] NEXT_PUBLIC_CONVEX_URL is not set!');
}

const convex = new ConvexReactClient(convexUrl!);

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <ClerkProvider>
      <ConvexProvider client={convex}>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </ConvexProvider>
    </ClerkProvider>
  );
}

