import FormPageShell from "@/components/FormPageShell";
import { type FormField } from "@/components/DisputeForm";

const fields: FormField[] = [
  {
    name: "orderId",
    label: "Order ID",
    type: "text",
    placeholder: "ORD-10293",
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
    required: true,
  },
  {
    name: "customerClaim",
    label: "Customer claim",
    type: "textarea",
    placeholder: "Parcel never arrived; no one signed for it.",
    required: true,
  },
  {
    name: "expectedAddress",
    label: "Expected delivery address",
    type: "text",
    placeholder: "742 Evergreen Terrace, Springfield",
    required: true,
  },
];

export default function DeliveryPage() {
  return <FormPageShell category="DELIVERY" fields={fields} />;
}
