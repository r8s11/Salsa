import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EntityFieldAssist, EntityNameTypeahead } from "./EntityMatchAssist";
import type { RecordPrefill } from "./entityPrefill";
import type { EntityMatch } from "./entityReview";

const client = vi.hoisted(() => ({ searchEntityMatches: vi.fn(), reconcileEntities: vi.fn() }));
vi.mock("./entityReviewClient", () => client);

const STUDIO: EntityMatch = {
  id: "aaaaaaaa-1111-4111-8111-111111111111",
  name: "Love For Movement Studio",
  address: "580 8th Ave Floor 4",
};

function VenueField() {
  const [text, setText] = useState("");
  const [prefill, setPrefill] = useState<RecordPrefill<"location"> | null>(null);
  return (
    <div className="event-form__field">
      <label htmlFor="venue">Venue Name</label>
      <input id="venue" value={text} onChange={(event) => setText(event.target.value)} />
      <EntityFieldAssist
        kind="venue"
        text={text}
        fieldId="venue"
        searchEnabled
        prefill={prefill}
        onPick={(match) => {
          setText(match.name);
          setPrefill({
            recordName: match.name,
            filled: [{ field: "location", label: "Venue name", previous: text, next: match.name }],
            kept: [],
          });
        }}
        onUndo={() => setPrefill(null)}
        onAcceptKept={() => undefined}
      />
    </div>
  );
}

beforeEach(() => {
  client.searchEntityMatches.mockReset();
  client.searchEntityMatches.mockResolvedValue([STUDIO]);
});

describe("entity match keyboard flow", () => {
  it("moves focus to the linked confirmation, then back to the venue field after undo", async () => {
    const user = userEvent.setup();
    render(<VenueField />);

    await user.type(screen.getByLabelText("Venue Name"), "Love For");
    const link = await screen.findByRole("button", { name: "Link Love For Movement Studio as the venue" });
    link.focus();
    await user.keyboard("{Enter}");

    const undo = await screen.findByRole("button", { name: "Undo link and filled details" });
    expect(undo).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Venue Name")).toHaveFocus();
  });

  it("returns focus to the name field after linking from an added-name typeahead", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    client.searchEntityMatches.mockResolvedValue([{ id: STUDIO.id, name: "La Chispa Social" }]);
    render(
      <EntityNameTypeahead kind="organizer" label="Organizer name" addLabel="Suggest as new" onPick={onPick} onAdd={vi.fn()} />
    );

    await user.type(screen.getByLabelText("Organizer name"), "chispa");
    const link = await screen.findByRole("button", { name: "Link La Chispa Social as the organizer" });
    link.focus();
    await user.keyboard("{Enter}");

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: "La Chispa Social" }), "chispa");
    expect(screen.getByLabelText("Organizer name")).toHaveFocus();
    expect(screen.getByLabelText("Organizer name")).toHaveValue("");
  });
});
