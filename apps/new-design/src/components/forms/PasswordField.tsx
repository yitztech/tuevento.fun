import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";

type Props = Omit<React.ComponentProps<"input">, "type"> & { label: string; error?: string; action?: React.ReactNode; hint?: string };

export function PasswordField({ label, error, action, hint, ...input }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <FormField label={label} error={error} action={action} hint={hint}>
      {(control) => (
        <div className="relative">
          <Input {...input} {...control} type={visible ? "text" : "password"} className="pr-12" />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? copy.auth.hide : copy.auth.show}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center rounded-r-md text-muted-foreground outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            {visible ? <EyeOff aria-hidden className="size-[1.1rem]" /> : <Eye aria-hidden className="size-[1.1rem]" />}
          </button>
        </div>
      )}
    </FormField>
  );
}
