import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";

export type AuditMetaProps = {
  createdAt?: Date | null;
  createdBy?: string | null;
  updatedAt?: Date | null;
  updatedBy?: string | null;
};

function rel(date: Date): string {
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: es });
}

export function AuditMeta({ createdAt, createdBy, updatedAt, updatedBy }: AuditMetaProps) {
  if (!createdAt && !updatedAt) return null;
  const showUpdated =
    updatedAt && createdAt && updatedAt.getTime() - createdAt.getTime() > 2000;

  return (
    <div className="grid gap-1 text-xs text-muted-foreground">
      {createdAt ? (
        <span>
          Creado {rel(createdAt)}
          {createdBy ? ` por ${createdBy}` : ""}
        </span>
      ) : null}
      {showUpdated ? (
        <span>
          Editado {rel(updatedAt!)}
          {updatedBy ? ` por ${updatedBy}` : ""}
        </span>
      ) : null}
    </div>
  );
}
