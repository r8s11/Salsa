import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveTaxonomyTerm,
  createTaxonomyTerm,
  deleteTaxonomyTerm,
  fetchTaxonomyDirectory,
  fetchTaxonomyTerm,
  mergeTaxonomyTerms,
  restoreTaxonomyTerm,
  searchActiveTaxonomyTerms,
  updateTaxonomyTerm,
} from "../api/taxonomyRepo";
import type { TaxonomyCategory, TaxonomyFilters, TaxonomyForm } from "../model/taxonomy";

const taxonomyKey = ["admin", "taxonomy"] as const;

export function useAdminTaxonomy(filters: TaxonomyFilters) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: taxonomyKey });
  const directory = useQuery({
    queryKey: [...taxonomyKey, filters],
    queryFn: () => fetchTaxonomyDirectory(filters),
  });
  const create = useMutation({ mutationFn: createTaxonomyTerm, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, form }: { id: string; form: TaxonomyForm }) => updateTaxonomyTerm(id, form),
    onSuccess: invalidate,
  });
  const archive = useMutation({ mutationFn: archiveTaxonomyTerm, onSuccess: invalidate });
  const restore = useMutation({ mutationFn: restoreTaxonomyTerm, onSuccess: invalidate });
  const remove = useMutation({ mutationFn: deleteTaxonomyTerm, onSuccess: invalidate });
  const merge = useMutation({
    mutationFn: ({ keepId, mergeId }: { keepId: string; mergeId: string }) =>
      mergeTaxonomyTerms(keepId, mergeId),
    onSuccess: invalidate,
  });
  return {
    terms: directory.data ?? [],
    isLoading: directory.isPending,
    error: directory.error ? directory.error.message : null,
    create,
    update,
    archive,
    restore,
    remove,
    merge,
  };
}

export function useAdminTaxonomyTerm(id: string | undefined) {
  const query = useQuery({
    queryKey: [...taxonomyKey, "term", id],
    queryFn: () => fetchTaxonomyTerm(id!),
    enabled: Boolean(id),
  });
  return {
    term: query.data ?? null,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
  };
}

export function useActiveTaxonomyTerms(category: TaxonomyCategory) {
  const query = useQuery({
    queryKey: [...taxonomyKey, "active", category],
    queryFn: () => searchActiveTaxonomyTerms(category),
  });
  return {
    terms: query.data ?? [],
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
  };
}
