import { createFileRoute } from "@tanstack/react-router";

import { CurriculumScreen } from "../components/curriculum-screen";
import { closedHead } from "../lib/seo";

// Один адрес на обе роли: раньше тот же экран жил по двум — /roditel/temy и
// /repetitor/temy, — и различался в них только словом «ученик».
//
// Раздел переименован в «Повторение школьной программы», а адрес оставлен
// прежним: на /kabinet/temy стоят закладки и туда ведут два редиректа со
// старых адресов, и ломать их ради слова в строке незачем.
export const Route = createFileRoute("/kabinet/temy")({
  head: () => closedHead("Повторение школьной программы, Совёнок"),
  component: CurriculumScreen,
});
