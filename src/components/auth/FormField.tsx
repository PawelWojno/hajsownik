import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  icon: ReactNode;
  endContent?: ReactNode;
  disabled?: boolean;
  inputClassName?: string;
}

export function FormField({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  hint,
  icon,
  endContent,
  disabled,
  inputClassName,
}: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div>
      <Label htmlFor={id} className="text-muted-foreground mb-1 block leading-5 font-normal">
        {label}
      </Label>
      <div className="relative">
        <span className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2">{icon}</span>
        <Input
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn("dark:bg-card h-10.5 pl-10 md:text-base", inputClassName)}
        />
        {endContent}
      </div>
      {error ? (
        <p id={errorId} className="text-destructive mt-1 flex items-center gap-1 text-xs">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}
