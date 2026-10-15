import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Dev-only: the Select context has to be created inside one React tree, so the whole disabled select lives here. */
export function DisabledSelectDemo() {
  return (
    <Select disabled value="wynagrodzenie">
      <SelectTrigger id="dis-source" className="dark:bg-card min-h-11 w-full">
        <SelectValue>wynagrodzenie</SelectValue>
      </SelectTrigger>
    </Select>
  );
}
