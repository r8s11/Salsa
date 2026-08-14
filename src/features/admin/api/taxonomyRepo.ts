import { supabase } from "../../../lib/supabase";
import type { TaxonomyCategory, TaxonomyFilters, TaxonomyForm, TaxonomyTerm, TaxonomyTermDetail } from "../model/taxonomy";

export async function fetchTaxonomyDirectory(filters: TaxonomyFilters): Promise<TaxonomyTerm[]> {
  const { data, error } = await supabase.rpc("admin_taxonomy_directory", {
    p_search: filters.search,
    p_category: filters.category,
    p_status: filters.status,
    p_view: filters.view,
  });
  if (error) throw new Error(`Failed to load taxonomy terms: ${error.message}`);
  return (data ?? []) as TaxonomyTerm[];
}

export async function fetchTaxonomyTerm(id: string): Promise<TaxonomyTermDetail> {
  const { data, error } = await supabase.rpc("admin_taxonomy_detail", { p_id: id });
  if (error) throw new Error(`Failed to load taxonomy term: ${error.message}`);
  if (!data?.[0]) throw new Error("Taxonomy term not found");
  return data[0] as TaxonomyTermDetail;
}

export async function searchActiveTaxonomyTerms(category: TaxonomyCategory, search = ""): Promise<TaxonomyTerm[]> {
  const { data, error } = await supabase.rpc("admin_taxonomy_search", { p_category: category, p_search: search });
  if (error) throw new Error(`Failed to search taxonomy terms: ${error.message}`);
  return (data ?? []) as TaxonomyTerm[];
}

function termPayload(form: TaxonomyForm) {
  return {
    name: form.name.trim(),
    category: form.category,
    slug: form.slug,
    description: form.description.trim() || null,
    display_order: form.display_order,
    status: form.status,
  };
}

export async function createTaxonomyTerm(form: TaxonomyForm): Promise<TaxonomyTerm> {
  const { data, error } = await supabase.from("taxonomy_terms").insert(termPayload(form)).select().single();
  if (error) throw new Error(`Failed to create taxonomy term: ${error.message}`);
  return data as TaxonomyTerm;
}

export async function updateTaxonomyTerm(id: string, form: TaxonomyForm): Promise<void> {
  const { error } = await supabase.from("taxonomy_terms").update(termPayload(form)).eq("id", id);
  if (error) throw new Error(`Failed to update taxonomy term: ${error.message}`);
}

export async function archiveTaxonomyTerm(id: string): Promise<void> {
  const { error } = await supabase.from("taxonomy_terms").update({ status: "archived" }).eq("id", id);
  if (error) throw new Error(`Failed to archive taxonomy term: ${error.message}`);
}

export async function restoreTaxonomyTerm(id: string): Promise<void> {
  const { error } = await supabase.from("taxonomy_terms").update({ status: "active" }).eq("id", id);
  if (error) throw new Error(`Failed to restore taxonomy term: ${error.message}`);
}

export async function deleteTaxonomyTerm(id: string): Promise<void> {
  const { error } = await supabase.from("taxonomy_terms").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete taxonomy term: ${error.message}`);
}

export async function mergeTaxonomyTerms(keepId: string, mergeId: string): Promise<void> {
  const { error } = await supabase.rpc("merge_taxonomy_terms", { p_keep_id: keepId, p_merge_id: mergeId });
  if (error) throw new Error(`Failed to merge taxonomy terms: ${error.message}`);
}

export async function replaceEventTaxonomyTerms(eventId: string, taxonomyTermIds: string[]): Promise<void> {
  const { error } = await supabase.rpc("replace_event_taxonomy_terms", {
    p_event_id: eventId,
    p_taxonomy_term_ids: taxonomyTermIds,
  });
  if (error) throw new Error(`Failed to save event taxonomy terms: ${error.message}`);
}
