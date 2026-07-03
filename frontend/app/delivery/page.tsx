import FormPageShell from "@/components/FormPageShell";
import { type FormField } from "@/components/DisputeForm";

// Defaults are demo values with IPFS-pinned evidence validators can actually
// fetch, so a submission resolves without extra setup.
const fields: FormField[] = [
  {
    name: "orderId",
    label: "Order ID",
    type: "text",
    placeholder: "ORD-10293",
    defaultValue: "ORD-10293",
    required: true,
  },
  {
    name: "evidenceFile",
    label: "Courier proof-of-delivery",
    type: "file",
    target: "evidenceUrl",
    help: "Tracking screenshot / POD photo. Uploaded to IPFS.",
  },
  {
    name: "evidenceUrl",
    label: "Courier evidence URL",
    type: "url",
    placeholder: "https://gateway.pinata.cloud/ipfs/...",
    defaultValue:
      "https://gateway.pinata.cloud/ipfs/bafkreigtllqbm2jirb6dg6a7zpyvhl77rpphozgh65cv2ejktrkaqvskga",
    required: true,
  },
  {
    name: "customerClaim",
    label: "Customer claim",
    type: "textarea",
    placeholder: "Parcel never arrived; no one signed for it.",
    defaultValue: "Parcel never arrived; no one signed for it.",
    required: true,
  },
  {
    name: "expectedAddress",
    label: "Expected delivery address",
    type: "text",
    placeholder: "742 Evergreen Terrace, Springfield",
    defaultValue: "742 Evergreen Terrace, Springfield",
    required: true,
  },
];

export default function DeliveryPage() {
  return <FormPageShell category="DELIVERY" fields={fields} />;
}
