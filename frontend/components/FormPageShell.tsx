import Link from "next/link";
import DisputeForm, { type FormField } from "@/components/DisputeForm";
import { CATEGORIES, type Category } from "@/lib/contracts";

/**
 * Shared light page shell for the four dispute forms: a back link, an accent
 * eyebrow, and the centered DisputeForm.
 */
export default function FormPageShell({
  category,
  fields,
}: {
  category: Category;
  fields: FormField[];
}) {
  const meta = CATEGORIES[category];
  return (
    <div className="bg-grid">
      <div className="container-page max-w-2xl py-12 sm:py-16">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
            ←
          </span>
          Back to all categories
        </Link>
        <DisputeForm category={category} fields={fields} />
      </div>
    </div>
  );
}
