import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormMessage } from "@/components/ui/FormMessage";

describe("FormMessage", () => {
  it("keeps one status region and one alert region mounted, never swapping a role", () => {
    const { rerender } = render(<FormMessage />);
    const status = screen.getByRole("status", { hidden: true });
    const alert = screen.getByRole("alert", { hidden: true });
    expect(status).toBeEmptyDOMElement();
    expect(alert).toBeEmptyDOMElement();

    rerender(<FormMessage success="Salvo." />);
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Salvo.");
    expect(alert).toBeEmptyDOMElement();

    rerender(<FormMessage error="Falhou." />);
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent("Falhou.");
    expect(status).toBeEmptyDOMElement();
  });
});
