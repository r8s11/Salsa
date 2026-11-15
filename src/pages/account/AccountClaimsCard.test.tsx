import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import AccountClaimsCard from "./AccountClaimsCard";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../lib/supabase", () => ({ supabase: { rpc } }));
vi.mock("../../contexts/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
async function show(statuses: string[], fail = false) {
 rpc.mockResolvedValue({ data: statuses.map((status, id) => ({ id, status })), error: fail ? { message: "Unavailable" } : null });
 const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 const view = render(<QueryClientProvider client={client}><MemoryRouter><AccountClaimsCard /></MemoryRouter></QueryClientProvider>);
 await client.refetchQueries();
 return view;
}
it("hides claims card when no claims exist", async () => { const { container } = await show([]); expect(container).toBeEmptyDOMElement(); });
it("hides claims card on request failure", async () => { const { container } = await show([], true); expect(container).toBeEmptyDOMElement(); });
it("counts pending claims and links to inbox", async () => {
 await show(["pending", "pending", "rejected"]);
 expect(await screen.findByText("2 waiting for review")).toBeInTheDocument();
 expect(screen.getByRole("link", { name: "Open your claims" })).toHaveAttribute("href", "/account/claims");
});
it("offers status history when all claims are decided", async () => {
 await show(["approved"]);
 expect(await screen.findByText("Check the status of your listing claims.")).toBeInTheDocument();
});
