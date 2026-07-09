import FormPageShell from "@/components/FormPageShell";
import { type FormField } from "@/components/DisputeForm";

// Defaults are demo values that validators can actually fetch (IPFS-pinned
// sample listing + evidence) so a submission resolves without extra setup.
const fields: FormField[] = [
  {
    name: "listingUrl",
    label: "Listing URL",
    type: "url",
    section: "Case details",
    placeholder: "https://airbnb.com/rooms/...",
    defaultValue:
      "https://gateway.pinata.cloud/ipfs/bafkreihc6ramgg7qgyyeeb3lhkp6sv7ksqq4ygd7ov3batogaz5d3bziea",
    help: "The public listing page that described the property.",
    required: true,
  },
  {
    name: "evidenceFile",
    label: "Evidence (photos / report)",
    type: "file",
    section: "Evidence",
    target: "evidenceUrl",
    help: "Uploaded to IPFS — fills the evidence URL below automatically.",
  },
  {
    name: "evidenceUrl",
    label: "Evidence URL",
    type: "url",
    placeholder: "https://gateway.pinata.cloud/ipfs/...",
    defaultValue:
      "https://gateway.pinata.cloud/ipfs/bafkreigtllqbm2jirb6dg6a7zpyvhl77rpphozgh65cv2ejktrkaqvskga",
    help: "Auto-filled when you upload a file above.",
    required: true,
  },
  {
    name: "claimedAmount",
    label: "Amount paid (smallest currency unit)",
    type: "number",
    section: "Claim",
    placeholder: "500000",
    defaultValue: "500000",
    required: true,
  },
];

export default function RentalPage() {
  return <FormPageShell category="RENTAL" fields={fields} />;
}
