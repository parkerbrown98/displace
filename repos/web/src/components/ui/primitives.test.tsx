import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormField } from "./form-field";
import { Modal } from "./modal";
import { Toast } from "./toast";

describe("shared interaction primitives", () => {
  it("connects validation errors to form controls", () => {
    render(<FormField error="Enter a valid address" label="Email" name="email" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid address");
  });

  it("dismisses a modal from its close control", () => {
    const onDismiss = vi.fn();
    render(<Modal title="Sign in" onDismiss={onDismiss}>Account form</Modal>);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("announces error toasts immediately", () => {
    render(<Toast message="Try again later." title="Request failed" tone="error" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Request failedTry again later.");
  });
});