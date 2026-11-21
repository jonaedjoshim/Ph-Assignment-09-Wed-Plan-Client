"use client";

import { addToast } from "@heroui/react";
import { ArrowLeft, Camera, Save, ShieldCheck, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { SiteFooter } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/lib/api";

type AccountRole = "customer" | "vendor" | "admin" | "unknown";

type Profile = {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  businessName: string;
  phone: string;
  location: string;
  bio: string;
  updatedAt: string | null;
};

type ProfileResponse = {
  success: true;
  profile: Profile;
};

type ProfileRequestState = {
  key: string;
  profile: Profile | null;
  error: string | null;
};

type ProfileFormValues = {
  name: string;
  businessName: string;
  phone: string;
  location: string;
  bio: string;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAccountRole(value: unknown): value is AccountRole {
  return (
    value === "customer" ||
    value === "vendor" ||
    value === "admin" ||
    value === "unknown"
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isProfile(value: unknown): value is Profile {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    isAccountRole(value.role) &&
    typeof value.businessName === "string" &&
    typeof value.phone === "string" &&
    typeof value.location === "string" &&
    typeof value.bio === "string" &&
    isNullableString(value.updatedAt)
  );
}

function isProfileResponse(value: unknown): value is ProfileResponse {
  return isRecord(value) && value.success === true && isProfile(value.profile);
}

function getAccountRole(value: unknown): AccountRole | null {
  if (!isRecord(value)) {
    return null;
  }

  return isAccountRole(value.role) ? value.role : null;
}

function getApiErrorMessage(value: unknown): string | null {
  if (isRecord(value) && typeof value.message === "string") {
    return value.message;
  }

  return null;
}

function getProfileRoleLabel(role: AccountRole): string {
  if (role === "unknown") {
    return "Account";
  }

  return `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
}

function ProfileSettingsSkeleton() {
  return (
    <section
      aria-busy="true"
      className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14"
    >
      <p role="status" className="sr-only">
        Loading profile settings
      </p>

      <div className="h-9 w-72 animate-pulse rounded bg-[#eaded8]" />
      <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-[#f0e8e4]" />

      <div className="mt-8 rounded-2xl border border-[#eaded8] bg-white p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-[#eaded8]" />
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {[0, 1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-12 animate-pulse rounded-xl bg-[#f0e8e4]"
            />
          ))}
        </div>
      </div>
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

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function AvatarUploader() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: session } = authClient.useSession();
  const avatarUrl = getAvatarUrl(session?.user?.image);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!AVATAR_TYPES.has(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setError("Your avatar must be 2 MB or smaller.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await apiFetch(`${API_BASE_URL}/api/uploads/avatar`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 401) {
        router.replace(
          `/sign-in?callbackURL=${encodeURIComponent("/settings/profile")}`,
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload) ??
            `Could not upload your avatar (HTTP ${response.status}).`,
        );
      }

      const uploadedUrl = isRecord(payload) ? getAvatarUrl(payload.url) : null;

      if (!uploadedUrl) {
        throw new Error("The upload API returned an invalid image URL.");
      }

      const updateResult = await authClient.updateUser({ image: uploadedUrl });

      if (updateResult.error) {
        throw new Error(
          updateResult.error.message ?? "Could not save your avatar.",
        );
      }

      addToast({ title: "Avatar updated", color: "success" });
    } catch (requestError) {
      const message =
        requestError instanceof TypeError
          ? "Could not reach WedPlan API. Check that the server is running."
          : requestError instanceof Error
            ? requestError.message
            : "Could not update your avatar.";

      setError(message);
      addToast({
        title: "Avatar not updated",
        description: message,
        color: "danger",
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#eaded8] bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#f5eae5]">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Your profile photo"
              fill
              sizes="64px"
              unoptimized
              className="object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-wedplan-rose">
              <UserRound aria-hidden="true" className="h-8 w-8" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Profile photo</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Shown next to your name across WedPlan. JPEG, PNG, or WebP up to 2
            MB.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void handleFileChange(event)}
            className="hidden"
            aria-label="Choose a profile photo"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#e3d4cd] px-5 text-sm font-semibold text-stone-700 transition hover:bg-[#f5eae5] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Camera aria-hidden="true" className="h-4 w-4" />
            {isUploading ? "Uploading..." : avatarUrl ? "Change photo" : "Add photo"}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function ProfileEditor({
  profile,
  onProfileUpdated,
}: {
  profile: Profile;
  onProfileUpdated: (profile: Profile) => void;
}) {
  const router = useRouter();
  const [formValues, setFormValues] = useState<ProfileFormValues>(() => ({
    name: profile.name,
    businessName: profile.businessName,
    phone: profile.phone,
    location: profile.location,
    bio: profile.bio,
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = formValues.name.trim();
    const businessName = formValues.businessName.trim();
    const phone = formValues.phone.trim();
    const location = formValues.location.trim();
    const bio = formValues.bio.trim();

    if (!name || name.length > 100) {
      setError("Name must be between 1 and 100 characters.");
      return;
    }

    if (profile.role === "vendor" && businessName.length > 120) {
      setError("Business name cannot exceed 120 characters.");
      return;
    }

    if (phone.length > 40 || (phone && !/^[+\d().\-\s]+$/.test(phone))) {
      setError("Enter a valid phone number of up to 40 characters.");
      return;
    }

    if (location.length > 200) {
      setError("Location cannot exceed 200 characters.");
      return;
    }

    if (bio.length > 1000) {
      setError("Bio cannot exceed 1000 characters.");
      return;
    }

    const body: Record<string, string> = {
      name,
      phone,
      location,
      bio,
    };

    if (profile.role === "vendor") {
      body.businessName = businessName;
    }

    setIsSaving(true);
    setError(null);
    setNotice("");

    try {
      const response = await apiFetch(`${API_BASE_URL}/api/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 401) {
        router.replace(
          `/sign-in?callbackURL=${encodeURIComponent("/settings/profile")}`,
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload) ??
            `Could not update profile (HTTP ${response.status}).`,
        );
      }

      if (!isProfileResponse(payload)) {
        throw new Error("The profile API returned an unexpected response.");
      }

      setFormValues({
        name: payload.profile.name,
        businessName: payload.profile.businessName,
        phone: payload.profile.phone,
        location: payload.profile.location,
        bio: payload.profile.bio,
      });
      onProfileUpdated(payload.profile);
      setNotice("Your profile has been updated.");
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Could not reach WedPlan API. Check that the server is running and NEXT_PUBLIC_API_URL is correct."
          : requestError instanceof Error
            ? requestError.message
            : "Could not update your profile.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isSaving}
      className="mt-8 rounded-2xl border border-[#eaded8] bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="flex items-start gap-4 border-b border-[#eaded8] pb-5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#f5eae5] text-wedplan-rose">
          <UserRound aria-hidden="true" className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">Profile information</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Update the contact and profile details shown on your account.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="profileName" className="block text-sm font-semibold">
            Name
          </label>
          <input
            id="profileName"
            name="name"
            type="text"
            required
            maxLength={100}
            autoComplete="name"
            value={formValues.name}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            disabled={isSaving}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#e3d4cd] bg-white px-4 text-sm outline-none transition focus:border-wedplan-rose focus:ring-2 focus:ring-wedplan-rose/20 disabled:bg-stone-100"
          />
        </div>

        <div>
          <label htmlFor="profileEmail" className="block text-sm font-semibold">
            Email
          </label>
          <input
            id="profileEmail"
            type="email"
            value={profile.email}
            readOnly
            className="mt-2 min-h-12 w-full rounded-xl border border-[#e3d4cd] bg-stone-100 px-4 text-sm text-stone-600"
          />
          <p className="mt-1 text-xs text-stone-500">
            Email changes are not available here.
          </p>
        </div>

        {profile.role === "vendor" && (
          <div>
            <label
              htmlFor="profileBusinessName"
              className="block text-sm font-semibold"
            >
              Business name
            </label>
            <input
              id="profileBusinessName"
              name="businessName"
              type="text"
              maxLength={120}
              autoComplete="organization"
              value={formValues.businessName}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  businessName: event.target.value,
                }))
              }
              disabled={isSaving}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#e3d4cd] bg-white px-4 text-sm outline-none transition focus:border-wedplan-rose focus:ring-2 focus:ring-wedplan-rose/20 disabled:bg-stone-100"
            />
          </div>
        )}

        <div>
          <label htmlFor="profilePhone" className="block text-sm font-semibold">
            Phone
          </label>
          <input
            id="profilePhone"
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="tel"
            value={formValues.phone}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
            disabled={isSaving}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#e3d4cd] bg-white px-4 text-sm outline-none transition focus:border-wedplan-rose focus:ring-2 focus:ring-wedplan-rose/20 disabled:bg-stone-100"
          />
        </div>

        <div>
          <label
            htmlFor="profileLocation"
            className="block text-sm font-semibold"
          >
            Location
          </label>
          <input
            id="profileLocation"
            name="location"
            type="text"
            maxLength={200}
            autoComplete="address-level2"
            value={formValues.location}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                location: event.target.value,
              }))
            }
            disabled={isSaving}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#e3d4cd] bg-white px-4 text-sm outline-none transition focus:border-wedplan-rose focus:ring-2 focus:ring-wedplan-rose/20 disabled:bg-stone-100"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="profileBio" className="block text-sm font-semibold">
            Bio
          </label>
          <textarea
            id="profileBio"
            name="bio"
            rows={5}
            maxLength={1000}
            value={formValues.bio}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                bio: event.target.value,
              }))
            }
            disabled={isSaving}
            className="mt-2 w-full resize-y rounded-xl border border-[#e3d4cd] bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-wedplan-rose focus:ring-2 focus:ring-wedplan-rose/20 disabled:bg-stone-100"
          />
          <p className="mt-1 text-xs text-stone-500">Up to 1000 characters.</p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {notice}
        </p>
      )}

      <div className="mt-6">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-wedplan-rose px-6 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save aria-hidden="true" className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}

function ProfileSettingsContent() {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();

  const userId = session?.user?.id;
  const accountRole = getAccountRole(session?.user);

  const [retryKey, setRetryKey] = useState(0);
  const [requestState, setRequestState] = useState<ProfileRequestState>({
    key: "",
    profile: null,
    error: null,
  });

  const requestKey = `${userId ?? "anonymous"}:${accountRole ?? "unknown"}:${retryKey}`;

  useEffect(() => {
    if (isSessionPending) {
      return;
    }

    if (!userId) {
      router.replace(
        `/sign-in?callbackURL=${encodeURIComponent("/settings/profile")}`,
      );
      return;
    }

    const controller = new AbortController();

    async function loadProfile() {
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/profile`, {
          credentials: "include",
          signal: controller.signal,
        });

        const payload: unknown = await response.json().catch(() => null);

        if (response.status === 401) {
          router.replace(
            `/sign-in?callbackURL=${encodeURIComponent("/settings/profile")}`,
          );
          return;
        }

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(payload) ??
              `Could not load profile (HTTP ${response.status}).`,
          );
        }

        if (!isProfileResponse(payload)) {
          throw new Error("The profile API returned an unexpected response.");
        }

        if (controller.signal.aborted) {
          return;
        }

        setRequestState({
          key: requestKey,
          profile: payload.profile,
          error: null,
        });
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setRequestState({
          key: requestKey,
          profile: null,
          error:
            requestError instanceof TypeError
              ? "Could not reach WedPlan API. Check that the server is running and NEXT_PUBLIC_API_URL is correct."
              : requestError instanceof Error
                ? requestError.message
                : "Could not load your profile.",
        });
      }
    }

    void loadProfile();

    return () => controller.abort();
  }, [isSessionPending, requestKey, router, userId]);

  const hasCurrentResult = requestState.key === requestKey;
  const isLoading = isSessionPending || (Boolean(userId) && !hasCurrentResult);
  const profile = hasCurrentResult ? requestState.profile : null;
  const error = hasCurrentResult ? requestState.error : null;

  function handleProfileUpdated(updatedProfile: Profile) {
    setRequestState({
      key: requestKey,
      profile: updatedProfile,
      error: null,
    });
  }

  if (isLoading) {
    return <ProfileSettingsSkeleton />;
  }

  if (!userId) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
        <ShieldCheck
          aria-hidden="true"
          className="mx-auto h-9 w-9 text-wedplan-rose"
        />
        <h1 className="mt-4 text-2xl font-semibold">Sign in required</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Sign in to view and update your profile.
        </p>
        <Link
          href="/sign-in?callbackURL=%2Fsettings%2Fprofile"
          className="mt-6 inline-flex min-h-10 items-center rounded-full bg-wedplan-rose px-5 text-sm font-semibold text-white"
        >
          Sign in
        </Link>
      </section>
    );
  }

  if (error || !profile) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
        <UserRound
          aria-hidden="true"
          className="mx-auto h-9 w-9 text-wedplan-rose"
        />
        <h1 className="mt-4 text-2xl font-semibold">Profile unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          {error ?? "Could not load your profile."}
        </p>
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
    <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-wedplan-rose"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to home
      </Link>

      <div className="mt-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wedplan-rose">
          Account settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Profile settings
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Manage your {getProfileRoleLabel(profile.role).toLowerCase()} profile
          information.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-[#eaded8] bg-white px-5 py-4">
        <p className="text-sm text-stone-600">
          Account type:{" "}
          <span className="font-semibold text-wedplan-ink">
            {getProfileRoleLabel(profile.role)}
          </span>
        </p>
      </div>

      <AvatarUploader />

      <ProfileEditor
        key={profile.id}
        profile={profile}
        onProfileUpdated={handleProfileUpdated}
      />
    </section>
  );
}

export default function ProfileSettingsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-wedplan-cream text-wedplan-ink">
      <Suspense fallback={<SiteHeaderSkeleton />}>
        <SiteHeader />
      </Suspense>

      <main className="flex-1">
        <Suspense fallback={<ProfileSettingsSkeleton />}>
          <ProfileSettingsContent />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
