import { createFileRoute, redirect } from "@tanstack/react-router";

// Программа переехала на общий адрес — см. kabinet.temy.tsx.
export const Route = createFileRoute("/repetitor/temy")({
  beforeLoad: () => {
    throw redirect({ to: "/kabinet/temy" });
  },
});
