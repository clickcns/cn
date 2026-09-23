import { shouldRetryQuery } from "@repo/api-client";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetryQuery,
    },
    mutations: {
      retry: false,
    },
  },
});
