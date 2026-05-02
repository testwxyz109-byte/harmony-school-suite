import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "./attendance";
export const Route = createFileRoute("/_app/transport")({ component: () => <ComingSoon title="Transport" /> });
