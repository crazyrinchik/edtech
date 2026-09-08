import { createFileRoute } from "@tanstack/react-router";

import { CurriculumScreen } from "../components/curriculum-screen";
import { closedHead } from "../lib/seo";

// Сам экран общий с кабинетом родителя — см. components/curriculum-screen.
export const Route = createFileRoute("/repetitor/temy")({
  head: () => closedHead("Темы и задания, Совёнок"),
  component: () => <CurriculumScreen audience="tutor" />,
});
