import { Button } from "@/components/ui/Button";

/** The cart could not be priced: say so and offer a retry, instead of showing made-up zeros. */
export function PricesError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 border-[3px] border-danger p-4">
      <p role="alert" className="m-0 text-sm text-danger-text">
        Não foi possível carregar os preços.
      </p>
      <Button variant="secondary" onClick={onRetry}>
        TENTAR DE NOVO
      </Button>
    </div>
  );
}
