import { createFileRoute } from "@tanstack/react-router";

import { CurriculumScreen } from "../components/curriculum-screen";
import { closedHead } from "../lib/seo";

// Один адрес на обе роли: раньше тот же экран жил по двум — /roditel/temy и
// /repetitor/temy, — и различался в них только словом «ученик».
export const Route = createFileRoute("/kabinet/temy")({
  head: () => closedHead("Темы и задания, Совёнок"),
  component: CurriculumScreen,
});
