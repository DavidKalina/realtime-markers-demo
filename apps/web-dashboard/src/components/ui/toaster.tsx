"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/hooks/useToast";
import { CheckCircle, XCircle, Info } from "lucide-react";

export function Toaster() {
  const { toasts, removeToast } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, type }) {
        return (
          <Toast
            key={id}
            variant={type === "error" ? "destructive" : "default"}
          >
            <div className="flex items-center gap-2">
              {type === "success" && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {type === "error" && <XCircle className="h-4 w-4 text-red-500" />}
              {type === "info" && <Info className="h-4 w-4 text-blue-500" />}
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            <ToastClose onClick={() => removeToast(id)} />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
