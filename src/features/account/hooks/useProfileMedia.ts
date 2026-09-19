import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateOwnProfile } from "../api/accountRepo";
import type { OwnProfile } from "../model/account";
import {
  profileMediaErrorMessage,
  removeAvatarFile,
  removeCoverFile,
  uploadAvatarFile,
  uploadCoverFile,
  type CropGeometry,
  type ProfileMediaKind,
} from "../api/profileMedia";

type MediaSlotState = {
  isBusy: boolean;
  error: string | null;
};

const IDLE_SLOT: MediaSlotState = { isBusy: false, error: null };

function profileUpdateErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/row-level security|permission|policy|unauthorized|not authorized/i.test(message)) {
    return "You don't have permission to change this photo. Sign in again and try once more.";
  }
  return "We couldn't save your changes. Please try again.";
}

function isMissingObjectError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /not found|no such|does not exist|404/i.test(message);
}

/**
 * Avatar + cover upload/replace/remove for the signed-in user.
 * Media mutations patch ONLY their own column ({ avatar_url } or
 * { cover_url }) — unrelated profile fields are never overwritten — and
 * merge the result into the ["profile", "mine", userId] cache entry using
 * the same setQueryData pattern as useUpdateOwnProfile.
 */
export function useProfileMedia(userId: string | undefined) {
  const queryClient = useQueryClient();
  const [avatar, setAvatar] = useState<MediaSlotState>(IDLE_SLOT);
  const [cover, setCover] = useState<MediaSlotState>(IDLE_SLOT);

  if (!userId) {
    const disabled = async () => {
      throw new Error("Sign in to change your photo.");
    };
    return {
      avatar: { ...IDLE_SLOT, upload: disabled, remove: disabled },
      cover: { ...IDLE_SLOT, upload: disabled, remove: disabled },
    };
  }

  const setSlot = (kind: ProfileMediaKind, state: MediaSlotState) => {
    (kind === "avatar" ? setAvatar : setCover)(state);
  };

  const mergeUrl = (kind: ProfileMediaKind, url: string | null) => {
    queryClient.setQueryData<OwnProfile | null>(["profile", "mine", userId], (old) => {
      if (!old) return old;
      return { ...old, [kind === "avatar" ? "avatar_url" : "cover_url"]: url };
    });
  };

  const upload = async (
    kind: ProfileMediaKind,
    file: File,
    crop?: CropGeometry
  ): Promise<string> => {
    setSlot(kind, { isBusy: true, error: null });
    try {
      const url =
        kind === "avatar"
          ? await uploadAvatarFile(file, userId, ...(crop ? [crop] : []))
          : await uploadCoverFile(file, userId);
      try {
        await updateOwnProfile(userId, {
          [kind === "avatar" ? "avatar_url" : "cover_url"]: url,
        });
      } catch (profileErr) {
        // Storage holds the new object but the profile does not point at
        // it — surface the save failure so the UI stays truthful.
        throw new Error(profileUpdateErrorMessage(profileErr));
      }
      mergeUrl(kind, url);
      setSlot(kind, { isBusy: false, error: null });
      return url;
    } catch (err) {
      const message =
        err instanceof Error && /couldn't save your changes|don't have permission/.test(err.message)
          ? err.message
          : profileMediaErrorMessage(err);
      setSlot(kind, { isBusy: false, error: message });
      throw new Error(message);
    }
  };

  const remove = async (kind: ProfileMediaKind): Promise<void> => {
    setSlot(kind, { isBusy: true, error: null });
    try {
      // Idempotent: a missing Storage object must not leave the profile
      // stuck — the database URL is still cleared below.
      try {
        if (kind === "avatar") await removeAvatarFile(userId);
        else await removeCoverFile(userId);
      } catch (storageErr) {
        if (!isMissingObjectError(storageErr)) throw storageErr;
      }
      try {
        await updateOwnProfile(userId, {
          [kind === "avatar" ? "avatar_url" : "cover_url"]: null,
        });
      } catch (profileErr) {
        throw new Error(profileUpdateErrorMessage(profileErr));
      }
      mergeUrl(kind, null);
      setSlot(kind, { isBusy: false, error: null });
    } catch (err) {
      const message =
        err instanceof Error && /couldn't save your changes|don't have permission/.test(err.message)
          ? err.message
          : profileMediaErrorMessage(err);
      setSlot(kind, { isBusy: false, error: message });
      throw new Error(message);
    }
  };

  return {
    avatar: {
      ...avatar,
      upload: (file: File, crop?: CropGeometry) => upload("avatar", file, crop),
      remove: () => remove("avatar"),
    },
    cover: {
      ...cover,
      upload: (file: File) => upload("cover", file),
      remove: () => remove("cover"),
    },
  };
}
