import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ManagedCategory } from "@/types";

/** Pseudo error code: the id matched no row visible to the caller (RLS hides foreign rows, it does not raise). */
export const NOT_FOUND = "not_found";

const categoryRows = z.array(z.object({ id: z.string(), name: z.string(), archived_at: z.string().nullable() }));

/** Outcome of a mutation. `categories: null` = the change is saved but the fresh list could not be read. */
export type CategoryResult = { ok: true; categories: ManagedCategory[] | null } | { ok: false; code: string };

/** All categories of the caller's household (RLS): active ones by sort_order first, then archived ones. */
export async function listCategories(supabase: SupabaseClient): Promise<ManagedCategory[]> {
  const { data, error } = await supabase.from("categories").select("id, name, archived_at").order("sort_order");
  if (error) throw new Error(error.message);

  const categories = categoryRows
    .parse(data)
    .map((row) => ({ id: row.id, name: row.name, archived: row.archived_at !== null }));
  // Array.prototype.sort is stable, so the sort_order inside each group is kept.
  return categories.sort((a, b) => Number(a.archived) - Number(b.archived));
}

/** The write is already committed here, so a failed read must not look like a failed write (it would invite a retry). */
async function succeeded(supabase: SupabaseClient): Promise<CategoryResult> {
  try {
    return { ok: true, categories: await listCategories(supabase) };
  } catch {
    return { ok: true, categories: null };
  }
}

function failed(error: { code?: string }): CategoryResult {
  return { ok: false, code: error.code ?? "" };
}

export async function addCategory(supabase: SupabaseClient, name: string): Promise<CategoryResult> {
  const { error } = await supabase.rpc("add_category", { p_name: name });
  return error ? failed(error) : succeeded(supabase);
}

/** RLS turns a foreign or missing id into "0 rows changed" instead of an error, so the row count is checked. */
export async function renameCategory(supabase: SupabaseClient, id: string, name: string): Promise<CategoryResult> {
  const { data, error } = await supabase.from("categories").update({ name }).eq("id", id).select("id");
  if (error) return failed(error);
  return data.length === 0 ? { ok: false, code: NOT_FOUND } : succeeded(supabase);
}

export async function setArchived(supabase: SupabaseClient, id: string, archived: boolean): Promise<CategoryResult> {
  const { data, error } = await supabase
    .from("categories")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) return failed(error);
  return data.length === 0 ? { ok: false, code: NOT_FOUND } : succeeded(supabase);
}

export async function deleteCategory(supabase: SupabaseClient, id: string): Promise<CategoryResult> {
  const { data, error } = await supabase.from("categories").delete().eq("id", id).select("id");
  if (error) return failed(error);
  return data.length === 0 ? { ok: false, code: NOT_FOUND } : succeeded(supabase);
}

/** `ids` must list every category (active first, then archived) in the wanted order. */
export async function reorderCategories(supabase: SupabaseClient, ids: string[]): Promise<CategoryResult> {
  const { error } = await supabase.rpc("reorder_categories", { p_ids: ids });
  return error ? failed(error) : succeeded(supabase);
}
