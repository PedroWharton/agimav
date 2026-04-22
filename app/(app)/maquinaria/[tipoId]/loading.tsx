import { Skeleton } from "@/components/app/states/skeleton";

export default function MaquinariaTipoLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton.Title className="h-7 w-[280px]" />
          <Skeleton.Text line={60} />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton.Box className="h-9 w-[140px]" />
          <Skeleton.Box className="h-9 w-[140px]" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Skeleton.Box className="h-[96px]" />
        <Skeleton.Box className="h-[96px]" />
        <Skeleton.Box className="h-[96px]" />
        <Skeleton.Box className="h-[96px]" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton.Chip className="w-[90px]" />
        <Skeleton.Chip className="w-[110px]" />
        <Skeleton.Chip className="w-[80px]" />
        <Skeleton.Chip className="w-[100px]" />
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton.Box className="h-10" />
        <Skeleton.Box className="h-[360px]" />
      </div>
    </div>
  );
}
