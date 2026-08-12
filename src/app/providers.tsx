"use client";

import { FeedbackProvider } from "@/components/ui/feedback";

export function Providers({ children }: { children: React.ReactNode }) {
  return <FeedbackProvider>{children}</FeedbackProvider>;
}
