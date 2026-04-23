import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { firstViewPath } from "@/lib/rbac";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const landing = firstViewPath(session);
  redirect(landing ?? "/sin-permisos");
}
