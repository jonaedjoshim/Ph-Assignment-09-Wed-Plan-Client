"use client";

import { Button, addToast } from "@heroui/react";
import { ArrowLeft, MapPin, Search, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { FavoriteButton, FavoritesProvider } from "@/components/favorite-button";
import { SiteFooter } from "@/components/footer";
import { PremiumBadge } from "@/components/premium-badge";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import {
  SERVICE_CATEGORIES,
  type ServiceCategory,
} from "@/lib/service-categories";
import { apiFetch } from "@/lib/api";

type ApiVendor = {
  id: string;
  name: string;
  businessName?: string | null;
  isPremium?: boolean;
};

type ApiService = {
  _id: string;
  serviceName: string;
  category: ServiceCategory;
  description: string;
  price: number;
  location: string;
  images?: string[];
  vendor?: ApiVendor | null;
};

type ServiceDetailResponse = {
  success: true;
  service: ApiService;
};

type ServiceDetailState = {
  key: string;
  service: ApiService | null;
  error: string | null;
};

type BookingFeedback = {
  type: "success" | "error";
  message: string;
} | null;

type AccountRole = "customer" | "vendor" | "admin";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

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

function isApiVendor(value: unknown): value is ApiVendor {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.businessName === undefined ||
      value.businessName === null ||
      typeof value.businessName === "string") &&
    (value.isPremium === undefined || typeof value.isPremium === "boolean")
  );
}

function isApiService(value: unknown): value is ApiService {
  if (!isRecord(value)) {
    return false;
  }

  const validImages =
    value.images === undefined ||
    (Array.isArray(value.images) &&
      value.images.every((image) => typeof image === "string"));

  const validVendor =
    value.vendor === undefined ||
    value.vendor === null ||
    isApiVendor(value.vendor);

  return (
    typeof value._id === "string" &&
    typeof value.serviceName === "string" &&
    isServiceCategory(value.category) &&
    typeof value.description === "string" &&
    typeof value.price === "number" &&
    typeof value.location === "string" &&
    validImages &&
    validVendor
  );
}

function isServiceDetailResponse(
  value: unknown,
): value is ServiceDetailResponse {
  return (
    isRecord(value) && value.success === true && isApiService(value.service)
  );
}

function getApiErrorMessage(value: unknown): string | null {
  if (isRecord(value) && typeof value.message === "string") {
    return value.message;
  }

  return null;
}

function isValidServiceId(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function ServiceDetailSkeleton() {
  return (
    <section
      aria-busy="true"
      className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14"
    >
      <p role="status" className="sr-only">
        Loading service details
      </p>

      <div className="h-4 w-36 animate-pulse rounded bg-[#eaded8]" />

      <div className="mt-7 grid gap-8 lg:grid-cols-2">
        <div className="h-[320px] animate-pulse rounded-[2rem] bg-[#eaded8] sm:h-[460px]" />

        <div className="space-y-6 pt-2">
          <div className="h-7 w-40 animate-pulse rounded-full bg-[#eaded8]" />
          <div className="h-10 w-full animate-pulse rounded bg-[#eaded8]" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-[#f0e8e4]" />
          <div className="h-5 w-full animate-pulse rounded bg-[#f0e8e4]" />
          <div className="h-5 w-5/6 animate-pulse rounded bg-[#f0e8e4]" />
          <div className="h-6 w-1/2 animate-pulse rounded bg-[#eaded8]" />
          <div className="mt-8 h-24 animate-pulse rounded-2xl bg-[#f0e8e4]" />
        </div>
      </div>
    </section>
  );
}

function ServiceDetailError({
  message,
  onRetry,
  canRetry,
}: {
  message: string;
  onRetry?: () => void;
  canRetry: boolean;
}) {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
      <Search
        aria-hidden="true"
        className="mx-auto h-8 w-8 text-wedplan-rose"
      />

      <h1 className="mt-4 text-2xl font-semibold">
        Service details unavailable
      </h1>

      <p className="mt-3 text-sm leading-6 text-stone-600">{message}</p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {canRetry && onRetry && (
          <Button
            type="button"
            radius="full"
            onPress={onRetry}
            className="bg-wedplan-rose font-semibold text-white"
          >
            Try again
          </Button>
        )}

        <Link
          href="/services"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#e3d4cd] bg-white px-5 text-sm font-semibold text-wedplan-ink transition hover:bg-[#f5eae5]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to services
        </Link>
      </div>
    </section>
  );
}

function VendorDetails({ vendor }: { vendor: ApiVendor | null | undefined }) {
  if (!vendor) {
    return (
      <div className="rounded-2xl border border-[#eaded8] bg-white p-5">
        <p className="text-sm text-stone-500">Vendor</p>
        <p className="mt-1 text-base font-semibold">
          Vendor information unavailable
        </p>
      </div>
    );
  }

  const displayName = vendor.businessName?.trim() || vendor.name;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#eaded8] bg-white p-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f8f2ef] text-wedplan-rose">
        <Store aria-hidden="true" className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-stone-500">Vendor</p>
        <p className="mt-1 truncate text-base font-semibold">{displayName}</p>
        {vendor.businessName?.trim() && vendor.name && (
          <p className="truncate text-sm text-stone-500">{vendor.name}</p>
        )}
        {vendor.isPremium && (
          <div className="mt-2">
            <PremiumBadge />
          </div>
        )}
      </div>
    </div>
  );
}

function BookingRequestForm({ serviceId }: { serviceId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<BookingFeedback>(null);
  const minimumEventDate = getLocalDateString(new Date());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const eventDate = formData.get("eventDate");
    const eventLocation = formData.get("eventLocation");
    const message = formData.get("message");

    if (
      typeof eventDate !== "string" ||
      typeof eventLocation !== "string" ||
      typeof message !== "string"
    ) {
      const errorMessage = "Please complete the booking form and try again.";

      setFeedback({ type: "error", message: errorMessage });
      addToast({
        title: "Booking not sent",
        description: errorMessage,
        color: "danger",
      });
      return;
    }

    if (eventDate < minimumEventDate) {
      const errorMessage = "Event date cannot be in the past.";

      setFeedback({ type: "error", message: errorMessage });
      addToast({
        title: "Booking not sent",
        description: errorMessage,
        color: "danger",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await apiFetch(`${API_BASE_URL}/api/bookings`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceId,
          eventDate,
          eventLocation,
          message,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 401) {
        const callbackURL = `/services/${serviceId}`;

        router.replace(
          `/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`,
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload) ??
            `Could not send booking request (HTTP ${response.status}).`,
        );
      }

      if (!isRecord(payload) || payload.success !== true) {
        throw new Error("The booking API returned an unexpected response.");
      }

      form.reset();
      setFeedback({
        type: "success",
        message: "Your booking request has been sent.",
      });
      addToast({
        title: "Booking request sent",
        description: "The vendor will review your request.",
        color: "success",
      });
    } catch (requestError) {
      const errorMessage =
        requestError instanceof TypeError
          ? "Could not reach WedPlan API. Check that the server is running and NEXT_PUBLIC_API_URL is correct."
          : requestError instanceof Error
            ? requestError.message
            : "Could not send the booking request.";

      setFeedback({ type: "error", message: errorMessage });
      addToast({
        title: "Booking not sent",
        description: errorMessage,
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (feedback?.type === "success") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm leading-6 text-emerald-900"
      >
        <p className="font-semibold">Request sent</p>
        <p className="mt-2">{feedback.message}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
      className="space-y-5"
    >
      <div>
        <label
          htmlFor="eventDate"
          className="block text-sm font-semibold text-wedplan-ink"
        >
          Event date
        </label>
        <input
          id="eventDate"
          name="eventDate"
          type="date"
          required
          min={minimumEventDate}
          disabled={isSubmitting}
          className="mt-2 min-h-12 w-full rounded-xl border border-[#e3d4cd] bg-white px-4 text-sm text-wedplan-ink outline-none transition focus:border-wedplan-rose focus:ring-2 focus:ring-wedplan-rose/20 disabled:cursor-not-allowed disabled:bg-stone-100"
        />
      </div>

      <div>
        <label
          htmlFor="eventLocation"
          className="block text-sm font-semibold text-wedplan-ink"
        >
          Event location
        </label>
        <input
          id="eventLocation"
          name="eventLocation"
          type="text"
          required
          maxLength={200}
          disabled={isSubmitting}
          placeholder="Enter the event location"
          className="mt-2 min-h-12 w-full rounded-xl border border-[#e3d4cd] bg-white px-4 text-sm text-wedplan-ink outline-none transition placeholder:text-stone-400 focus:border-wedplan-rose focus:ring-2 focus:ring-wedplan-rose/20 disabled:cursor-not-allowed disabled:bg-stone-100"
        />
      </div>

      <div>
        <label
          htmlFor="bookingMessage"
          className="block text-sm font-semibold text-wedplan-ink"
        >
          Message to vendor
          <span className="ml-1 font-normal text-stone-500">(optional)</span>
        </label>
        <textarea
          id="bookingMessage"
          name="message"
          rows={4}
          maxLength={2000}
          disabled={isSubmitting}
          placeholder="Share any details about your event"
          className="mt-2 w-full resize-y rounded-xl border border-[#e3d4cd] bg-white px-4 py-3 text-sm text-wedplan-ink outline-none transition placeholder:text-stone-400 focus:border-wedplan-rose focus:ring-2 focus:ring-wedplan-rose/20 disabled:cursor-not-allowed disabled:bg-stone-100"
        />
      </div>

      {feedback?.type === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800"
        >
          {feedback.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-wedplan-rose px-6 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wedplan-rose focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Sending request..." : "Send booking request"}
      </button>
    </form>
  );
}

function ServiceDetailContent() {
  const params = useParams<{ serviceId: string }>();
  const router = useRouter();
  const serviceId = params.serviceId;

  const { data: session, isPending: isSessionPending } =
    authClient.useSession();

  const userId = session?.user?.id;
  const accountRole = getAccountRole(session?.user);
  const validServiceId = isValidServiceId(serviceId);

  const [retryKey, setRetryKey] = useState(0);
  const [requestState, setRequestState] = useState<ServiceDetailState>({
    key: "",
    service: null,
    error: null,
  });

  const requestKey = `${serviceId}:${userId ?? "anonymous"}:${retryKey}`;

  useEffect(() => {
    if (isSessionPending) {
      return;
    }

    if (!userId) {
      const callbackURL = `/services/${serviceId}`;

      router.replace(`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`);
      return;
    }

    if (!validServiceId) {
      return;
    }

    const controller = new AbortController();

    async function loadService() {
      try {
        const response = await apiFetch(
          `${API_BASE_URL}/api/services/${encodeURIComponent(serviceId)}`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );

        const payload: unknown = await response.json().catch(() => null);

        if (response.status === 401) {
          const callbackURL = `/services/${serviceId}`;

          router.replace(
            `/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`,
          );
          return;
        }

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(payload) ??
              `Could not load service details (HTTP ${response.status}).`,
          );
        }

        if (!isServiceDetailResponse(payload)) {
          throw new Error("The service API returned an unexpected response.");
        }

        if (controller.signal.aborted) {
          return;
        }

        setRequestState({
          key: requestKey,
          service: payload.service,
          error: null,
        });
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setRequestState({
          key: requestKey,
          service: null,
          error:
            requestError instanceof TypeError
              ? "Could not reach WedPlan API. Check that the server is running and NEXT_PUBLIC_API_URL is correct."
              : requestError instanceof Error
                ? requestError.message
                : "Could not load service details.",
        });
      }
    }

    void loadService();

    return () => controller.abort();
  }, [isSessionPending, requestKey, router, serviceId, userId, validServiceId]);

  const hasCurrentResult = requestState.key === requestKey;
  const isLoading =
    isSessionPending || !userId || (validServiceId && !hasCurrentResult);

  const service = hasCurrentResult ? requestState.service : null;
  const error = hasCurrentResult ? requestState.error : null;

  if (isLoading) {
    return <ServiceDetailSkeleton />;
  }

  if (!validServiceId) {
    return (
      <ServiceDetailError
        message="This service link is invalid."
        canRetry={false}
      />
    );
  }

  if (error) {
    return (
      <ServiceDetailError
        message={error}
        canRetry
        onRetry={() => setRetryKey((current) => current + 1)}
      />
    );
  }

  if (!service) {
    return (
      <ServiceDetailError
        message="This approved service could not be found."
        canRetry={false}
      />
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

      <article className="mt-7 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div
          className={`relative min-h-[320px] overflow-hidden rounded-[2rem] ${categoryArtwork[service.category]} sm:min-h-[460px]`}
        >
          {service.images?.[0] && (
            <Image
              src={service.images[0]}
              alt={service.serviceName}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              unoptimized
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              className="object-cover"
            />
          )}

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-white/10"
          />

          <span className="absolute bottom-5 left-5 inline-flex items-center rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-[#4f3d38] backdrop-blur">
            {service.category}
          </span>

          <FavoriteButton
            serviceId={service._id}
            className="absolute right-5 top-5 h-11 w-11"
          />
        </div>

        <div className="flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wedplan-rose">
            Approved wedding service
          </p>

          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {service.serviceName}
          </h1>

          <p className="mt-5 whitespace-pre-line text-base leading-7 text-stone-600">
            {service.description}
          </p>

          <div className="mt-6 flex items-center gap-2 text-sm text-stone-600">
            <MapPin
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-wedplan-rose"
            />
            {service.location}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#eaded8] bg-white p-5">
              <p className="text-sm text-stone-500">Service price</p>
              <p className="mt-1 text-2xl font-semibold">
                {priceFormatter.format(service.price)}
              </p>
            </div>

            <VendorDetails vendor={service.vendor} />
          </div>
        </div>
      </article>

      <section className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wedplan-rose">
            Plan your event
          </p>

          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Request this service
          </h2>

          <p className="mt-4 max-w-xl text-sm leading-7 text-stone-600">
            Send the vendor your event date and location. Your request will be
            pending until the vendor responds.
          </p>
        </div>

        <div className="rounded-2xl border border-[#eaded8] bg-white p-5 shadow-sm sm:p-7">
          {accountRole === "customer" ? (
            <BookingRequestForm serviceId={service._id} />
          ) : (
            <div className="rounded-xl bg-[#f8f2ef] p-5">
              <h3 className="font-semibold text-wedplan-ink">
                Customer account required
              </h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Booking requests are available to customer accounts. Sign in
                with a customer account to request this service.
              </p>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function SiteHeaderSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="h-20 animate-pulse border-b border-[#eaded8] bg-white"
    />
  );
}

export default function ServiceDetailPage() {
  return (
    <FavoritesProvider>
      <div className="flex min-h-screen flex-col bg-wedplan-cream text-wedplan-ink">
        <Suspense fallback={<SiteHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>

        <main className="flex-1">
          <Suspense fallback={<ServiceDetailSkeleton />}>
            <ServiceDetailContent />
          </Suspense>
        </main>

        <SiteFooter />
      </div>
    </FavoritesProvider>
  );
}
