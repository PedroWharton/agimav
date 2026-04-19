"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RangeSelect<T extends string>({
  current,
  options,
  paramName = "range",
  ariaLabel,
}: {
  current: T;
  options: readonly { value: T; label: string }[];
  paramName?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, value);
    start(() => router.push(`?${params.toString()}`));
  };

  return (
    <Select value={current} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-[160px]" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
