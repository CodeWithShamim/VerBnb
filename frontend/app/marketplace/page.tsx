import FormPageShell from "@/components/FormPageShell";
import { type FormField } from "@/components/DisputeForm";

const fields: FormField[] = [
  {
    name: "listingUrl",
    label: "Seller listing URL",
    type: "url",
    placeholder: "https://ebay.com/itm/...",
    help: "The product listing as advertised by the seller.",
    required: true,
  },
  {
    name: "evidenceFile",
    label: "Evidence (photos of item received)",
    type: "file",
    target: "evidenceUrl",
    help: "Uploaded to IPFS — fills the evidence URL below automatically.",
  },
  {
    name: "evidenceUrl",
    label: "Buyer evidence URL",
    type: "url",
    placeholder: "https://gateway.pinata.cloud/ipfs/...",
    required: true,
  },
];

export default function MarketplacePage() {
  return <FormPageShell category="PRODUCT" fields={fields} />;
}
