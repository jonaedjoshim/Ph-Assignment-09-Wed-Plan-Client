"use client";

import { ArrowLeft, Heart, MapPin, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  FavoriteButton,
  FavoritesProvider,
} from "@/components/favorite-button";
import { SiteFooter } from "@/components/footer";
import { PremiumBadge } from "@/components/premium-badge";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/lib/api";
import type { ServiceCategory } from "@/lib/service-categories";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

type ApiVendor = {
  name: string;
  businessName: string;
  isPremium: boolean;
};

type ApiService = {
  _id: string;
  serviceName: string;
  category: ServiceCategory;
  description: string;
  price: number;
  location: string;
  images: string[];
  vendor: ApiVendor | null;
};

type FavoritesResponse = {
  success: true;
  services: ApiService[];
  ids: string[];
};

type FavoritesState = {
  key: string;
  services: ApiService[];
  error: string | null;
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isService(value: unknown): value is ApiService {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value._id === "string" &&
    typeof value.serviceName === "string" &&
    typeof value.category === "string" &&
    typeof value.description === "string" &&
    typeof value.price === "number" &&
    typeof value.location === "string"
  );
}

function isFavoritesResponse(value: unknown): value is FavoritesResponse {
  return (
    isRecord(value) &&
    value.success === true &&
    Array.isArray(value.services) &&
    value.services.every(isService) &&
    Array.isArray(value.ids)
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

function getVendorLabel(vendor: ApiService["vendor"]): string {
  if (!vendor) {
    return "";
  }

  return vendor.businessName || vendor.name;
}

function FavoritesSkeleton() {
  return (
    <section
      aria-busy="true"
      className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14"
    >
      <p role="status" className="sr-only">
        Loading saved services
      </p>
      <div className="h-9 w-72 animate-pulse rounded bg-[#eaded8]" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-72 animate-pulse rounded-2xl bg-white"
          />
        ))}
      </div>
    </section>
  );
}

function FavoritesContent() {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const role = getAccountRole(session?.user);
  const userId = session?.user?.id;
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<FavoritesState>({
    key: "",
    services: [],
    error: null,
  });

  const requestKey = `${userId ?? "anonymous"}:${String(role ?? "unknown")}:${retryKey}`;

  useEffect(() => {
    if (isSessionPending) {
      return;
    }

    if (!userId) {
      router.replace(
        `/sign-in?callbackURL=${encodeURIComponent("/customer/favorites")}`,
      );
      return;
    }

    if (role !== "customer") {
      return;
    }

    const controller = new AbortController();

    async function loadFavorites() {
      try {
        const response = await apiFetch(
          `${API_BASE_URL}/api/customer/favorites`,
          { signal: controller.signal },
        );

        const payload: unknown = await response.json().catch(() => null);

        if (response.status === 401) {
          router.replace(
            `/sign-in?callbackURL=${encodeURIComponent("/customer/favorites")}`,
          );
          return;
        }

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(payload) ??
              `Could not load saved services (HTTP ${response.status}).`,
          );
        }

        if (!isFavoritesResponse(payload)) {
          throw new Error("The favorites API returned an unexpected response.");
        }

        if (!controller.signal.aborted) {
          setState({
            key: requestKey,
            services: payload.services,
            error: null,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            key: requestKey,
            services: [],
            error:
              error instanceof TypeError
                ? "Could not reach WedPlan API. Check that the server is running."
                : error instanceof Error
                  ? error.message
                  : "Could not load your saved services.",
          });
        }
      }
    }

    void loadFavorites();

    return () => controller.abort();
  }, [isSessionPending, requestKey, role, router, userId]);

  const hasCurrentResult = state.key === requestKey;
  const isLoading = isSessionPending || (Boolean(userId) && !hasCurrentResult);
  const services = hasCurrentResult ? state.services : [];
  const error = hasCurrentResult ? state.error : null;

  if (isLoading) {
    return <FavoritesSkeleton />;
  }

  if (!userId || role !== "customer") {
    return (
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
        <Heart
          aria-hidden="true"
          className="mx-auto h-9 w-9 text-wedplan-rose"
        />
        <h1 className="mt-4 text-2xl font-semibold">Saved services</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Sign in as a customer to keep a list of services you love.
        </p>
        <Link
          href="/sign-in?callbackURL=%2Fcustomer%2Ffavorites"
          className="mt-6 inline-flex min-h-10 items-center rounded-full bg-wedplan-rose px-5 text-sm font-semibold text-white"
        >
          Sign in
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href="/services"
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-wedplan-rose"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to services
      </Link>

      <div className="mt-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wedplan-rose">
          Customer workspace
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Saved services
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
          Revisit the vendors you shortlisted and continue planning your event.
        </p>
      </div>

      {error ? (
        <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <p className="text-sm font-semibold text-rose-900">
            Could not load saved services
          </p>
          <p className="mt-1 text-sm text-rose-800">{error}</p>
          <button
            type="button"
            onClick={() => setRetryKey((current) => current + 1)}
            className="mt-4 inline-flex min-h-10 items-center rounded-full bg-wedplan-rose px-5 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      ) : services.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#d9c8c1] bg-white/70 px-6 py-14 text-center">
          <Heart
            aria-hidden="true"
            className="mx-auto h-8 w-8 text-wedplan-rose"
          />
          <h2 className="mt-4 text-xl font-semibold">No saved services yet</h2>
          <p className="mt-2 text-sm text-stone-600">
            Tap the heart on any service to keep it here for later.
          </p>
          <Link
            href="/services"
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-wedplan-rose px-5 text-sm font-semibold text-white"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
            Browse services
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const imageUrl = service.images?.[0];
            const vendorLabel = getVendorLabel(service.vendor);

            return (
              <article
                key={service._id}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#eee3de] bg-white shadow-sm"
              >
                <div className="relative h-40 overflow-hidden bg-[#f5eae5]">
                  {imageUrl && (
                    <Image
                      src={imageUrl}
                      alt={service.serviceName}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      unoptimized
                      className="object-cover"
                    />
                  )}
                  <FavoriteButton
                    serviceId={service._id}
                    className="absolute right-4 top-4 z-10"
                  />
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-wedplan-rose">
                    {service.category}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold leading-snug">
                    <Link
                      href={`/services/${service._id}`}
                      className="transition hover:text-wedplan-rose"
                    >
                      {service.serviceName}
                    </Link>
                  </h2>

                  {vendorLabel && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                      <span>by {vendorLabel}</span>
                      {service.vendor?.isPremium && <PremiumBadge />}
                    </div>
                  )}

                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-600">
                    {service.description}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-sm text-stone-500">
                    <MapPin aria-hidden="true" className="h-4 w-4" />
                    {service.location}
                  </div>

                  <div className="mt-auto flex items-end justify-between border-t border-[#f0e8e4] pt-4">
                    <span className="text-xs text-stone-500">Price</span>
                    <span className="text-lg font-semibold text-wedplan-ink">
                      {priceFormatter.format(service.price)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function CustomerFavoritesPage() {
  return (
    <FavoritesProvider>
      <div className="flex flex-1 flex-col bg-wedplan-cream text-wedplan-ink">
        <main className="flex-1">
          <Suspense fallback={<FavoritesSkeleton />}>
            <FavoritesContent />
          </Suspense>
        </main>

        <SiteFooter />
      </div>
    </FavoritesProvider>
  );
}
