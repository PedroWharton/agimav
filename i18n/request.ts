import { getRequestConfig } from "next-intl/server";

// Single-locale setup. When we add English, switch to locale routing (app/[locale]/...).
export const locales = ["es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";

export default getRequestConfig(async () => {
  const locale: Locale = defaultLocale;
  const messages = (await import(`../messages/${locale}.json`)).default;
  return {
    locale,
    messages,
    timeZone: "America/Argentina/Buenos_Aires",
  };
});
