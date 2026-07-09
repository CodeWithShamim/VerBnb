import FormPageShell from "@/components/FormPageShell";
import { type FormField } from "@/components/DisputeForm";

// Defaults are demo values on pages validators can actually fetch, so a
// submission resolves without extra setup.
const fields: FormField[] = [
  {
    name: "brandId",
    label: "Brand ID",
    type: "text",
    section: "Claim details",
    placeholder: "ecothreads",
    defaultValue: "ecothreads",
    required: true,
  },
  {
    name: "claim",
    label: "Sourcing claim to validate",
    type: "textarea",
    placeholder: "100% organic cotton, fair-trade certified",
    defaultValue: "100% organic cotton, fair-trade certified",
    required: true,
  },
  {
    name: "certificationUrl",
    label: "Certification registry URL",
    type: "url",
    section: "Verification sources",
    placeholder: "https://fairtrade.org/cert/...",
    defaultValue: "https://github.com/CodeWithShamim/VerBnb",
    help: "Public certification page validators will fetch.",
    required: true,
  },
  {
    name: "supplierRegistryUrl",
    label: "Supplier registry URL",
    type: "url",
    placeholder: "https://supplier-registry.org/...",
    defaultValue: "https://github.com/CodeWithShamim/VerBnb",
    required: true,
  },
];

export default function SourcingPage() {
  return <FormPageShell category="SOURCING" fields={fields} />;
}
