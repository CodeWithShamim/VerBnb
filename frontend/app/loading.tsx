import Loader from '@/components/Loader';

/** Route-segment loading UI - shown by the App Router while a page streams. */
export default function Loading() {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <Loader label="Loading VerBnb…" />
    </div>
  );
}
