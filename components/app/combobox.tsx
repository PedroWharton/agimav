"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ComboboxOption = { value: string; label: string };

export type ComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyLabel?: string;
  searchPlaceholder?: string;
  /** Allow typing a value not in options. Default true. */
  allowCreate?: boolean;
  disabled?: boolean;
  className?: string;
};

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Seleccionar…",
  emptyLabel = "Sin resultados.",
  searchPlaceholder = "Buscar…",
  allowCreate = true,
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const trimmedQuery = query.trim();
  const queryMatchesOption = trimmedQuery
    ? options.some(
        (o) => o.label.localeCompare(trimmedQuery, undefined, { sensitivity: "base" }) === 0,
      )
    : false;
  const showCreate = allowCreate && !!trimmedQuery && !queryMatchesOption;

  const pickLabel = selected?.label ?? (value || "");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !pickLabel && "text-muted-foreground",
            className,
          )}
        >
          {pickLabel || placeholder}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command
          filter={(value, search) => {
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {options.length > 0 ? (
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => {
                      onChange(opt.value);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === opt.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {showCreate ? (
              <CommandGroup>
                <CommandItem
                  value={`__create__${trimmedQuery}`}
                  onSelect={() => {
                    onChange(trimmedQuery);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  Crear &quot;{trimmedQuery}&quot;
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
