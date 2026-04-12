import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";
import { ApiClientProvider } from "../api/api-client-context";
import { createAppQueryClient } from "../api/query-client";
import { AuthProvider } from "../auth/auth-provider";
import { AuthSessionProvider } from "../auth/auth-session";

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => createAppQueryClient());

  return (
    <AuthSessionProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ApiClientProvider>{children}</ApiClientProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AuthSessionProvider>
  );
}
