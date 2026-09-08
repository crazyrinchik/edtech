import { createFileRoute } from "@tanstack/react-router";

import { TrainersScreen } from "../components/trainers-screen";
import { closedHead } from "../lib/seo";

// Подчёркивание в имени файла — см. roditel_.temy.tsx.
export const Route = createFileRoute("/roditel_/trenazhery")({
  head: () => closedHead("Тренажёры, Совёнок"),
  component: () => <TrainersScreen audience="parent" />,
});
