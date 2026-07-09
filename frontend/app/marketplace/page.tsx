import FormPageShell from '@/components/FormPageShell';
import { type FormField } from '@/components/DisputeForm';

// Defaults are demo values that validators can actually fetch (IPFS-pinned
// sample listing + evidence) so a submission resolves without extra setup.
const fields: FormField[] = [
  {
    name: 'listingUrl',
    label: 'Seller listing URL',
    type: 'url',
    section: 'Case details',
    placeholder: 'https://ebay.com/itm/...',
    defaultValue:
      'https://gateway.pinata.cloud/ipfs/bafkreihc6ramgg7qgyyeeb3lhkp6sv7ksqq4ygd7ov3batogaz5d3bziea',
    help: 'The product listing as advertised by the seller.',
    required: true,
  },
  {
    name: 'evidenceFile',
    label: 'Evidence (photos of item received)',
    type: 'file',
    section: 'Evidence',
    target: 'evidenceUrl',
    help: 'Uploaded to IPFS - fills the evidence URL below automatically.',
  },
  {
    name: 'evidenceUrl',
    label: 'Buyer evidence URL',
    type: 'url',
    placeholder: 'https://gateway.pinata.cloud/ipfs/...',
    defaultValue:
      'https://gateway.pinata.cloud/ipfs/bafkreigtllqbm2jirb6dg6a7zpyvhl77rpphozgh65cv2ejktrkaqvskga',
    required: true,
  },
];

export default function MarketplacePage() {
  return <FormPageShell category="PRODUCT" fields={fields} />;
}
