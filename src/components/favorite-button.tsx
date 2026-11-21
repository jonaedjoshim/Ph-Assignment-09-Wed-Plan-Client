"use client";

import { addToast } from "@heroui/react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/lib/api";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

type FavoritesContextValue = {
  ids: string[];
  isFavorite: (serviceId: string) => boolean;
  toggle: (serviceId: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdsResponse(
  value: unknown,
): value is { success: true; ids: string[] } {
  return (
    isRecord(value) &&
    value.success === true &&
    Array.isArray(value.ids) &&
    value.ids.every((id) => typeof id === "string")
  );
}

function getApiErrorMessage(value: unknown): string | null {
  return isRecord(value) && typeof value.message === "string"
    ? value.message
    : null;
}

function getAccountRole(value: unknown): unknown {
  return isRecord(value) ? value.role : undefined;
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const role = getAccountRole(session?.user);
  const isCustomer = role === "customer";
  const [fetchedIds, setFetchedIds] = useState<string[]>([]);
  const ids = useMemo(
    () => (isCustomer && !isSessionPending ? fetchedIds : []),
    [fetchedIds, isCustomer, isSessionPending],
  );

  useEffect(() => {
    if (isSessionPending || !isCustomer) {
      return;
    }

    const controller = new AbortController();

    async function loadIds() {
      try {
        const response = await apiFetch(
          `${API_BASE_URL}/api/customer/favorites/ids`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          return;
        }

        const payload: unknown = await response.json().catch(() => null);

        if (!controller.signal.aborted && isIdsResponse(payload)) {
          setFetchedIds(payload.ids);
        }
      } catch {
        // Favorites are optional; a failed lookup must not break the page.
      }
    }

    void loadIds();

    return () => controller.abort();
  }, [isCustomer, isSessionPending]);

  const toggle = useCallback(
    async (serviceId: string) => {
      const isCurrentlyFavorite = ids.includes(serviceId);

      if (!isCustomer) {
        if (!session?.user) {
          router.replace(
            `/sign-in?callbackURL=${encodeURIComponent("/services")}`,
          );
          return;
        }

        addToast({
          title: "Sign in as a customer to save services",
          color: "warning",
        });
        return;
      }

      try {
        const response = await apiFetch(
          `${API_BASE_URL}/api/customer/favorites/${encodeURIComponent(serviceId)}`,
          { method: isCurrentlyFavorite ? "DELETE" : "POST" },
        );

        if (response.status === 401) {
          router.replace(
            `/sign-in?callbackURL=${encodeURIComponent("/services")}`,
          );
          return;
        }

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok || !isIdsResponse(payload)) {
          throw new Error(
            getApiErrorMessage(payload) ??
              `Could not update saved services (HTTP ${response.status}).`,
          );
        }

        setFetchedIds(payload.ids);
        addToast({
          title: isCurrentlyFavorite
            ? "Removed from saved services"
            : "Saved to your list",
          color: "success",
        });
      } catch (error) {
        addToast({
          title: "Could not update saved services",
          description:
            error instanceof TypeError
              ? "Could not reach WedPlan API. Check that the server is running."
              : error instanceof Error
                ? error.message
                : "Please try again.",
          color: "danger",
        });
      }
    },
    [ids, isCustomer, router, session?.user],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      ids,
      isFavorite: (serviceId: string) => ids.includes(serviceId),
      toggle,
    }),
    [ids, toggle],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function FavoriteButton({
  serviceId,
  className = "",
}: {
  serviceId: string;
  className?: string;
}) {
  const context = useContext(FavoritesContext);
  const [isSaving, setIsSaving] = useState(false);
  const isFavorite = context?.isFavorite(serviceId) ?? false;

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (isSaving || !context) {
      return;
    }

    setIsSaving(true);

    try {
      await context.toggle(serviceId);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => void handleClick(event)}
      disabled={isSaving}
      aria-label={isFavorite ? "Remove from saved services" : "Save service"}
      aria-pressed={isFavorite}
      title={isFavorite ? "Remove from saved services" : "Save service"}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/85 text-wedplan-rose shadow-sm backdrop-blur transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <Heart
        aria-hidden="true"
        className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`}
      />
    </button>
  );
}
