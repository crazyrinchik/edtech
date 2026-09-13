import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Старый адрес кабинета родителя.
 *
 * Кабинет стал общим для родителя и репетитора и переехал на /kabinet, но
 * /roditel остался ссылкой из писем, закладок и переписки с поддержкой —
 * поэтому не удалён, а переводит.
 */
export const Route = createFileRoute("/roditel")({
  beforeLoad: () => {
    throw redirect({ to: "/kabinet" });
  },
});
