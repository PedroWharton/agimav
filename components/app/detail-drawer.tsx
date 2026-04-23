"use client";

import { type JSX, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type DetailDrawerTab = {
  id: string;
  label: string;
  content: ReactNode;
};

export type DetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  tabs?: DetailDrawerTab[];
  defaultTab?: string;
  footer?: ReactNode;
  children?: ReactNode;
  width?: "sm" | "md" | "lg" | "xl" | "2xl";
};

const WIDTH_CLASSES: Record<NonNullable<DetailDrawerProps["width"]>, string> = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[480px]",
  lg: "sm:max-w-[640px]",
  xl: "sm:max-w-[820px]",
  "2xl": "sm:max-w-[960px]",
};

export function DetailDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  tabs,
  defaultTab,
  footer,
  children,
  width = "md",
}: DetailDrawerProps): JSX.Element {
  const hasTabs = Array.isArray(tabs) && tabs.length > 0;
  const initialTab = defaultTab ?? (hasTabs ? tabs[0]!.id : undefined);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex flex-col gap-0 bg-card p-0",
          WIDTH_CLASSES[width]
        )}
      >
        <SheetHeader className="border-b border-border px-4 py-3 pr-12">
          <SheetTitle className="text-base font-semibold leading-tight">
            {title}
          </SheetTitle>
          {subtitle ? (
            <SheetDescription
              asChild
              className="text-sm text-subtle-foreground"
            >
              <div>{subtitle}</div>
            </SheetDescription>
          ) : null}
        </SheetHeader>

        {hasTabs ? (
          <Tabs
            defaultValue={initialTab}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-2">
              <TabsList variant="line" className="w-full justify-start">
                {tabs!.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="flex-1 overflow-y-auto">
              {tabs!.map((tab) => (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  className="px-4 py-4"
                >
                  {tab.content}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        )}

        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-4 py-3">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
