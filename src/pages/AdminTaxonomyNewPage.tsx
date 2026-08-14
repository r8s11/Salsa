import { useNavigate, useSearchParams } from "react-router-dom";
import AdminTaxonomyForm, { EMPTY_TAXONOMY_FORM } from "../components/Admin/AdminTaxonomyForm";
import { useAdminTaxonomy } from "../features/admin/hooks/useAdminTaxonomy";
import { DEFAULT_TAXONOMY_FILTERS, type TaxonomyCategory } from "../features/admin/model/taxonomy";

export default function AdminTaxonomyNewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const category = params.get("category") as TaxonomyCategory | null;
  const { create } = useAdminTaxonomy(DEFAULT_TAXONOMY_FILTERS);
  return <AdminTaxonomyForm initial={{ ...EMPTY_TAXONOMY_FORM, category: category ?? "dance_style" }} submitLabel="Add taxonomy term" isSaving={create.isPending} onCancel={() => navigate("/admin/tags")} onSubmit={(form) => create.mutate(form, { onSuccess: (term) => navigate(`/admin/tags/${term.id}`) })} />;
}
