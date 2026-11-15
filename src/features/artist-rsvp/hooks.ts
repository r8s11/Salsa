import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/useAuth";
import { getArtistEvent, getPublicArtistRsvp, listArtistEvents, listArtistRsvps } from "./api";

function usePrivateScope() {
  const { user } = useAuth();
  const client = useQueryClient();
  const userId = user?.id ?? "";
  useEffect(() => () => { client.removeQueries({ queryKey: ["artist-private", userId] }); }, [client, userId]);
  return userId;
}
export function useArtistEvents(artistId: string) {
  const userId = usePrivateScope();
  return useQuery({ queryKey: ["artist-private", userId, artistId, "events"], queryFn: () => listArtistEvents(artistId), enabled: !!userId && !!artistId, retry: false, staleTime: 0 });
}
export function useArtistEvent(artistId: string, eventId: string) {
  const userId = usePrivateScope();
  return useQuery({ queryKey: ["artist-private", userId, artistId, "event", eventId], queryFn: () => getArtistEvent(artistId, eventId), enabled: !!userId && !!artistId && !!eventId, retry: false, staleTime: 0 });
}
export function useArtistRoster(eventId: string) {
  const userId = usePrivateScope();
  return useQuery({ queryKey: ["artist-private", userId, "roster", eventId], queryFn: () => listArtistRsvps(eventId), enabled: !!userId && !!eventId, retry: false, staleTime: 0 });
}
export function usePublicArtistRsvp(id: string) {
  return useQuery({ queryKey: ["artist-rsvp-summary", id], queryFn: () => getPublicArtistRsvp(id), enabled: !!id, retry: false });
}
export function useRefreshArtistRsvp() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: ["artist-private"] }),
    client.invalidateQueries({ queryKey: ["artist-rsvp-summary"] }),
    client.invalidateQueries({ queryKey: ["events"] }),
    client.invalidateQueries({ queryKey: ["event"] }),
  ]);
}
