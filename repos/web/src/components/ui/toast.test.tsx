import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { toast, ToastProvider, useToast } from "./toast";

function ToastFixture() {
  const toast = useToast();
  return <>
    <button onClick={() => toast.success("Saved", "Your changes are live.")} type="button">Show success</button>
    <button onClick={() => toast.error("Could not save")} type="button">Show error</button>
  </>;
}

describe("ToastProvider", () => {
  it("announces and dismisses notifications", () => {
    render(<ToastProvider><ToastFixture /></ToastProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Show success" }));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Your changes are live.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("supports error notifications", () => {
    render(<ToastProvider><ToastFixture /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Show error" }));
    expect(screen.getByText("Could not save")).toBeInTheDocument();
  });

  it("supports notifications outside React components", () => {
    render(<ToastProvider><span>Application</span></ToastProvider>);
    act(() => toast.success("Published"));
    expect(screen.getByText("Published")).toBeInTheDocument();
  });
});