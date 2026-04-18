import Link from "next/link";
import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { prisma } from "@/lib/db";

import { InviteForm } from "./invite-form";

type TokenState =
  | { kind: "valid"; nombre: string }
  | { kind: "invalid" }
  | { kind: "expired" };

async function loadToken(token: string): Promise<TokenState> {
  const record = await prisma.usuarioInviteToken.findUnique({
    where: { token },
    include: { usuario: true },
  });
  if (!record || record.usedAt || record.usuario.estado !== "activo") {
    return { kind: "invalid" };
  }
  if (record.expiresAt.getTime() < Date.now()) return { kind: "expired" };
  return { kind: "valid", nombre: record.usuario.nombre };
}

export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("auth.invitacion");
  const state = await loadToken(token);

  if (state.kind !== "valid") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">{t("titulo")}</CardTitle>
          <CardDescription className="text-destructive">
            {state.kind === "expired" ? t("errorExpirado") : t("errorInvalido")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/login"
            className="text-sm text-primary hover:underline"
          >
            {t("volverLogin")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">{t("titulo")}</CardTitle>
        <CardDescription>
          {t("subtitulo", { nombre: state.nombre })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InviteForm token={token} />
      </CardContent>
    </Card>
  );
}
