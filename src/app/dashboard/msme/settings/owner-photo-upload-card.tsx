"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { PassportPhoto } from "@/components/msme/passport-photo";
import { MAX_PASSPORT_FILE_BYTES, validatePassportPhotoFile } from "@/lib/msme/passport-upload";

type Props = {
  initialPhotoUrl: string | null;
  ownerName: string | null;
  msmeId?: string | null;
};

function ownerInitials(value: string | null) {
  const words = (value ?? "")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  return initials || "DB";
}

export function OwnerPhotoUploadCard({ initialPhotoUrl, ownerName, msmeId }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState(initialPhotoUrl ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setPhotoUrl(initialPhotoUrl ?? "");
    setPreviewUrl(initialPhotoUrl ?? "");
  }, [initialPhotoUrl]);

  useEffect(() => {
    if (!previewUrl.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const onChooseFile = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");

    const validation = validatePassportPhotoFile(file);
    if (!validation.ok) {
      setError(validation.message);
      event.target.value = "";
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("passport_photo", file);
      formData.append("persist_to_msme", "1");

      const response = await fetch("/api/msme/passport-photo", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(String(payload?.error ?? "Passport photo upload failed. Please try again."));
        setPreviewUrl(photoUrl);
        return;
      }

      const nextPhotoUrl = String(payload?.passportPhotoUrl ?? payload?.publicUrl ?? "");
      setPhotoUrl(nextPhotoUrl);
      setPreviewUrl(nextPhotoUrl);
      setSuccess("Passport photo uploaded and saved successfully.");
      window.dispatchEvent(new CustomEvent("ndmii:passport-photo-uploaded", { detail: { passportPhotoUrl: nextPhotoUrl } }));
    } catch {
      setError("Passport photo upload failed. Please check your connection and retry.");
      setPreviewUrl(photoUrl);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="mx-auto shrink-0 rounded-2xl border-2 border-emerald-700 bg-white p-1 shadow-sm sm:mx-0">
          <PassportPhoto
            src={previewUrl}
            alt="Owner or representative passport photo"
            className="h-32 w-28 rounded-xl object-cover"
            placeholderClassName="flex h-32 w-28 items-center justify-center rounded-xl bg-emerald-50 text-2xl font-bold text-emerald-800"
            placeholderText={ownerInitials(ownerName)}
            diagnostics={{
              msmeId,
              persistedColumn: initialPhotoUrl ? "passport_photo_path" : "none",
              valueType: initialPhotoUrl ? "public_url" : "null",
              signedUrlGenerated: Boolean(initialPhotoUrl),
            }}
          />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={onFileChange}
            disabled={isUploading}
          />

          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={onChooseFile}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {isUploading ? "Uploading..." : photoUrl ? "Replace Passport Photo" : "Upload Passport Photo"}
          </button>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            JPG, JPEG, PNG, or WEBP. Max size {Math.round(MAX_PASSPORT_FILE_BYTES / (1024 * 1024))}MB. This photo appears on your Business Identity Credential.
          </p>
          {success ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {success}
            </p>
          ) : null}
          {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
