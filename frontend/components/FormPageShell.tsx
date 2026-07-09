import Link from "next/link";
import DisputeForm, { type FormField } from "@/components/DisputeForm";
import FormSidePanel from "@/components/FormSidePanel";
import { CATEGORIES, type Category } from "@/lib/contracts";

/**
 * Shared split-layout shell for the four dispute forms: the form on the left,
 * an animated category panel (3D badge + process timeline) on the right. The
 * panel stacks below the form on small screens.
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
      <div className="container-page py-12 sm:py-16">
        <Link
          href="/"
          className="group mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
            ←
          </span>
          Back to all categories
        </Link>

        <div className="mb-8 max-w-2xl">
          <span className={`chip ${meta.text}`}>{meta.title} dispute</span>
          <h1 className="mt-3 text-4xl text-slate-900 sm:text-5xl">
            Open a <span className="text-gradient-pop">{meta.title.toLowerCase()}</span>{" "}
            case
          </h1>
          <p className="mt-3 text-slate-500">
            Fill in the details below — validators fetch your evidence directly, so
            the more verifiable the links, the faster consensus lands.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <DisputeForm category={category} fields={fields} />
          </div>
          <FormSidePanel category={category} />
        </div>
      </div>
    </div>
  );
}
