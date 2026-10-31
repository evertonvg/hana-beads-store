import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "@/components/ui/CopyButton";
import { OrderProgress } from "@/components/ui/OrderProgress";
import { PixQr } from "@/components/ui/PixQr";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Switch } from "@/components/ui/Switch";

describe("Switch", () => {
  it("toggles aria-checked and calls onCheckedChange(true)", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <Switch
          checked={checked}
          onCheckedChange={(v) => {
            onCheckedChange(v);
            setChecked(v);
          }}
          label="Novidades"
          description="Receber por e-mail"
        />
      );
    }
    render(<Harness />);
    const sw = screen.getByRole("switch", { name: "Novidades" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await user.click(sw);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });
});

describe("QuantityStepper", () => {
  function Harness({ initial }: { initial: number }) {
    const [v, setV] = useState(initial);
    return <QuantityStepper value={v} onChange={setV} label="Quantidade" />;
  }

  it("does not go below 1", async () => {
    const user = userEvent.setup();
    render(<Harness initial={1} />);
    await user.click(screen.getByRole("button", { name: "Diminuir quantidade" }));
    expect(screen.getByRole("spinbutton", { name: "Quantidade" })).toHaveValue(1);
  });

  it("keeps the bound buttons focusable (aria-disabled, not disabled)", async () => {
    const user = userEvent.setup();
    render(<Harness initial={1} />);
    const minus = screen.getByRole("button", { name: "Diminuir quantidade" });
    expect(minus).toHaveAttribute("aria-disabled", "true");
    expect(minus).toBeEnabled();
    await user.tab();
    expect(minus).toHaveFocus();
  });

  it("does not submit a surrounding form on Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    function InForm() {
      const [v, setV] = useState(5);
      return (
        <form onSubmit={onSubmit}>
          <QuantityStepper value={v} onChange={setV} label="Quantidade" />
        </form>
      );
    }
    render(<InForm />);
    const input = screen.getByRole("spinbutton", { name: "Quantidade" });
    await user.clear(input);
    await user.type(input, "7{Enter}");
    expect(input).toHaveValue(7);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not go above 99", async () => {
    const user = userEvent.setup();
    render(<Harness initial={99} />);
    await user.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
    expect(screen.getByRole("spinbutton", { name: "Quantidade" })).toHaveValue(99);
  });

  it("clamps typed values on blur", async () => {
    const user = userEvent.setup();
    render(<Harness initial={5} />);
    const input = screen.getByRole("spinbutton", { name: "Quantidade" });
    await user.clear(input);
    await user.type(input, "250");
    await user.tab();
    expect(input).toHaveValue(99);
  });
});

describe("CopyButton", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the copied label, then resets after 2500ms", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyButton value="000201" />);
    await act(() => {
      screen.getByRole("button", { name: "COPIAR" }).click();
      return Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith("000201");
    expect(screen.getByRole("button", { name: "COPIADO ✓" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByRole("button", { name: "COPIAR" })).toBeInTheDocument();
  });

  it("announces the copy in a persistent status region, not only in the button label", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyButton value="000201" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");
    await act(() => {
      screen.getByRole("button", { name: "COPIAR" }).click();
      return Promise.resolve();
    });
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Copiado para a área de transferência.");
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(status).toHaveTextContent("");
  });

  it("still swaps the label when the clipboard fails", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyButton value="x" />);
    await act(() => {
      screen.getByRole("button", { name: "COPIAR" }).click();
      return Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "COPIADO ✓" })).toBeInTheDocument();
  });
});

describe("OrderProgress", () => {
  it("paints 2 segments with the color and 2 with #2C2840 at step 2", () => {
    render(<OrderProgress step={2} color="#FF5FAE" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "4");
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    const segments = Array.from(bar.querySelectorAll<HTMLElement>("[data-segment]"));
    expect(segments).toHaveLength(4);
    expect(segments.map((s) => s.style.backgroundColor)).toEqual([
      "rgb(255, 95, 174)",
      "rgb(255, 95, 174)",
      "rgb(44, 40, 64)",
      "rgb(44, 40, 64)",
    ]);
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.getByText("Entregue")).toBeInTheDocument();
  });
});

describe("PixQr", () => {
  it("renders an svg with the aria-label", () => {
    render(<PixQr value="00020126" label="QR Code do PIX" />);
    const img = screen.getByRole("img", { name: "QR Code do PIX" });
    expect(img.tagName.toLowerCase()).toBe("svg");
  });
});
