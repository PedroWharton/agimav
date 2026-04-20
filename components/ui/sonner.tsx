"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { Check, X, AlertTriangle, Info, Loader2 } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <Check className="size-[15px]" strokeWidth={2} />,
        info: <Info className="size-[15px]" strokeWidth={2} />,
        warning: <AlertTriangle className="size-[15px]" strokeWidth={2} />,
        error: <X className="size-[15px]" strokeWidth={2} />,
        loading: <Loader2 className="size-[15px] animate-spin" strokeWidth={2} />,
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: "cn-toast",
          success: "cn-toast-success",
          error: "cn-toast-error",
          warning: "cn-toast-warning",
          info: "cn-toast-info",
          loading: "cn-toast-loading",
          icon: "cn-toast-icon",
          title: "cn-toast-title",
          description: "cn-toast-description",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
