import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { PwaUpdateBanner } from "@/components/pwa-update-banner";
import { queryClient } from "@/lib/query-client";
import { router } from "@/routes";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <PwaUpdateBanner />
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "text-base! font-sans!",
            title: "text-base! font-semibold!",
            description: "text-sm!",
          },
        }}
      />
    </QueryClientProvider>
  );
}
