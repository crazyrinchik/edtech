import { createFileRoute } from "@tanstack/react-router";

import { CurriculumScreen } from "../components/curriculum-screen";
import { closedHead } from "../lib/seo";

/**
 * Обзор программы в кабинете родителя — тот же экран, что у репетитора.
 *
 * Имя файла с подчёркиванием (roditel_.temy): без него роутер вложил бы
 * страницу в /roditel как дочернюю, а кабинет никакого Outlet не рисует —
 * страница осталась бы пустой.
 */
export const Route = createFileRoute("/roditel_/temy")({
  head: () => closedHead("Темы и задания, Совёнок"),
  component: () => <CurriculumScreen audience="parent" />,
});
