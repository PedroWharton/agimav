"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { setPasswordFromInvite } from "./actions";

type FieldErrors = {
  password?: string;
  passwordConfirmacion?: string;
  _form?: string;
};

export function InviteForm({ token }: { token: string }) {
  const t = useTranslations("auth.invitacion");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (password.length < 8) {
      setErrors({ password: t("errorPasswordCorta") });
      return;
    }
    if (password !== confirmacion) {
      setErrors({ passwordConfirmacion: t("errorPasswordNoCoincide") });
      return;
    }

    startTransition(async () => {
      const result = await setPasswordFromInvite({
        token,
        password,
        passwordConfirmacion: confirmacion,
      });

      if (result.ok) {
        setDone(true);
        toast.success(t("exito"));
        setTimeout(() => router.replace("/login"), 800);
        return;
      }

      if (result.error === "invalid") {
        setErrors({ _form: t("errorInvalido") });
      } else if (result.error === "expired") {
        setErrors({ _form: t("errorExpirado") });
      } else if (result.error === "validation" && result.fieldErrors) {
        const out: FieldErrors = {};
        for (const [k, key] of Object.entries(result.fieldErrors)) {
          const msg = translateError(t, key);
          if (k === "password") out.password = msg;
          else if (k === "passwordConfirmacion") out.passwordConfirmacion = msg;
          else out._form = msg;
        }
        setErrors(out);
      } else {
        setErrors({ _form: t("errorGenerico") });
      }
    });
  }

  if (done) {
    return (
      <div className="space-y-4 text-sm">
        <p>{t("exito")}</p>
        <Link
          href="/login"
          className="text-primary hover:underline"
        >
          {t("volverLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isPending}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {errors.password ? (
          <p className="text-sm text-destructive">{errors.password}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("requisito")}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="passwordConfirmacion">
          {t("passwordConfirmacion")}
        </Label>
        <Input
          id="passwordConfirmacion"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isPending}
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
        />
        {errors.passwordConfirmacion ? (
          <p className="text-sm text-destructive">
            {errors.passwordConfirmacion}
          </p>
        ) : null}
      </div>
      {errors._form ? (
        <p className="text-sm text-destructive" role="alert">
          {errors._form}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}

function translateError(
  t: ReturnType<typeof useTranslations>,
  key: string,
): string {
  if (key === "errorPasswordCorta") return t("errorPasswordCorta");
  if (key === "errorPasswordNoCoincide") return t("errorPasswordNoCoincide");
  return key;
}
