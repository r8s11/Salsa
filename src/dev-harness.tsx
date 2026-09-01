import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EventDetailPage from "./pages/EventDetailPage";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 0 } },
});

function Harness() {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/events/d15a8854-f8ce-45bd-8279-e98857abd970"]}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
