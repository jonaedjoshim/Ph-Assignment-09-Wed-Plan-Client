"use client";

import { Button } from "@heroui/react";
import {
  ArrowLeft,
  Check,
  MapPin,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { SiteFooter } from "@/components/footer";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/lib/api";
import {
  SERVICE_CATEGORIES,
  type ServiceCategory,
} from "@/lib/service-categories";

type AccountRole = "customer" | "vendor" | "admin";
type ServiceStatus = "pending" | "approved" | "rejected";
type StatusFilter = "all" | ServiceStatus;
type ModerationStatus = "pending" | "approved" | "rejected";
type ModerationAction = "approve" | "reject" | "reset" | "delete";

type AdminService = {
  _id: string;
  vendorId: string;
  vendorName?: string;
  serviceName: string;
  category: ServiceCategory;
  description: string;
  price: number;
  location: string;
  images?: string[];
  status: ServiceStatus;
  createdAt?: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type AdminServicesResponse = {
  success: true;
  services: AdminService[];
  pagination: Pagination;
};

type ServiceRequestState = {
  key: string;
  services: AdminService[] | null;
  pagination: Pagination | null;
  error: string | null;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All statuses" },
];

const statusStyles: Record<ServiceStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900",
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAccountRole(value: unknown): AccountRole | null {
  if (!isRecord(value)) {
    return null;
  }

  const role = value.role;

  if (role === "customer" || role === "vendor" || role === "admin") {
    return role;
  }

  return null;
}

function isServiceCategory(value: unknown): value is ServiceCategory {
  return (
    typeof value === "string" &&
    (SERVICE_CATEGORIES as readonly string[]).includes(value)
  );
}

function isServiceStatus(value: unknown): value is ServiceStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function isAdminService(value: unknown): value is AdminService {
  if (!isRecord(value)) {
    return false;
  }

  const validImages =
    value.images === undefined ||
    (Array.isArray(value.images) &&
      value.images.every((image) => typeof image === "string"));

  const validCreatedAt =
    value.createdAt === undefined || typeof value.createdAt === "string";

  const validVendorName =
    value.vendorName === undefined || typeof value.vendorName === "string";

  return (
    typeof value._id === "string" &&
    typeof value.vendorId === "string" &&
    validVendorName &&
    typeof value.serviceName === "string" &&
    isServiceCategory(value.category) &&
    typeof value.description === "string" &&
    typeof value.price === "number" &&
    typeof value.location === "string" &&
    validImages &&
    isServiceStatus(value.status) &&
    validCreatedAt
  );
}

function isPagination(value: unknown): value is Pagination {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isInteger(value.page) &&
    Number(value.page) >= 1 &&
    Number.isInteger(value.limit) &&
    Number(value.limit) >= 1 &&
    Number.isInteger(value.total) &&
    Number(value.total) >= 0 &&
    Number.isInteger(value.totalPages) &&
    Number(value.totalPages) >= 0
  );
}

function isAdminServicesResponse(
  value: unknown,
): value is AdminServicesResponse {
  return (
    isRecord(value) &&
    value.success === true &&
    Array.isArray(value.services) &&
    value.services.every(isAdminService) &&
    isPagination(value.pagination)
  );
}

function getApiErrorMessage(value: unknown): string | null {
  if (isRecord(value) && typeof value.message === "string") {
    return value.message;
  }

  return null;
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

function AdminServicesSkeleton() {
  return (
    <section
      aria-busy="true"
      className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14"
    >
      <p role="status" className="sr-only">
        Loading services for review
      </p>

      <div className="h-9 w-72 animate-pulse rounded bg-[#eaded8]" />
      <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-[#f0e8e4]" />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="h-12 animate-pulse rounded-xl bg-[#eaded8]" />
        <div className="h-12 animate-pulse rounded-xl bg-[#eaded8]" />
        <div className="h-12 animate-pulse rounded-xl bg-[#eaded8]" />
      </div>

      <div className="mt-8 grid gap-5">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-[#eaded8] bg-white p-5 sm:p-6"
          >
            <div className="grid gap-5 md:grid-cols-[220px_1fr]">
              <div className="aspect-[4/3] animate-pulse rounded-xl bg-[#eaded8]" />
              <div className="space-y-4">
                <div className="h-6 w-2/3 animate-pulse rounded bg-[#eaded8]" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-[#f0e8e4]" />
                <div className="h-4 w-full animate-pulse rounded bg-[#f0e8e4]" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-[#f0e8e4]" />
                <div className="mt-6 h-10 w-56 animate-pulse rounded-full bg-[#eaded8]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminServicesContent() {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();

  const userId = session?.user?.id;
  const accountRole = getAccountRole(session?.user);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | "all">(
    "all",
  );
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [requestState, setRequestState] = useState<ServiceRequestState>({
    key: "",
    services: null,
    pagination: null,
    error: null,
  });
  const [actionState, setActionState] = useState<{
    serviceId: string;
    action: ModerationAction;
  } | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState("");

  const queryParams = new URLSearchParams({
    status: statusFilter,
    page: String(page),
    limit: "12",
  });

  if (categoryFilter !== "all") {
    queryParams.set("category", categoryFilter);
  }

  if (searchTerm) {
    queryParams.set("search", searchTerm);
  }

  const queryString = queryParams.toString();
  const requestUrl = `${API_BASE_URL}/api/admin/services?${queryString}`;
  const requestKey = `${queryString}:${refreshKey}`;

  useEffect(() => {
    if (isSessionPending) {
      return;
    }

    if (!userId) {
      router.replace(
        `/sign-in?callbackURL=${encodeURIComponent("/admin/services")}`,
      );
      return;
    }

    if (accountRole !== "admin") {
      return;
    }

    const controller = new AbortController();

    async function loadServices() {
      try {
        const response = await apiFetch(requestUrl, {
          credentials: "include",
          signal: controller.signal,
        });

        const payload: unknown = await response.json().catch(() => null);

        if (response.status === 401) {
          router.replace(
            `/sign-in?callbackURL=${encodeURIComponent("/admin/services")}`,
          );
          return;
        }

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(payload) ??
              `Could not load services (HTTP ${response.status}).`,
          );
        }

        if (!isAdminServicesResponse(payload)) {
          throw new Error(
            "The admin services API returned an unexpected response.",
          );
        }

        if (controller.signal.aborted) {
          return;
        }

        setRequestState({
          key: requestKey,
          services: payload.services,
          pagination: payload.pagination,
          error: null,
        });
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setRequestState({
          key: requestKey,
          services: null,
          pagination: null,
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
  }, [accountRole, isSessionPending, requestKey, requestUrl, router, userId]);

  const hasCurrentResult = requestState.key === requestKey;
  const isLoading =
    isSessionPending ||
    !userId ||
    (accountRole === "admin" && !hasCurrentResult);

  const services = hasCurrentResult ? (requestState.services ?? []) : [];
  const pagination = hasCurrentResult ? requestState.pagination : null;
  const error = hasCurrentResult ? requestState.error : null;

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearchTerm(searchInput.trim());
  }

  async function handleModeration(serviceId: string, status: ModerationStatus) {
    const action: ModerationAction =
      status === "approved" ? "approve" : status === "rejected" ? "reject" : "reset";

    setActionState({ serviceId, action });
    setActionError(null);
    setPageNotice("");

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/admin/services/${encodeURIComponent(serviceId)}/status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );

      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 401) {
        router.replace(
          `/sign-in?callbackURL=${encodeURIComponent("/admin/services")}`,
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload) ??
            `Could not update service status (HTTP ${response.status}).`,
        );
      }

      if (!isRecord(payload) || payload.success !== true) {
        throw new Error(
          "The admin services API returned an unexpected response.",
        );
      }

      setDeleteTargetId(null);
      setPage(1);
      setPageNotice(
        status === "approved"
          ? "Service approved."
          : status === "rejected"
            ? "Service rejected."
            : "Service reset to pending.",
      );
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setActionError(
        requestError instanceof TypeError
          ? "Could not reach WedPlan API. Check that the server is running and NEXT_PUBLIC_API_URL is correct."
          : requestError instanceof Error
            ? requestError.message
            : "Could not update service status.",
      );
    } finally {
      setActionState(null);
    }
  }

  async function handleDelete(serviceId: string) {
    setActionState({ serviceId, action: "delete" });
    setActionError(null);
    setPageNotice("");

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/admin/services/${encodeURIComponent(serviceId)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 401) {
        router.replace(
          `/sign-in?callbackURL=${encodeURIComponent("/admin/services")}`,
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload) ??
            `Could not delete service (HTTP ${response.status}).`,
        );
      }

      if (!isRecord(payload) || payload.success !== true) {
        throw new Error(
          "The admin services API returned an unexpected response.",
        );
      }

      setDeleteTargetId(null);
      setPage(1);
      setPageNotice("Service deleted.");
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setActionError(
        requestError instanceof TypeError
          ? "Could not reach WedPlan API. Check that the server is running and NEXT_PUBLIC_API_URL is correct."
          : requestError instanceof Error
            ? requestError.message
            : "Could not delete service.",
      );
    } finally {
      setActionState(null);
    }
  }

  if (isLoading) {
    return <AdminServicesSkeleton />;
  }

  if (!userId || accountRole !== "admin") {
    return (
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
        <h1 className="text-2xl font-semibold">Admin access required</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Only admin accounts can review services.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-10 items-center rounded-full bg-wedplan-rose px-5 text-sm font-semibold text-white"
        >
          Back to home
        </Link>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
        <Search
          aria-hidden="true"
          className="mx-auto h-8 w-8 text-wedplan-rose"
        />
        <h1 className="mt-4 text-2xl font-semibold">Services unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{error}</p>
        <Button
          type="button"
          radius="full"
          onPress={() => setRefreshKey((current) => current + 1)}
          className="mt-6 bg-wedplan-rose font-semibold text-white"
        >
          Try again
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-wedplan-rose"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to home
      </Link>

      <div className="mt-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wedplan-rose">
          Admin workspace
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Review services
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
          Review vendor listings and approve, reject, or remove services.
        </p>
      </div>

      <form
        onSubmit={handleSearchSubmit}
        className="mt-8 grid gap-4 rounded-2xl border border-[#eaded8] bg-white p-5 md:grid-cols-3"
      >
        <div>
          <label
            htmlFor="serviceStatusFilter"
            className="block text-sm font-semibold"
          >
            Status
          </label>
          <select
            id="serviceStatusFilter"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPage(1);
            }}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#e3d4cd] bg-white px-4 text-sm outline-none transition focus:border-wedplan-rose focus:ring-2 focus:ring-wedplan-rose/20"
          >
            {statusFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="serviceCategoryFilter"
            className="block text-sm font-semibold"
          >
            Category
          </label>
          <select
            id="serviceCategoryFilter"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(
                event.target.value === "all"
                  ? "all"
                  : (event.target.value as ServiceCategory),
              );
              setPage(1);
            }}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#e3d4cd] bg-white px-4 text-sm outline-none transition focus:border-wedplan-rose focus:ring-2 focus:ring-wedplan-rose/20"
          >
            <option value="all">All categories</option>
            {SERVICE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="serviceSearch"
            className="block text-sm font-semibold"
          >
            Search
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="serviceSearch"
              type="search"
              maxLength={100}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Name, description, or location"
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#e3d4cd] bg-white px-4 text-sm outline-none transition placeholder:text-stone-400 focus:border-wedplan-rose focus:ring-2 focus:ring-wedplan-rose/20"
            />
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-wedplan-rose px-4 text-sm font-semibold text-white transition hover:brightness-95"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
              Search
            </button>
          </div>
        </div>
      </form>

      {pageNotice && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {pageNotice}
        </p>
      )}

      {actionError && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800"
        >
          {actionError}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">
          {pagination
            ? `${pagination.total} service${pagination.total === 1 ? "" : "s"} found`
            : "Services"}
        </p>

        {(searchTerm || categoryFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearchTerm("");
              setCategoryFilter("all");
              setPage(1);
            }}
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#e3d4cd] px-4 text-sm font-semibold text-stone-700 transition hover:bg-[#f5eae5]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Clear search and category
          </button>
        )}
      </div>

      {services.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#d9c9c2] bg-white/70 px-6 py-12 text-center">
          <Search
            aria-hidden="true"
            className="mx-auto h-8 w-8 text-wedplan-rose"
          />
          <h2 className="mt-4 text-lg font-semibold">No services found</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Try another status, category, or search term.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5">
          {services.map((service) => {
            const isWorking = actionState?.serviceId === service._id;

            return (
              <article
                key={service._id}
                className="rounded-2xl border border-[#eaded8] bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#f0e8e4]">
                    {service.images?.[0] && (
                      <Image
                        src={service.images[0]}
                        alt={service.serviceName}
                        fill
                        sizes="(max-width: 768px) 100vw, 220px"
                        unoptimized
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                        className="object-cover"
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-wedplan-rose">
                          {service.category}
                        </p>
                        <h2 className="mt-2 text-xl font-semibold">
                          {service.serviceName}
                        </h2>
                      </div>

                      <span
                        className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[service.status]}`}
                      >
                        {service.status.charAt(0).toUpperCase() +
                          service.status.slice(1)}
                      </span>
                    </div>

                    <p className="mt-4 whitespace-pre-line text-sm leading-6 text-stone-600">
                      {service.description}
                    </p>

                    <div className="mt-5 grid gap-3 text-sm text-stone-600 sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <MapPin
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-wedplan-rose"
                        />
                        <span>{service.location}</span>
                      </div>

                      <p>
                        Price:{" "}
                        <span className="font-semibold text-wedplan-ink">
                          {priceFormatter.format(service.price)}
                        </span>
                      </p>

                      <p className="break-all">
                        Vendor:{" "}
                        <span className="font-medium text-wedplan-ink">
                          {service.vendorName ?? service.vendorId}
                        </span>
                      </p>

                      <p>
                        Submitted:{" "}
                        <span className="font-medium text-wedplan-ink">
                          {formatDate(service.createdAt)}
                        </span>
                      </p>
                    </div>

                    {deleteTargetId === service._id ? (
                      <div className="mt-6 rounded-xl bg-rose-50 p-4">
                        <p className="text-sm font-semibold text-rose-900">
                          Delete this service?
                        </p>
                        <p className="mt-1 text-sm leading-6 text-rose-800">
                          This action cannot be undone.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={actionState !== null}
                            onClick={() => void handleDelete(service._id)}
                            className="inline-flex min-h-10 items-center justify-center rounded-full bg-rose-700 px-5 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isWorking && actionState?.action === "delete"
                              ? "Deleting..."
                              : "Confirm delete"}
                          </button>
                          <button
                            type="button"
                            disabled={actionState !== null}
                            onClick={() => setDeleteTargetId(null)}
                            className="inline-flex min-h-10 items-center justify-center rounded-full border border-rose-200 px-5 text-sm font-semibold text-rose-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Keep service
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 flex flex-wrap gap-3 border-t border-[#eaded8] pt-5">
                        {service.status !== "approved" && (
                          <button
                            type="button"
                            disabled={actionState !== null}
                            onClick={() =>
                              void handleModeration(service._id, "approved")
                            }
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Check aria-hidden="true" className="h-4 w-4" />
                            {isWorking && actionState?.action === "approve"
                              ? "Approving..."
                              : "Approve"}
                          </button>
                        )}

                        {service.status !== "rejected" && (
                          <button
                            type="button"
                            disabled={actionState !== null}
                            onClick={() =>
                              void handleModeration(service._id, "rejected")
                            }
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-rose-200 px-5 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <X aria-hidden="true" className="h-4 w-4" />
                            {isWorking && actionState?.action === "reject"
                              ? "Rejecting..."
                              : "Reject"}
                          </button>
                        )}

                        {service.status !== "pending" && (
                          <button
                            type="button"
                            disabled={actionState !== null}
                            onClick={() =>
                              void handleModeration(service._id, "pending")
                            }
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-amber-200 px-5 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <RotateCcw
                              aria-hidden="true"
                              className="h-4 w-4"
                            />
                            {isWorking && actionState?.action === "reset"
                              ? "Resetting..."
                              : "Reset to pending"}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={actionState !== null}
                          onClick={() => setDeleteTargetId(service._id)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#e3d4cd] px-5 text-sm font-semibold text-stone-700 transition hover:bg-[#f5eae5] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <nav
          aria-label="Service result pages"
          className="mt-8 flex items-center justify-center gap-4"
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="min-h-10 rounded-full border border-[#e3d4cd] px-5 text-sm font-semibold text-stone-700 transition hover:bg-[#f5eae5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <span className="text-sm text-stone-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() =>
              setPage((current) => Math.min(pagination.totalPages, current + 1))
            }
            className="min-h-10 rounded-full border border-[#e3d4cd] px-5 text-sm font-semibold text-stone-700 transition hover:bg-[#f5eae5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}

export default function AdminServicesPage() {
  return (
    <div className="flex flex-1 flex-col bg-wedplan-cream text-wedplan-ink">
      <main className="flex-1">
        <Suspense fallback={<AdminServicesSkeleton />}>
          <AdminServicesContent />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
