"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { toast } from "sonner";
import {
  Star,
  ChevronRight,
  Archive,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArchiveRestore,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";

import {
  createNivelAtributo,
  updateNivelAtributo,
  setNivelAtributoActivo,
  deleteNivelAtributo,
} from "@/app/(app)/maquinaria/tipos/[id]/estructura/actions";

export type AtributoView = {
  id: number;
  nombre: string;
  dataType: string;
  requerido: boolean;
  esPrincipal: boolean;
  sourceRef: string | null;
  listOptions: string | null;
  activo: boolean;
};

export type NivelView = {
  id: number;
  nombre: string;
  parentLevelId: number | null;
  orden: number;
  permiteInventario: boolean;
  activo: boolean;
  atributos: AtributoView[];
};

type NivelNode = NivelView & { hijos: NivelNode[] };

function buildTree(niveles: NivelView[]): NivelNode[] {
  const byId = new Map<number, NivelNode>();
  for (const n of niveles) byId.set(n.id, { ...n, hijos: [] });
  const roots: NivelNode[] = [];
  for (const node of byId.values()) {
    if (node.parentLevelId == null) roots.push(node);
    else {
      const parent = byId.get(node.parentLevelId);
      if (parent) parent.hijos.push(node);
      else roots.push(node);
    }
  }
  const sortRec = (arr: NivelNode[]) => {
    arr.sort((a, b) => a.orden - b.orden || a.id - b.id);
    for (const n of arr) sortRec(n.hijos);
  };
  sortRec(roots);
  return roots;
}

type DialogState =
  | { kind: "closed" }
  | { kind: "create"; nivelId: number; nivelNombre: string }
  | {
      kind: "edit";
      atributo: AtributoView;
      nivelId: number;
      nivelNombre: string;
    };

export function StructureTree({
  niveles,
  admin = false,
  instanciasCount = 0,
}: {
  niveles: NivelView[];
  admin?: boolean;
  instanciasCount?: number;
}) {
  const t = useTranslations("maquinaria.estructura");
  const roots = useMemo(() => buildTree(niveles), [niveles]);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });

  if (roots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {t("sinEstructura")}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {roots.map((root) => (
          <NivelCard
            key={root.id}
            nivel={root}
            depth={0}
            admin={admin}
            onCreateAtributo={(nivelId, nivelNombre) =>
              setDialog({ kind: "create", nivelId, nivelNombre })
            }
            onEditAtributo={(atributo, nivelId, nivelNombre) =>
              setDialog({ kind: "edit", atributo, nivelId, nivelNombre })
            }
          />
        ))}
      </div>
      {admin ? (
        <AtributoDialog
          state={dialog}
          instanciasCount={instanciasCount}
          onClose={() => setDialog({ kind: "closed" })}
        />
      ) : null}
    </>
  );
}

function NivelCard({
  nivel,
  depth,
  admin,
  onCreateAtributo,
  onEditAtributo,
}: {
  nivel: NivelNode;
  depth: number;
  admin: boolean;
  onCreateAtributo: (nivelId: number, nivelNombre: string) => void;
  onEditAtributo: (
    atributo: AtributoView,
    nivelId: number,
    nivelNombre: string,
  ) => void;
}) {
  const t = useTranslations("maquinaria.estructura");
  const dtLabel: Record<string, string> = {
    text: t("dataType.text"),
    number: t("dataType.number"),
    date: t("dataType.date"),
    list: t("dataType.list"),
    ref: t("dataType.ref"),
  };

  return (
    <div
      className="rounded-lg border border-border bg-card"
      style={{ marginLeft: depth === 0 ? 0 : 24 }}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <ChevronRight className="size-4 text-muted-foreground" />
        <span className="font-medium">{nivel.nombre}</span>
        {!nivel.activo ? (
          <Badge variant="secondary" className="gap-1">
            <Archive className="size-3" />
            {t("inactivo")}
          </Badge>
        ) : null}
        {nivel.parentLevelId == null ? (
          <Badge variant="outline" className="ml-auto">
            {t("nivelRaiz")}
          </Badge>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">
            {t("profundidad", { depth })}
          </span>
        )}
        {admin ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onCreateAtributo(nivel.id, nivel.nombre)}
          >
            <Plus className="size-4" />
            {t("agregarAtributo")}
          </Button>
        ) : null}
      </div>

      {nivel.atributos.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          {t("sinAtributos")}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {nivel.atributos
            .slice()
            .sort((a, b) => a.id - b.id)
            .map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  ·
                </span>
                <span
                  className={
                    a.activo
                      ? "font-medium"
                      : "font-medium text-muted-foreground line-through"
                  }
                >
                  {a.nombre}
                </span>
                <Badge variant="secondary" className="font-normal">
                  {dtLabel[a.dataType] ?? a.dataType}
                  {a.sourceRef ? (
                    <span className="ml-1 text-muted-foreground">
                      → {a.sourceRef}
                    </span>
                  ) : null}
                </Badge>
                {a.requerido ? (
                  <Badge variant="outline">{t("requerido")}</Badge>
                ) : null}
                {a.esPrincipal ? (
                  <Badge className="gap-1">
                    <Star className="size-3" />
                    {t("principal")}
                  </Badge>
                ) : null}
                {!a.activo ? (
                  <Badge variant="secondary" className="gap-1">
                    <Archive className="size-3" />
                    {t("archivado")}
                  </Badge>
                ) : null}
                {admin ? (
                  <div className="ml-auto">
                    <AtributoActions
                      atributo={a}
                      nivelId={nivel.id}
                      nivelNombre={nivel.nombre}
                      onEdit={onEditAtributo}
                    />
                  </div>
                ) : null}
              </li>
            ))}
        </ul>
      )}

      {nivel.hijos.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-dashed border-border p-3">
          {nivel.hijos.map((h) => (
            <NivelCard
              key={h.id}
              nivel={h}
              depth={depth + 1}
              admin={admin}
              onCreateAtributo={onCreateAtributo}
              onEditAtributo={onEditAtributo}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AtributoActions({
  atributo,
  nivelId,
  nivelNombre,
  onEdit,
}: {
  atributo: AtributoView;
  nivelId: number;
  nivelNombre: string;
  onEdit: (a: AtributoView, nivelId: number, nivelNombre: string) => void;
}) {
  const t = useTranslations("maquinaria.estructura");
  const [pending, startTransition] = useTransition();

  async function toggleActivo() {
    startTransition(async () => {
      const result = await setNivelAtributoActivo(atributo.id, !atributo.activo);
      if (result.ok) {
        toast.success(
          atributo.activo ? t("atributoArchivado") : t("atributoReactivado"),
        );
      } else if (result.error === "forbidden") {
        toast.error(t("errorPermisos"));
      } else {
        toast.error(t("errorGuardar"));
      }
    });
  }

  async function onDelete() {
    const result = await deleteNivelAtributo(atributo.id);
    if (result.ok) {
      toast.success(t("atributoEliminado"));
    } else if (result.error === "in_use") {
      toast.error(
        t("eliminarEnUso", { count: result.usageCount ?? 0 }),
      );
    } else if (result.error === "forbidden") {
      toast.error(t("errorPermisos"));
    } else {
      toast.error(t("errorGuardar"));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          aria-label={t("accionesAtributo")}
          disabled={pending}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(atributo, nivelId, nivelNombre)}>
          <Pencil className="size-4" />
          {t("editarAtributo")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleActivo}>
          {atributo.activo ? (
            <>
              <Archive className="size-4" />
              {t("archivarAtributo")}
            </>
          ) : (
            <>
              <ArchiveRestore className="size-4" />
              {t("reactivarAtributo")}
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ConfirmDialog
          trigger={
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              {t("eliminarAtributo")}
            </DropdownMenuItem>
          }
          title={t("eliminarPregunta", { nombre: atributo.nombre })}
          description={t("eliminarAviso")}
          confirmLabel={t("eliminarAtributo")}
          destructive
          onConfirm={onDelete}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const createFormSchema = z
  .object({
    nombre: z.string().trim().min(1, "Obligatorio").max(120),
    dataType: z.enum(["text", "number", "date", "list", "ref"]),
    requerido: z.boolean(),
    listOptions: z.string().trim().max(2000),
    sourceRef: z.enum(["", "unidades_productivas", "inventario"]),
  })
  .superRefine((v, ctx) => {
    if (v.dataType === "list" && !v.listOptions.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["listOptions"],
        message: "Indicá las opciones separadas por coma",
      });
    }
    if (v.dataType === "ref" && !v.sourceRef) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceRef"],
        message: "Seleccioná un origen",
      });
    }
  });

type CreateFormValues = z.infer<typeof createFormSchema>;

const editFormSchema = z.object({
  nombre: z.string().trim().min(1, "Obligatorio").max(120),
  requerido: z.boolean(),
  listOptions: z.string().trim().max(2000),
  sourceRef: z.enum(["", "unidades_productivas", "inventario"]),
});

type EditFormValues = z.infer<typeof editFormSchema>;

function AtributoDialog({
  state,
  instanciasCount,
  onClose,
}: {
  state: DialogState;
  instanciasCount: number;
  onClose: () => void;
}) {
  if (state.kind === "closed") return null;
  if (state.kind === "create") {
    return (
      <CreateAtributoDialog
        nivelId={state.nivelId}
        nivelNombre={state.nivelNombre}
        instanciasCount={instanciasCount}
        onClose={onClose}
      />
    );
  }
  return (
    <EditAtributoDialog
      atributo={state.atributo}
      nivelNombre={state.nivelNombre}
      onClose={onClose}
    />
  );
}

function CreateAtributoDialog({
  nivelId,
  nivelNombre,
  instanciasCount,
  onClose,
}: {
  nivelId: number;
  nivelNombre: string;
  instanciasCount: number;
  onClose: () => void;
}) {
  const t = useTranslations("maquinaria.estructura");
  const [isSubmitting, startSubmit] = useTransition();

  const form = useForm<CreateFormValues>({
    resolver: standardSchemaResolver(createFormSchema),
    defaultValues: {
      nombre: "",
      dataType: "text",
      requerido: false,
      listOptions: "",
      sourceRef: "",
    },
  });

  const dataType = form.watch("dataType");

  function submit() {
    form.handleSubmit((values) => {
      startSubmit(async () => {
        const result = await createNivelAtributo({
          nivelId,
          nombre: values.nombre,
          dataType: values.dataType,
          requerido: values.requerido,
          listOptions:
            values.dataType === "list" ? values.listOptions : null,
          sourceRef: values.dataType === "ref" ? values.sourceRef || null : null,
        });
        if (result.ok) {
          toast.success(t("atributoCreado"));
          onClose();
        } else if (result.error === "duplicate") {
          form.setError("nombre", { message: t("duplicadoNombre") });
        } else if (result.error === "invalid" && result.fieldErrors) {
          for (const [path, msg] of Object.entries(result.fieldErrors)) {
            if (path === "nombre" || path === "listOptions" || path === "sourceRef") {
              form.setError(path as keyof CreateFormValues, { message: msg });
            }
          }
        } else if (result.error === "forbidden") {
          toast.error(t("errorPermisos"));
        } else {
          toast.error(t("errorGuardar"));
        }
      });
    })();
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("nuevoAtributoTitulo", { nivel: nivelNombre })}
          </DialogTitle>
          <DialogDescription>
            {instanciasCount > 0
              ? t("avisoInstancias", { count: instanciasCount })
              : t("avisoCrear")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="grid gap-4"
          >
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("atributoNombre")} *</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus maxLength={120} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dataType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("tipoDato")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="text">{t("dataType.text")}</SelectItem>
                      <SelectItem value="number">{t("dataType.number")}</SelectItem>
                      <SelectItem value="date">{t("dataType.date")}</SelectItem>
                      <SelectItem value="list">{t("dataType.list")}</SelectItem>
                      <SelectItem value="ref">{t("dataType.ref")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {dataType === "list" ? (
              <FormField
                control={form.control}
                name="listOptions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("opcionesLista")}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder={t("opcionesListaPlaceholder")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {dataType === "ref" ? (
              <FormField
                control={form.control}
                name="sourceRef"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("origenRef")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("seleccionarOrigen")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unidades_productivas">
                          {t("origen.unidades_productivas")}
                        </SelectItem>
                        <SelectItem value="inventario">
                          {t("origen.inventario")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="requerido"
              render={({ field }) => (
                <FormItem className="flex items-start gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange as CheckboxHandler}
                    />
                  </FormControl>
                  <div className="leading-tight">
                    <FormLabel>{t("atributoRequerido")}</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      {t("atributoRequeridoAyuda")}
                    </p>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("cancelar")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("guardando") : t("crearAtributo")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditAtributoDialog({
  atributo,
  nivelNombre,
  onClose,
}: {
  atributo: AtributoView;
  nivelNombre: string;
  onClose: () => void;
}) {
  const t = useTranslations("maquinaria.estructura");
  const [isSubmitting, startSubmit] = useTransition();

  const form = useForm<EditFormValues>({
    resolver: standardSchemaResolver(editFormSchema),
    defaultValues: {
      nombre: atributo.nombre,
      requerido: atributo.requerido,
      listOptions: atributo.listOptions ?? "",
      sourceRef:
        atributo.sourceRef === "unidades_productivas" ||
        atributo.sourceRef === "inventario"
          ? atributo.sourceRef
          : "",
    },
  });

  function submit() {
    form.handleSubmit((values) => {
      startSubmit(async () => {
        const result = await updateNivelAtributo(atributo.id, {
          nombre: values.nombre,
          requerido: values.requerido,
          listOptions:
            atributo.dataType === "list" ? values.listOptions : null,
          sourceRef:
            atributo.dataType === "ref" ? values.sourceRef || null : null,
        });
        if (result.ok) {
          toast.success(t("atributoActualizado"));
          onClose();
        } else if (result.error === "duplicate") {
          form.setError("nombre", { message: t("duplicadoNombre") });
        } else if (result.error === "invalid" && result.fieldErrors) {
          for (const [path, msg] of Object.entries(result.fieldErrors)) {
            if (path === "nombre" || path === "listOptions" || path === "sourceRef") {
              form.setError(path as keyof EditFormValues, { message: msg });
            }
          }
        } else if (result.error === "forbidden") {
          toast.error(t("errorPermisos"));
        } else {
          toast.error(t("errorGuardar"));
        }
      });
    })();
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("editarAtributoTitulo", { nivel: nivelNombre })}
          </DialogTitle>
          <DialogDescription>{t("editarAtributoAyuda")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="grid gap-4"
          >
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("atributoNombre")} *</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus maxLength={120} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {t("tipoDatoBloqueado", {
                tipo: t(`dataType.${atributo.dataType}` as DataTypeKey),
              })}
            </div>
            {atributo.dataType === "list" ? (
              <FormField
                control={form.control}
                name="listOptions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("opcionesLista")}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder={t("opcionesListaPlaceholder")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {atributo.dataType === "ref" ? (
              <FormField
                control={form.control}
                name="sourceRef"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("origenRef")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("seleccionarOrigen")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unidades_productivas">
                          {t("origen.unidades_productivas")}
                        </SelectItem>
                        <SelectItem value="inventario">
                          {t("origen.inventario")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="requerido"
              render={({ field }) => (
                <FormItem className="flex items-start gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange as CheckboxHandler}
                    />
                  </FormControl>
                  <div className="leading-tight">
                    <FormLabel>{t("atributoRequerido")}</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      {t("atributoRequeridoAyuda")}
                    </p>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("cancelar")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("guardando") : t("guardar")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type CheckboxHandler = (checked: boolean | "indeterminate") => void;

type DataTypeKey =
  | "dataType.text"
  | "dataType.number"
  | "dataType.date"
  | "dataType.list"
  | "dataType.ref";
