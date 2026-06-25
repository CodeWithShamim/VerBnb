import FormPageShell from "@/components/FormPageShell";
import { type FormField } from "@/components/DisputeForm";

const fields: FormField[] = [
  {
    name: "listingUrl",
    label: "Listing URL",
    type: "url",
    placeholder: "https://airbnb.com/rooms/...",
    help: "The public listing page that described the property.",
    required: true,
  },
  {
    name: "evidenceFile",
    label: "Evidence (photos / report)",
    type: "file",
    target: "evidenceUrl",
    help: "Uploaded to IPFS — fills the evidence URL below automatically.",
  },
  {
    name: "evidenceUrl",
    label: "Evidence URL",
    type: "url",
    placeholder: "https://gateway.pinata.cloud/ipfs/...",
    help: "Auto-filled when you upload a file above.",
    required: true,
  },
  {
    name: "claimedAmount",
    label: "Amount paid (smallest currency unit)",
    type: "number",
    placeholder: "500000",
    required: true,
  },
];

export default function RentalPage() {
  return <FormPageShell category="RENTAL" fields={fields} />;
}
