"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { MAX_PROVIDER_LOGO_BYTES, validateProviderLogoFile } from "@/lib/msme/provider-logo-upload";

type Props = {
  initialLogoUrl: string | null;
};

export function LogoUploadCard({ initialLogoUrl }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState(initialLogoUrl ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setLogoUrl(initialLogoUrl ?? "");
    setPreviewUrl(initialLogoUrl ?? "");
  }, [initialLogoUrl]);

  useEffect(() => {
    if (!previewUrl.startsWith("blob:")) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onChooseFile = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");

    const validation = validateProviderLogoFile(file);
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
      formData.append("logo_file", file);

      const response = await fetch("/api/msme/provider-logo", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(String(payload?.error ?? "Logo upload failed. Please try again."));
        return;
      }

      const nextLogoUrl = String(payload?.logoUrl ?? "");
      setLogoUrl(nextLogoUrl);
      setPreviewUrl(nextLogoUrl);
      setSuccess("Logo uploaded and saved successfully.");
    } catch {
      setError("Logo upload failed. Please check your connection and retry.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-300 bg-white text-slate-400">
        {previewUrl ? <img src={previewUrl} alt="Business logo" className="h-full w-full object-cover" /> : <Upload className="h-6 w-6" />}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,.png,.jpg,.jpeg,.svg,.webp"
        className="hidden"
        onChange={onFileChange}
        disabled={isUploading}
      />

      <button
        type="button"
        className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        onClick={onChooseFile}
        disabled={isUploading}
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isUploading ? "Uploading…" : "Upload Logo"}
      </button>

      <input type="hidden" name="logo_url" value={logoUrl} />

      <p className="mt-2 text-xs text-slate-500">PNG, JPG, SVG, or WEBP. Max size {Math.round(MAX_PROVIDER_LOGO_BYTES / (1024 * 1024))}MB.</p>
      {success ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {success}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
