import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ContextRail } from "./context-rail";

describe("ContextRail", () => {
  it("opens as a drawer and closes with Escape while restoring page state", async () => {
    const user = userEvent.setup();
    render(
      <ContextRail ariaLabel="Discussion context" className="route-context-rail" title="Discussion context">
        <p>Discussion details</p>
      </ContextRail>,
    );

    const trigger = screen.getByRole("button", { name: "Open discussion context" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("complementary", { name: "Discussion context" })).toHaveClass("open");
    expect(document.body).toHaveStyle({ overflow: "hidden" });
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Close discussion context" }).at(-1)).toHaveFocus());

    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    await waitFor(() => expect(document.body).not.toHaveStyle({ overflow: "hidden" }));
  });
});