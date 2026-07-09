import Link from 'next/link';
import DisputeForm, { type FormField } from '@/components/DisputeForm';
import FormSidePanel from '@/components/FormSidePanel';
import { CATEGORIES, type Category } from '@/lib/contracts';

/**
 * Shared professional split shell for the four dispute forms: a sticky
 * category context panel on the left, breadcrumb + heading + the sectioned
 * form on the right. The panel stacks below the form on small screens.
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
      <div className="container-page py-10 sm:py-14">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/" className="transition-colors hover:text-brand">
            Home
          </Link>
          <span aria-hidden>/</span>
          <Link href="/#categories" className="transition-colors hover:text-brand">
            Disputes
          </Link>
          <span aria-hidden>/</span>
          <span className={`font-medium ${meta.text}`}>{meta.title}</span>
        </nav>

        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[400px_minmax(0,1fr)]">
          {/* Context panel - left on desktop, below the form on mobile. */}
          <div className="order-2 lg:order-1">
            <FormSidePanel category={category} />
          </div>

          {/* Heading + form */}
          <div className="order-1 lg:order-2">
            <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl text-slate-900 sm:text-4xl">
                  Open a <span className="text-gradient-pop">{meta.title.toLowerCase()}</span> case
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                  Validators fetch your evidence directly - the more verifiable the links, the
                  faster consensus lands.
                </p>
              </div>
              <span className="chip mt-1 shrink-0">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Settles on-chain
              </span>
            </div>

            <DisputeForm category={category} fields={fields} />
          </div>
        </div>
      </div>
    </div>
  );
}
