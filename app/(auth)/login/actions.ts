"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

import type { LoginState } from "./types";

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/maquinaria",
    });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "invalid" };
    }
    throw err;
  }
}
