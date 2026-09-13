import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Список учеников переехал в общий кабинет.
 *
 * Он и был последним, что держало у репетитора отдельный кабинет: своих
 * детей и чужих учеников теперь показывает один экран /kabinet, разделами,
 * потому что это разные отношения, а не разные продукты.
 */
export const Route = createFileRoute("/repetitor/")({
  beforeLoad: () => {
    throw redirect({ to: "/kabinet" });
  },
});
