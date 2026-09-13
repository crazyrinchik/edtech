import { createFileRoute } from "@tanstack/react-router";

import { TrainersScreen } from "../components/trainers-screen";
import { closedHead } from "../lib/seo";

// Один адрес на обе роли — см. kabinet.temy.tsx.
export const Route = createFileRoute("/kabinet/trenazhery")({
  head: () => closedHead("Тренажёры, Совёнок"),
  component: TrainersScreen,
});
