import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormField } from "./form-field";
import { Modal } from "./modal";
import { Select } from "./select";
import { Toast } from "./toast";

describe("shared interaction primitives", () => {
  it("connects validation errors to form controls", () => {
    render(<FormField error="Enter a valid address" label="Email" name="email" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid address");
  });

  it("selects rich options and contributes their value to form data", () => {
    const { container } = render(
      <form>
        <Select
          defaultValue="public"
          name="visibility"
          options={[
            { description: "Visible to everyone", label: "Public", value: "public" },
            { description: "Visible after joining", label: "Members only", value: "members" },
          ]}
        />
      </form>,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /Members only/ }));

    expect(screen.getByRole("combobox")).toHaveTextContent("Members only");
    expect(new FormData(container.querySelector("form")!).get("visibility")).toBe("members");

    fireEvent.reset(container.querySelector("form")!);
    expect(screen.getByRole("combobox")).toHaveTextContent("Public");
    expect(new FormData(container.querySelector("form")!).get("visibility")).toBe("public");
  });

  it("prevents required selects from submitting an empty value", () => {
    const { container } = render(
      <form>
        <Select defaultValue="" name="reason" options={[{ disabled: true, label: "Select reason", value: "" }, { label: "Spam", value: "spam" }]} required />
      </form>,
    );
    const form = container.querySelector("form")!;

    expect(fireEvent.submit(form)).toBe(false);
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("combobox")).toHaveFocus();
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