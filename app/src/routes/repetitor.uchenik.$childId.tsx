import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Карточка ученика переехала в общий кабинет: тот же экран открывает и
 * репетитор, и родитель, а различаются они правами, а не адресом.
 */
export const Route = createFileRoute("/repetitor/uchenik/$childId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/kabinet/$childId", params });
  },
});
