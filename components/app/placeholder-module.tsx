import { useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  titleKey: string;
  descriptionKey: string;
};

export function PlaceholderModule({ titleKey, descriptionKey }: Props) {
  const t = useTranslations();
  return (
    <div className="flex flex-1 items-start justify-center p-6 md:p-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">{t(titleKey)}</CardTitle>
          <CardDescription className="text-sm uppercase tracking-wider text-muted-foreground">
            {t("placeholder.proximamente")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">
            {t(descriptionKey)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
