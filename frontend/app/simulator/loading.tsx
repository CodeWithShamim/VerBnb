import Loader from "@/components/Loader";

/** Route-segment loading UI for /simulator. */
export default function Loading() {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <Loader label="Warming up the simulator…" />
    </div>
  );
}
