"use client";

import { Button } from "@heroui/react";
import { motion } from "framer-motion";
import {
  Camera,
  Flower2,
  MapPin,
  Search,
  Shirt,
  Sparkles,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { FavoriteButton, FavoritesProvider } from "@/components/favorite-button";
import { SiteFooter } from "@/components/footer";
import { PremiumBadge } from "@/components/premium-badge";
import { SiteHeader } from "@/components/site-header";
import {
  SERVICE_CATEGORIES,
  type ServiceCategory,
} from "@/lib/service-categories";
import { apiFetch } from "@/lib/api";

type CategoryFilter = "All categories" | ServiceCategory;
type SortOrder = "recommended" | "price-ascending" | "price-descending";

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

type ServicePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ServiceListResult = {
  services: ApiService[];
  pagination: ServicePagination;
};

type ServiceRequestState = {
  key: string;
  services: ApiService[];
  pagination: ServicePagination;
  error: string | null;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const PAGE_SIZE = 12;

const sortValues: Record<SortOrder, string> = {
  recommended: "newest",
  "price-ascending": "price-asc",
  "price-descending": "price-desc",
};

const categoryFilters: CategoryFilter[] = [
  "All categories",
  ...SERVICE_CATEGORIES,
];

const categoryIcons: Record<ServiceCategory, LucideIcon> = {
  "Photography & Videography": Camera,
  "Wedding Venues": MapPin,
  "Decoration & Florist": Flower2,
  "Catering Services": Utensils,
  "Makeup & Styling": Sparkles,
  "Wedding Fashion": Shirt,
};

const categoryArtwork: Record<ServiceCategory, string> = {
  "Photography & Videography":
    "bg-gradient-to-br from-rose-200 via-amber-100 to-orange-200",
  "Wedding Venues":
    "bg-gradient-to-br from-emerald-100 via-stone-100 to-amber-200",
  "Decoration & Florist":
    "bg-gradient-to-br from-pink-200 via-rose-100 to-lime-100",
  "Catering Services":
    "bg-gradient-to-br from-orange-200 via-amber-100 to-yellow-200",
  "Makeup & Styling":
    "bg-gradient-to-br from-fuchsia-200 via-pink-100 to-orange-100",
  "Wedding Fashion":
    "bg-gradient-to-br from-violet-200 via-rose-100 to-amber-100",
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isServiceCategory(value: unknown): value is ServiceCategory {
  return (
    typeof value === "string" &&
    (SERVICE_CATEGORIES as readonly string[]).includes(value)
  );
}

function getApiErrorMessage(value: unknown): string | null {
  if (isRecord(value) && typeof value.message === "string") {
    return value.message;
  }

  return null;
}

function parseVendor(value: unknown): ApiVendor | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    name: typeof value.name === "string" ? value.name : "",
    businessName:
      typeof value.businessName === "string" ? value.businessName : "",
    isPremium: value.isPremium === true,
  };
}

function getVendorLabel(vendor: ApiVendor | null): string | null {
  const label = vendor?.businessName.trim() || vendor?.name.trim();

  return label ? label : null;
}

function parseApiService(value: unknown): ApiService | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = value._id;
  const serviceName = value.serviceName;
  const category = value.category;
  const description = value.description;
  const price = value.price;
  const location = value.location;
  const images = Array.isArray(value.images)
    ? value.images.filter((image): image is string => typeof image === "string")
    : [];

  if (
    typeof id !== "string" ||
    typeof serviceName !== "string" ||
    !isServiceCategory(category) ||
    typeof description !== "string" ||
    typeof price !== "number" ||
    typeof location !== "string"
  ) {
    return null;
  }

  return {
    _id: id,
    serviceName,
    category,
    description,
    price,
    location,
    images,
    vendor: parseVendor(value.vendor),
  };
}

function parseServiceListResponse(value: unknown): ServiceListResult | null {
  if (
    !isRecord(value) ||
    value.success !== true ||
    !Array.isArray(value.services) ||
    !isRecord(value.pagination)
  ) {
    return null;
  }

  const { page, limit, total, totalPages } = value.pagination;

  if (
    typeof page !== "number" ||
    typeof limit !== "number" ||
    typeof total !== "number" ||
    typeof totalPages !== "number"
  ) {
    return null;
  }

  const services: ApiService[] = [];

  for (const item of value.services) {
    const service = parseApiService(item);

    if (!service) {
      return null;
    }

    services.push(service);
  }

  return {
    services,
    pagination: { page, limit, total, totalPages },
  };
}

function ServiceCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border border-[#eee3de] bg-white"
    >
      <div className="h-44 animate-pulse bg-[#eaded8]" />

      <div className="space-y-4 p-5">
        <div className="h-5 w-3/4 animate-pulse rounded bg-[#eaded8]" />
        <div className="h-4 w-full animate-pulse rounded bg-[#f0e8e4]" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-[#f0e8e4]" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-[#f0e8e4]" />
        <div className="border-t border-[#f0e8e4] pt-4">
          <div className="ml-auto h-6 w-24 animate-pulse rounded bg-[#eaded8]" />
        </div>
      </div>
    </article>
  );
}

function ServiceCardSkeletons() {
  return (
    <motion.div
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {[0, 1, 2].map((item) => (
        <ServiceCardSkeleton key={item} />
      ))}
    </motion.div>
  );
}

export default function ServicesPage() {
  return (
    <FavoritesProvider>
      <div className="flex min-h-screen flex-col bg-wedplan-cream text-wedplan-ink">
        <SiteHeader />

        <main className="flex-1">
          <Suspense fallback={<ServicesLoading />}>
            <ServicesPageContent />
          </Suspense>
        </main>

        <SiteFooter />
      </div>
    </FavoritesProvider>
  );
}

function ServicesPageContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");

  const initialCategory: CategoryFilter = isServiceCategory(category)
    ? category
    : "All categories";

  return (
    <ServicesBrowser key={initialCategory} initialCategory={initialCategory} />
  );
}

function ServicesLoading() {
  return (
    <section
      aria-busy="true"
      className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16"
    >
      <p role="status" className="sr-only">
        Loading services
      </p>

      <div className="h-10 w-3/4 animate-pulse rounded bg-[#eaded8] sm:w-1/2" />
      <div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded bg-[#f0e8e4]" />

      <div className="mt-10">
        <ServiceCardSkeletons />
      </div>
    </section>
  );
}

function ServicesBrowser({
  initialCategory,
}: {
  initialCategory: CategoryFilter;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [location, setLocation] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<CategoryFilter>(initialCategory);
  const [sortOrder, setSortOrder] = useState<SortOrder>("recommended");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [requestResult, setRequestResult] = useState<ServiceRequestState>({
    key: "",
    services: [],
    pagination: {
      page: 1,
      limit: PAGE_SIZE,
      total: 0,
      totalPages: 0,
    },
    error: null,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedLocation(location.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [location]);

  const request = useMemo(() => {
    const params = new URLSearchParams();

    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    params.set("sort", sortValues[sortOrder]);

    if (activeCategory !== "All categories") {
      params.set("category", activeCategory);
    }

    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }

    if (debouncedLocation) {
      params.set("location", debouncedLocation);
    }

    const query = params.toString();

    return {
      key: `${reloadKey}:${query}`,
      url: `${API_BASE_URL}/api/services?${query}`,
      page,
    };
  }, [
    activeCategory,
    debouncedLocation,
    debouncedSearch,
    page,
    reloadKey,
    sortOrder,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadServices() {
      try {
        const response = await apiFetch(request.url, {
          signal: controller.signal,
        });

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(payload) ??
              `Could not load services (HTTP ${response.status}).`,
          );
        }

        const result = parseServiceListResponse(payload);

        if (!result) {
          throw new Error("The services API returned an unexpected response.");
        }

        if (controller.signal.aborted) {
          return;
        }

        setRequestResult({
          key: request.key,
          services: result.services,
          pagination: result.pagination,
          error: null,
        });
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setRequestResult({
          key: request.key,
          services: [],
          pagination: {
            page: request.page,
            limit: PAGE_SIZE,
            total: 0,
            totalPages: 0,
          },
          error:
            requestError instanceof TypeError
              ? "Could not reach WedPlan API. Check that the server is running and NEXT_PUBLIC_API_URL is correct."
              : requestError instanceof Error
                ? requestError.message
                : "Could not load services.",
        });
      }
    }

    void loadServices();

    return () => controller.abort();
  }, [request]);

  const hasCurrentResult = requestResult.key === request.key;
  const isLoading = !hasCurrentResult;
  const services = hasCurrentResult ? requestResult.services : [];
  const error = hasCurrentResult ? requestResult.error : null;
  const pagination = hasCurrentResult
    ? requestResult.pagination
    : {
        page: request.page,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 0,
      };

  const hasActiveFilters =
    search.trim().length > 0 ||
    location.trim().length > 0 ||
    activeCategory !== "All categories" ||
    sortOrder !== "recommended";

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setLocation("");
    setDebouncedLocation("");
    setActiveCategory("All categories");
    setSortOrder("recommended");
    setPage(1);
  }

  return (
    <>
      <section className="border-b border-[#eaded8] bg-white/65">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="text-sm text-stone-500">
            <Link href="/" className="transition hover:text-wedplan-rose">
              Home
            </Link>
            <span aria-hidden="true" className="px-2">
              /
            </span>
            <span className="font-medium text-wedplan-ink">Find services</span>
          </div>

          <div className="mt-6 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wedplan-rose">
              Your celebration, your way
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Find wedding services that feel right.
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-stone-600">
              Search by service, description, or location, then narrow down your
              options by category, location, and price.
            </p>
          </div>

          <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-[1fr_15rem]">
            <div>
              <label htmlFor="service-search" className="sr-only">
                Search services, descriptions, or locations
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-[#e7d9d2] bg-white px-4 shadow-sm transition focus-within:border-wedplan-rose focus-within:ring-4 focus-within:ring-[#96575b]/10">
                <Search
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-stone-400"
                />
                <input
                  id="service-search"
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Try photography, venues, or florist"
                  className="min-h-14 w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="service-location" className="sr-only">
                Filter by location
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-[#e7d9d2] bg-white px-4 shadow-sm transition focus-within:border-wedplan-rose focus-within:ring-4 focus-within:ring-[#96575b]/10">
                <MapPin
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-stone-400"
                />
                <input
                  id="service-location"
                  type="text"
                  value={location}
                  onChange={(event) => {
                    setLocation(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Location"
                  className="min-h-14 w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-busy={isLoading}
        className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12"
      >
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold">Browse by category</h2>
            <p className="mt-1 text-sm text-stone-500">
              Choose a category to narrow down the listings.
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {categoryFilters.map((category) => {
              const isActive = activeCategory === category;

              return (
                <Button
                  key={category}
                  type="button"
                  size="sm"
                  radius="full"
                  variant={isActive ? "solid" : "bordered"}
                  aria-pressed={isActive}
                  onPress={() => {
                    setActiveCategory(category);
                    setPage(1);
                  }}
                  className={
                    isActive
                      ? "shrink-0 border border-wedplan-rose bg-wedplan-rose font-medium text-white"
                      : "shrink-0 border-[#e3d4cd] bg-white font-medium text-stone-700"
                  }
                >
                  {category}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-[#eaded8] bg-white/80 p-4 sm:flex sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm leading-6 text-stone-600">
            Services shown here are approved WedPlan listings.
          </p>

          <div className="mt-4 flex items-center gap-3 sm:mt-0">
            <label
              htmlFor="sort-services"
              className="shrink-0 text-sm text-stone-500"
            >
              Sort by
            </label>
            <select
              id="sort-services"
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value as SortOrder);
                setPage(1);
              }}
              className="min-h-10 rounded-xl border border-[#e7d9d2] bg-white px-3 text-sm text-wedplan-ink outline-none focus:border-wedplan-rose"
            >
              <option value="recommended">Recommended</option>
              <option value="price-ascending">Price: low to high</option>
              <option value="price-descending">Price: high to low</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-stone-600">
            {isLoading ? (
              <>
                <span className="sr-only">Loading services</span>
                <span
                  aria-hidden="true"
                  className="inline-block h-4 w-36 animate-pulse rounded bg-[#eaded8]"
                />
              </>
            ) : (
              <>
                Showing{" "}
                <span className="font-semibold text-wedplan-ink">
                  {services.length}
                </span>{" "}
                on this page of{" "}
                <span className="font-semibold text-wedplan-ink">
                  {pagination.total}
                </span>{" "}
                {pagination.total === 1 ? "service" : "services"}
              </>
            )}
          </p>

          {hasActiveFilters && (
            <Button
              type="button"
              size="sm"
              radius="full"
              variant="light"
              onPress={clearFilters}
              className="font-medium text-wedplan-rose"
            >
              Clear filters
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="mt-5">
            <p role="status" className="sr-only">
              Loading approved services
            </p>
            <ServiceCardSkeletons />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center"
          >
            <h2 className="text-lg font-semibold text-red-800">
              Services could not be loaded.
            </h2>
            <p className="mt-2 text-sm leading-6 text-red-700">{error}</p>
            <Button
              type="button"
              radius="full"
              onPress={() => setReloadKey((current) => current + 1)}
              className="mt-5 bg-wedplan-rose font-semibold text-white"
            >
              Try again
            </Button>
          </div>
        ) : services.length > 0 ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => {
              const Icon = categoryIcons[service.category];
              const imageUrl = service.images[0];
              const vendorLabel = getVendorLabel(service.vendor);

              return (
                <Link
                  key={service._id}
                  href={`/services/${service._id}`}
                  className="block rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#96575b]/30"
                >
                  <motion.article
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    aria-labelledby={`service-${service._id}`}
                    className="h-full overflow-hidden rounded-2xl border border-[#eee3de] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:shadow-[#704c3f]/5"
                  >
                    <div
                      className={`relative flex h-44 items-end overflow-hidden p-5 ${categoryArtwork[service.category]}`}
                    >
                      {imageUrl && (
                        <Image
                          src={imageUrl}
                          alt={service.serviceName}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          unoptimized
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                          className="object-cover"
                        />
                      )}

                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/10"
                      />

                      <FavoriteButton
                        serviceId={service._id}
                        className="absolute right-4 top-4 z-20"
                      />

                      <span className="relative z-10 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1.5 text-xs font-semibold text-[#4f3d38] backdrop-blur">
                        <Icon aria-hidden="true" className="h-4 w-4" />
                        {service.category}
                      </span>
                    </div>

                    <div className="p-5">
                      <h2
                        id={`service-${service._id}`}
                        className="text-lg font-semibold leading-snug"
                      >
                        {service.serviceName}
                      </h2>

                      {vendorLabel && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                          <span>by {vendorLabel}</span>
                          {service.vendor?.isPremium && <PremiumBadge />}
                        </div>
                      )}

                      <p className="mt-2 min-h-12 text-sm leading-6 text-stone-600">
                        {service.description}
                      </p>

                      <div className="mt-4 flex items-center gap-2 text-sm text-stone-500">
                        <MapPin aria-hidden="true" className="h-4 w-4" />
                        {service.location}
                      </div>

                      <div className="mt-5 flex items-end justify-between border-t border-[#f0e8e4] pt-4">
                        <span className="text-xs text-stone-500">Price</span>
                        <span className="text-lg font-semibold text-wedplan-ink">
                          {priceFormatter.format(service.price)}
                        </span>
                      </div>
                    </div>
                  </motion.article>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-[#d9c8c1] bg-white/70 px-6 py-14 text-center">
            <Search
              aria-hidden="true"
              className="mx-auto h-8 w-8 text-wedplan-rose"
            />
            <h2 className="mt-4 text-lg font-semibold">
              {hasActiveFilters
                ? "No services match your filters."
                : "No approved services are available yet."}
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              {hasActiveFilters
                ? "Try another search term or location, or clear your filters."
                : "Approved vendor listings will appear here."}
            </p>
            {hasActiveFilters && (
              <Button
                type="button"
                radius="full"
                onPress={clearFilters}
                className="mt-5 bg-wedplan-rose font-semibold text-white"
              >
                Clear filters
              </Button>
            )}
          </div>
        )}

        {!isLoading && !error && pagination.totalPages > 1 && (
          <nav
            aria-label="Service result pages"
            className="mt-8 flex items-center justify-center gap-4"
          >
            <Button
              type="button"
              variant="bordered"
              radius="full"
              isDisabled={page <= 1}
              onPress={() => setPage((current) => current - 1)}
              className="border-[#e3d4cd] bg-white"
            >
              Previous
            </Button>

            <span className="text-sm text-stone-600">
              Page {page} of {pagination.totalPages}
            </span>

            <Button
              type="button"
              variant="bordered"
              radius="full"
              isDisabled={page >= pagination.totalPages}
              onPress={() => setPage((current) => current + 1)}
              className="border-[#e3d4cd] bg-white"
            >
              Next
            </Button>
          </nav>
        )}
      </section>
    </>
  );
}
