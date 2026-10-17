import { LogIn, Mail, Lock } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";

/** Dev-only: FormField needs ReactNode/function props, which .astro cannot pass, so the auth controls live here. */
const forcedFocus = "border-ring ring-ring/50 ring-3";
const noop = () => undefined;

export function AuthFieldDemo({ state }: { state: "default" | "focus" | "disabled" | "error" }) {
  return (
    <div className="max-w-sm">
      <FormField
        id={`auth-email-${state}`}
        label="Email"
        type="email"
        value={state === "error" ? "jan@" : "jan@example.pl"}
        onChange={noop}
        icon={<Mail className="size-4" />}
        disabled={state === "disabled"}
        inputClassName={state === "focus" ? forcedFocus : undefined}
        error={state === "error" ? "Podaj poprawny adres email" : undefined}
      />
    </div>
  );
}

export function AuthButtonDemo({ state }: { state: "default" | "hover" | "disabled" | "loading" }) {
  return (
    <div className="max-w-sm">
      <SubmitButton
        pendingText="Loguję…"
        icon={<LogIn className="size-4" />}
        pending={state === "disabled" || state === "loading"}
        className={state === "hover" ? "bg-primary-hover" : undefined}
      >
        Zaloguj się
      </SubmitButton>
    </div>
  );
}

/** Password field with the toggle; `focus` forces the toggle's focus ring (PasswordToggle has no className prop). */
export function AuthToggleDemo({ focus }: { focus?: boolean }) {
  return (
    <div className="max-w-sm">
      <FormField
        id={focus ? "auth-password-focus" : "auth-password"}
        label="Hasło"
        type="password"
        value="tajnehaslo"
        onChange={noop}
        icon={<Lock className="size-4" />}
        endContent={
          <span className={focus ? "[&_button]:ring-ring/50 [&_button]:ring-3" : undefined}>
            <PasswordToggle visible={false} onToggle={noop} />
          </span>
        }
      />
    </div>
  );
}
