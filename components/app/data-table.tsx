"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  searchableKeys?: (keyof T)[];
  searchPlaceholder?: string;
  emptyState?: ReactNode;
  filterSlot?: ReactNode;
  onRowClick?: (row: T) => void;
  initialSort?: SortingState;
};

export function DataTable<T>({
  columns,
  data,
  searchableKeys,
  searchPlaceholder,
  emptyState,
  filterSlot,
  onRowClick,
  initialSort,
}: DataTableProps<T>) {
  const t = useTranslations("listados.common");
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>(initialSort ?? []);

  const filtered = useMemo(() => {
    if (!query.trim() || !searchableKeys?.length) return data;
    const q = norm(query);
    return data.filter((row) =>
      searchableKeys.some((k) => norm(row[k]).includes(q)),
    );
  }, [data, query, searchableKeys]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const resultCount = filtered.length;
  const hasQuery = !!query.trim();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {searchableKeys?.length ? (
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder ?? t("buscar")}
              className="pl-8"
            />
          </div>
        ) : null}
        {filterSlot}
        <div className="ml-auto text-sm text-muted-foreground">
          {t("resultados", { count: resultCount })}
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sort = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className="whitespace-nowrap"
                      aria-sort={
                        !canSort
                          ? undefined
                          : sort === "asc"
                            ? "ascending"
                            : sort === "desc"
                              ? "descending"
                              : "none"
                      }
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1 font-medium hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sort === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : sort === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-50" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  {hasQuery
                    ? t("sinResultados", { query })
                    : (emptyState ?? t("buscar"))}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
