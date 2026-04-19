export type ActionError =
  | "forbidden"
  | "invalid"
  | "duplicate_email"
  | "not_found"
  | "no_self_deactivate"
  | "last_admin"
  | "unknown";

export type InviteInfo = {
  token: string;
  expiresAt: string;
};

export type MutationResult =
  | { ok: true; invite?: InviteInfo }
  | {
      ok: false;
      error: ActionError;
      fieldErrors?: Record<string, string>;
    };
