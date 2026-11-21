"use client";

import Image from "next/image";
import {
  addToast,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SiteFooter } from "@/components/footer";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/lib/api";

type AccountRole = "customer" | "vendor" | "admin";
type BookingStatus = "pending" | "accepted" | "rejected" | "cancelled";
type BookingStatusFilter = "all" | BookingStatus;
type BookingDecision = "accepted" | "rejected";

type BookingCustomer = {
  id: string;
  name: string;
  email: string;
};

type VendorBooking = {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  serviceImage: string | null;
  customer: BookingCustomer | null;
  eventDate: string | null;
  message: string;
  status: BookingStatus;
  createdAt: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type BookingsResponse = {
  success: true;
  bookings: VendorBooking[];
  pagination: Pagination;
};

type BookingRequestState = {
  key: string;
  bookings: VendorBooking[] | null;
  pagination: Pagination | null;
  error: string | null;
};

type BookingActionState = {
  id: string;
  decision: BookingDecision;
} | null;

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const bookingStatusFilters: {
  value: BookingStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "All requests" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const bookingStatusStyles: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  accepted: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900",
  cancelled: "bg-stone-200 text-stone-700",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAccountRole(value: unknown): AccountRole | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.role === "customer" ||
    value.role === "vendor" ||
    value.role === "admin"
  ) {
    return value.role;
  }

  return null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isBookingStatus(value: unknown): value is BookingStatus {
  return (
    value === "pending" ||
    value === "accepted" ||
    value === "rejected" ||
    value === "cancelled"
  );
}

function isBookingCustomer(value: unknown): value is BookingCustomer {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.email === "string"
  );
}

function isVendorBooking(value: unknown): value is VendorBooking {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.serviceId === "string" &&
    typeof value.serviceName === "string" &&
    typeof value.serviceCategory === "string" &&
    isNullableString(value.serviceImage) &&
    (value.customer === null || isBookingCustomer(value.customer)) &&
    isNullableString(value.eventDate) &&
    typeof value.message === "string" &&
    isBookingStatus(value.status) &&
    isNullableString(value.createdAt)
  );
}

function isPagination(value: unknown): value is Pagination {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.page === "number" &&
    Number.isInteger(value.page) &&
    typeof value.limit === "number" &&
    Number.isInteger(value.limit) &&
    typeof value.total === "number" &&
    Number.isInteger(value.total) &&
    typeof value.totalPages === "number" &&
    Number.isInteger(value.totalPages)
  );
}

function isBookingsResponse(value: unknown): value is BookingsResponse {
  return (
    isRecord(value) &&
    value.success === true &&
    Array.isArray(value.bookings) &&
    value.bookings.every(isVendorBooking) &&
    isPagination(value.pagination)
  );
}

function getApiErrorMessage(value: unknown): string | null {
  if (isRecord(value) && typeof value.message === "string") {
    return value.message;
  }

  return null;
}

function getSafeImageUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function VendorBookingsSkeleton() {
  return (
    <section
      aria-busy="true"
      className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14"
    >
      <p role="status" className="sr-only">
        Loading booking requests
      </p>

      <div className="h-9 w-72 animate-pulse rounded bg-[#eaded8]" />
      <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-[#f0e8e4]" />
      <div className="mt-8 h-12 w-full max-w-sm animate-pulse rounded-xl bg-[#eaded8]" />

      <div className="mt-8 grid gap-5">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-[#eaded8] bg-white p-5 sm:p-6"
          >
            <div className="h-6 w-2/3 animate-pulse rounded bg-[#eaded8]" />
            <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-[#f0e8e4]" />
            <div className="mt-6 h-20 w-full animate-pulse rounded bg-[#f0e8e4]" />
          </div>
        ))}
      </div>
    </section>
  );
}

function VendorBookingsContent() {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();

  const userId = session?.user?.id;
  const accountRole = getAccountRole(session?.user);

  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  const [requestState, setRequestState] = useState<BookingRequestState>({
    key: "",
    bookings: null,
    pagination: null,
    error: null,
  });

  const [actionState, setActionState] = useState<BookingActionState>(null);
  const [rejectTarget, setRejectTarget] = useState<VendorBooking | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState("");

  const queryParams = new URLSearchParams({
    status: statusFilter,
    page: String(page),
    limit: "20",
  });

  const queryString = queryParams.toString();
  const requestUrl = `${API_BASE_URL}/api/vendor/bookings?${queryString}`;

  const requestKey = `${userId ?? "anonymous"}:${accountRole ?? "unknown"}:${queryString}:${retryKey}`;

  useEffect(() => {
    if (isSessionPending) {
      return;
    }

    if (!userId) {
      router.replace(
        `/sign-in?callbackURL=${encodeURIComponent("/vendor/bookings")}`,
      );
      return;
    }

    if (accountRole !== "vendor") {
      return;
    }

    const controller = new AbortController();

    async function loadBookings() {
      try {
        const response = await apiFetch(requestUrl, {
          credentials: "include",
          signal: controller.signal,
        });

        const payload: unknown = await response.json().catch(() => null);

        if (response.status === 401) {
          router.replace(
            `/sign-in?callbackURL=${encodeURIComponent("/vendor/bookings")}`,
          );
          return;
        }

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(payload) ??
              `Could not load bookings (HTTP ${response.status}).`,
          );
        }

        if (!isBookingsResponse(payload)) {
          throw new Error("The bookings API returned an unexpected response.");
        }

        if (controller.signal.aborted) {
          return;
        }

        setRequestState({
          key: requestKey,
          bookings: payload.bookings,
          pagination: payload.pagination,
          error: null,
        });
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setRequestState({
          key: requestKey,
          bookings: null,
          pagination: null,
          error:
            requestError instanceof TypeError
              ? "Could not reach WedPlan API. Check that the server is running and NEXT_PUBLIC_API_URL is correct."
              : requestError instanceof Error
                ? requestError.message
                : "Could not load booking requests.",
        });
      }
    }

    void loadBookings();

    return () => controller.abort();
  }, [accountRole, isSessionPending, requestKey, requestUrl, router, userId]);

  const hasCurrentResult = requestState.key === requestKey;

  const isLoading =
    isSessionPending ||
    !userId ||
    (accountRole === "vendor" && !hasCurrentResult);

  const bookings = hasCurrentResult ? (requestState.bookings ?? []) : [];
  const pagination = hasCurrentResult ? requestState.pagination : null;
  const error = hasCurrentResult ? requestState.error : null;

  async function handleDecision(
    booking: VendorBooking,
    decision: BookingDecision,
  ) {
    setActionState({ id: booking.id, decision });
    setActionError(null);
    setActionNotice("");

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/vendor/bookings/${encodeURIComponent(booking.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: decision }),
        },
      );

      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 401) {
        router.replace(
          `/sign-in?callbackURL=${encodeURIComponent("/vendor/bookings")}`,
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload) ??
            `Could not update booking (HTTP ${response.status}).`,
        );
      }

      if (!isRecord(payload) || payload.success !== true) {
        throw new Error("The bookings API returned an unexpected response.");
      }

      const notice =
        decision === "accepted"
          ? "Booking request accepted."
          : "Booking request rejected.";

      setActionNotice(notice);
      addToast({
        title: decision === "accepted" ? "Request accepted" : "Request rejected",
        description: notice,
        color: "success",
      });

      setRetryKey((current) => current + 1);
    } catch (requestError) {
      const errorMessage =
        requestError instanceof TypeError
          ? "Could not reach WedPlan API. Check that the server is running."
          : requestError instanceof Error
            ? requestError.message
            : "Could not update the booking.";

      setActionError(errorMessage);
      addToast({
        title: "Request not updated",
        description: errorMessage,
        color: "danger",
      });
    } finally {
      setActionState(null);
    }
  }

  async function handleConfirmReject() {
    const booking = rejectTarget;

    if (!booking) {
      return;
    }

    setRejectTarget(null);
    await handleDecision(booking, "rejected");
  }

  if (isLoading) {
    return <VendorBookingsSkeleton />;
  }

  if (!userId || accountRole !== "vendor") {
    return (
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
        <ShieldCheck
          aria-hidden="true"
          className="mx-auto h-9 w-9 text-wedplan-rose"
        />

        <h1 className="mt-4 text-2xl font-semibold">Vendor access required</h1>

        <p className="mt-3 text-sm leading-6 text-stone-600">
          Booking requests are available to vendor accounts.
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
          className="mx-auto h-9 w-9 text-wedplan-rose"
        />

        <h1 className="mt-4 text-2xl font-semibold">
          Booking requests unavailable
        </h1>

        <p className="mt-3 text-sm leading-6 text-stone-600">{error}</p>

        <button
          type="button"
          onClick={() => setRetryKey((current) => current + 1)}
          className="mt-6 inline-flex min-h-10 items-center rounded-full bg-wedplan-rose px-5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href="/vendor/services"
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-wedplan-rose"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to services
      </Link>

      <div className="mt-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wedplan-rose">
          Vendor workspace
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Booking requests
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
          Review customer requests for your services. Only pending requests can
          be accepted or rejected.
        </p>
      </div>

      <div className="mt-8 grid gap-4 rounded-2xl border border-[#eaded8] bg-white p-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="bookingStatus"
            className="block text-sm font-semibold"
          >
            Request status
          </label>

          <select
            id="bookingStatus"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as BookingStatusFilter);
              setPage(1);
            }}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#e3d4cd] bg-white px-4 text-sm outline-none transition focus:border-wedplan-rose focus:ring-2 focus:ring-wedplan-rose/20"
          >
            {bookingStatusFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <p className="text-sm text-stone-600">
            {pagination
              ? `${pagination.total} request${pagination.total === 1 ? "" : "s"}`
              : "Booking requests"}
          </p>
        </div>
      </div>

      {actionNotice && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {actionNotice}
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

      {bookings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#d9c9c2] bg-white/70 px-6 py-12 text-center">
          <CalendarDays
            aria-hidden="true"
            className="mx-auto h-8 w-8 text-wedplan-rose"
          />

          <h2 className="mt-4 text-lg font-semibold">
            No booking requests found
          </h2>

          <p className="mt-2 text-sm leading-6 text-stone-600">
            New customer requests for your services will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5">
          {bookings.map((booking) => {
            const imageUrl = getSafeImageUrl(booking.serviceImage);
            const actionIsRunning = actionState?.id === booking.id;

            return (
              <article
                key={booking.id}
                className="rounded-2xl border border-[#eaded8] bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-col gap-5 sm:flex-row">
                  {imageUrl ? (
                    <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-[#f5eae5] sm:w-48">
                      <Image
                        src={imageUrl}
                        alt={booking.serviceName}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, 192px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[4/3] w-full shrink-0 items-center justify-center rounded-xl bg-[#f5eae5] text-wedplan-rose sm:w-48">
                      <CalendarDays aria-hidden="true" className="h-8 w-8" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${bookingStatusStyles[booking.status]}`}
                      >
                        {booking.status.charAt(0).toUpperCase() +
                          booking.status.slice(1)}
                      </span>

                      {booking.serviceCategory && (
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-wedplan-rose">
                          {booking.serviceCategory}
                        </span>
                      )}
                    </div>

                    <h2 className="mt-3 break-words text-xl font-semibold">
                      {booking.serviceName}
                    </h2>

                    <div className="mt-4 grid gap-3 text-sm text-stone-600 sm:grid-cols-2">
                      <p className="flex items-start gap-2">
                        <CalendarDays
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 shrink-0 text-wedplan-rose"
                        />

                        <span>
                          Event date:{" "}
                          <span className="font-medium text-wedplan-ink">
                            {formatDate(booking.eventDate)}
                          </span>
                        </span>
                      </p>

                      <p className="flex items-start gap-2">
                        <Clock
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 shrink-0 text-wedplan-rose"
                        />

                        <span>
                          Request received:{" "}
                          <span className="font-medium text-wedplan-ink">
                            {formatDate(booking.createdAt)}
                          </span>
                        </span>
                      </p>

                      <p className="flex items-start gap-2">
                        <Mail
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 shrink-0 text-wedplan-rose"
                        />

                        <span className="min-w-0 break-all">
                          Customer:{" "}
                          <span className="font-medium text-wedplan-ink">
                            {booking.customer?.name || "Customer"}
                          </span>
                          {booking.customer?.email && (
                            <>
                              <br />
                              {booking.customer.email}
                            </>
                          )}
                        </span>
                      </p>
                    </div>

                    {booking.message && (
                      <div className="mt-4 rounded-xl bg-[#faf6f3] p-4">
                        <p className="flex items-center gap-2 text-sm font-semibold text-wedplan-ink">
                          <MessageSquare
                            aria-hidden="true"
                            className="h-4 w-4 text-wedplan-rose"
                          />
                          Customer message
                        </p>

                        <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-stone-600">
                          {booking.message}
                        </p>
                      </div>
                    )}

                    {booking.status === "pending" && (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            void handleDecision(booking, "accepted")
                          }
                          disabled={actionState !== null}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Check aria-hidden="true" className="h-4 w-4" />

                          {actionIsRunning &&
                          actionState?.decision === "accepted"
                            ? "Accepting..."
                            : "Accept request"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setRejectTarget(booking)}
                          disabled={actionState !== null}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-rose-200 px-5 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <X aria-hidden="true" className="h-4 w-4" />
                          Reject request
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
          aria-label="Booking request pages"
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

      <Modal
        isOpen={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
          }
        }}
        placement="center"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Reject booking request
              </ModalHeader>
              <ModalBody>
                <p className="text-sm leading-6 text-stone-600">
                  Reject the request for{" "}
                  <span className="font-semibold text-wedplan-ink">
                    {rejectTarget?.serviceName}
                  </span>
                  ? The customer will be notified.
                </p>
              </ModalBody>
              <ModalFooter>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#e3d4cd] px-5 text-sm font-semibold text-stone-700 transition hover:bg-[#f5eae5]"
                >
                  Keep request
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmReject()}
                  disabled={actionState !== null}
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-rose-700 px-5 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionState?.decision === "rejected"
                    ? "Rejecting..."
                    : "Reject request"}
                </button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </section>
  );
}

export default function VendorBookingsPage() {
  return (
    <div className="flex flex-1 flex-col bg-wedplan-cream text-wedplan-ink">
      <main className="flex-1">
        <Suspense fallback={<VendorBookingsSkeleton />}>
          <VendorBookingsContent />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
