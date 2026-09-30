import { redirect } from "next/navigation";

import { defaultHref } from "@/experiments/registry";

export default function Home() {
  redirect(defaultHref);
}
