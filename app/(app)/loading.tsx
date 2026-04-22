import { Skeleton } from "@/components/app/states/skeleton";

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 border-b border-border pb-4">
        <Skeleton.Title className="h-7 w-[240px]" />
        <Skeleton.Text line={60} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Skeleton.Box className="h-[96px]" />
        <Skeleton.Box className="h-[96px]" />
        <Skeleton.Box className="h-[96px]" />
        <Skeleton.Box className="h-[96px]" />
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton.Box className="h-10" />
        <Skeleton.Box className="h-64" />
      </div>
    </div>
  );
}
