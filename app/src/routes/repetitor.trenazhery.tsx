import { createFileRoute, redirect } from "@tanstack/react-router";

// Тренажёры переехали на общий адрес — см. kabinet.trenazhery.tsx.
export const Route = createFileRoute("/repetitor/trenazhery")({
  beforeLoad: () => {
    throw redirect({ to: "/kabinet/trenazhery" });
  },
});
