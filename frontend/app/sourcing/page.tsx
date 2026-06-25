import FormPageShell from "@/components/FormPageShell";
import { type FormField } from "@/components/DisputeForm";

const fields: FormField[] = [
  {
    name: "brandId",
    label: "Brand ID",
    type: "text",
    placeholder: "ecothreads",
    required: true,
  },
  {
    name: "claim",
    label: "Sourcing claim to validate",
    type: "textarea",
    placeholder: "100% organic cotton, fair-trade certified",
    required: true,
  },
  {
    name: "certificationUrl",
    label: "Certification registry URL",
    type: "url",
    placeholder: "https://fairtrade.org/cert/...",
    help: "Public certification page validators will fetch.",
    required: true,
  },
  {
    name: "supplierRegistryUrl",
    label: "Supplier registry URL",
    type: "url",
    placeholder: "https://supplier-registry.org/...",
    required: true,
  },
];

export default function SourcingPage() {
  return <FormPageShell category="SOURCING" fields={fields} />;
}
