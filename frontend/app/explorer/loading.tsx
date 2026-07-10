import Loader from "@/components/Loader";

/** Route-segment loading UI for /explorer. */
export default function Loading() {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <Loader label="Loading the explorer…" />
    </div>
  );
}
