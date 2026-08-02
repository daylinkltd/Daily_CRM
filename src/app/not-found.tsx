import { ErrorState } from "@/components/layout/error-state";

/** 404 — an unmatched route anywhere in the app. */
export default function NotFound() {
  return (
    <ErrorState
      code="404"
      title="That page does not exist"
      message="The link may be out of date, or the record it pointed at may have been deleted."
    />
  );
}
