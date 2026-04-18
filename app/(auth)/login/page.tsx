import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const t = await getTranslations();
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("app.nombre")}
        </div>
        <CardTitle className="text-2xl">{t("auth.login.titulo")}</CardTitle>
        <CardDescription>{t("auth.login.subtitulo")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
