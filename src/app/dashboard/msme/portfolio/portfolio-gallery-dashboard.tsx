"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  ArrowUpDown,
  Folder,
  Heart,
  Image as ImageIcon,
  Lightbulb,
  Plus,
  Search,
  Star,
  TrendingUp,
  Eye,
} from "lucide-react";

type GalleryItem = {
  id: string;
  asset_url: string | null;
  caption: string | null;
  is_featured: boolean | null;
  sort_order: number | null;
  updated_at: string | null;
};

type MsmePortfolioGalleryDashboardProps = {
  gallery: GalleryItem[];
  saved: boolean;
  error: string | null;
  galleryAction: (formData: FormData) => Promise<void>;
};

const ACCEPTED_FILE_TYPES = ".jpg,.jpeg,.png,.webp";
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const uploadErrorMessages: Record<string, string> = {
  file_required: "Please choose an image file to upload.",
  unsupported_file_type: "Unsupported image format. Use JPG, JPEG, PNG, or WEBP.",
  file_too_large: "Image size must be 5MB or less.",
  upload_failed: "Image upload failed. Please try again.",
  save_failed: "Portfolio item could not be saved. Please try again.",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return parsed.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

function titleFromItem(item: GalleryItem) {
  const caption = item.caption?.trim();
  if (caption) return caption;
  return `Portfolio Item #${item.sort_order ?? 0}`;
}

const recommendedCategories = ["Completed Projects", "Certifications", "Equipment", "Team", "Events", "Other"];

export function MsmePortfolioGalleryDashboard({ gallery, saved, error, galleryAction }: MsmePortfolioGalleryDashboardProps) {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "featured">("newest");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(error ? uploadErrorMessages[error] ?? "Unable to save portfolio item." : null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  function validateFile(file: File) {
    const lowerName = file.name.toLowerCase();
    const allowedExtension = [".jpg", ".jpeg", ".png", ".webp"].some((extension) => lowerName.endsWith(extension));
    if (!allowedExtension) {
      return "Unsupported image format. Use JPG, JPEG, PNG, or WEBP.";
    }

    if (file.size > MAX_FILE_BYTES) {
      return "Image size must be 5MB or less.";
    }

    return null;
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationMessage = validateFile(file);
    if (validationMessage) {
      setSelectedFile(null);
      setFileError(validationMessage);
      event.target.value = "";
      return;
    }

    setFileError(null);
    setSelectedFile(file);
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setFileError(null);
  }

  const totalItems = gallery.length;
  const totalViews = 0;
  const totalLikes = 0;
  const averageRating = 0;

  const filteredGallery = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const filtered = gallery.filter((item) => {
      const caption = item.caption ?? "";
      const displayCategory = item.is_featured ? "featured" : "general";
      const displayStatus = item.is_featured ? "featured" : "standard";

      const matchesQuery = !lowered.length || caption.toLowerCase().includes(lowered) || String(item.asset_url ?? "").toLowerCase().includes(lowered);
      const matchesCategory = categoryFilter === "all" || categoryFilter === displayCategory;
      const matchesStatus = statusFilter === "all" || statusFilter === displayStatus;
      return matchesQuery && matchesCategory && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "featured") {
        return Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
      }

      const left = new Date(a.updated_at ?? 0).getTime();
      const right = new Date(b.updated_at ?? 0).getTime();
      if (sortBy === "oldest") return left - right;
      return right - left;
    });
  }, [gallery, query, categoryFilter, statusFilter, sortBy]);

  return (
    <section className="mx-auto w-full max-w-[1400px] space-y-8 px-1 pb-6 pt-2 sm:px-2 lg:space-y-9 lg:px-3 lg:pt-4">
      {saved && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">Portfolio updated.</p>}
      {fileError && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{fileError}</p>}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[2rem]">Portfolio / Gallery</h1>
          <p className="text-sm text-slate-500 sm:text-base">Showcase your work and build trust with your customers.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowUploadForm((open) => !open)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm shadow-emerald-950/10 transition hover:bg-emerald-800"
        >
          <Plus className="h-4 w-4" />
          Upload New Item
        </button>
      </header>

      {showUploadForm && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Upload Portfolio Item</h2>
          <form
            action={galleryAction}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
            onSubmit={(event) => {
              if (!selectedFile) {
                event.preventDefault();
                setFileError("Please choose an image file to upload.");
              }
            }}
          >
            <input type="hidden" name="kind" value="create" />
            <div className="space-y-3 md:col-span-2 xl:col-span-3">
              <label htmlFor="asset_file" className="text-sm font-medium text-slate-700">
                Portfolio Image
              </label>
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
                <input id="asset_file" name="asset_file" type="file" accept={ACCEPTED_FILE_TYPES} className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-800" onChange={handleFileChange} />
                <p className="mt-2 text-xs text-slate-500">Accepted: JPG, JPEG, PNG, WEBP • Max size: 5MB</p>
                {selectedFile && (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                    <span className="truncate pr-2 font-medium">{selectedFile.name}</span>
                    <button type="button" onClick={clearSelectedFile} className="font-semibold text-rose-600 hover:text-rose-700">
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {previewUrl && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Selected portfolio preview" className="h-52 w-full object-cover" />
                </div>
              )}
            </div>
            <input name="caption" placeholder="Caption" className="h-11 rounded-xl border border-slate-200 px-3 text-sm shadow-sm md:col-span-2" />
            <input name="sort_order" type="number" defaultValue={0} className="h-11 rounded-xl border border-slate-200 px-3 text-sm shadow-sm" />
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Category / Item Type</label>
              <select name="is_featured" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm">
                <option value="false">Standard Item</option>
                <option value="true">Featured Item</option>
              </select>
            </div>
            <div className="md:col-span-2 xl:col-span-5 flex justify-end">
              <button className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Save Portfolio Item</button>
            </div>
          </form>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: ImageIcon, label: "Total Items", value: totalItems, helper: "All portfolio items" },
          { icon: Eye, label: "Total Views", value: totalViews, helper: "This month" },
          { icon: Heart, label: "Total Likes", value: totalLikes, helper: "This month" },
          { icon: Star, label: "Avg. Rating", value: averageRating.toFixed(1), helper: "Based on reviews" },
        ].map((stat) => (
          <article key={stat.label} className="flex min-h-[168px] flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
            <div className="mb-5 inline-flex w-fit rounded-xl bg-emerald-50 p-2.5 text-emerald-700 ring-1 ring-emerald-100/80">
              <stat.icon className="h-[18px] w-[18px]" />
            </div>
            <p className="text-3xl font-bold leading-none tracking-tight text-slate-950">{stat.value}</p>
            <p className="mt-3 text-sm font-semibold text-slate-800">{stat.label}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.helper}</p>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
          <label className="relative block md:col-span-2 xl:col-span-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search portfolio items..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 xl:col-span-2"
          >
            <option value="all">All Categories</option>
            <option value="general">General</option>
            <option value="featured">Featured</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 xl:col-span-2"
          >
            <option value="all">All Status</option>
            <option value="standard">Standard</option>
            <option value="featured">Featured</option>
          </select>
          <label className="relative block xl:col-span-3">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "newest" | "oldest" | "featured")}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="featured">Sort: Featured</option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-12">
        <section className="xl:col-span-9">
          {filteredGallery.length === 0 ? (
            <article className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm shadow-slate-200/50">
              <div className="mb-7 inline-flex rounded-2xl bg-emerald-50 p-5 text-emerald-700 ring-1 ring-emerald-100">
                <Folder className="h-9 w-9" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">Your portfolio is empty</h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Upload your work, project photos, or documents to showcase your expertise and build confidence with potential customers.
              </p>
              <button
                type="button"
                onClick={() => setShowUploadForm(true)}
                className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm shadow-emerald-950/10 transition hover:bg-emerald-800"
              >
                <Plus className="h-4 w-4" />
                Upload New Item
              </button>
            </article>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredGallery.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="aspect-video w-full bg-slate-100">
                    {item.asset_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.asset_url} alt={titleFromItem(item)} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <ImageIcon className="h-7 w-7" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{titleFromItem(item)}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.is_featured ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        {item.is_featured ? "Featured" : "Standard"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">Category: {item.is_featured ? "Featured" : "General"}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">Date added: {formatDate(item.updated_at)}</span>
                    </div>

                    <form action={galleryAction} className="grid gap-2 border-t border-slate-100 pt-3">
                      <input type="hidden" name="kind" value="update" />
                      <input type="hidden" name="item_id" value={item.id} />
                      <input name="caption" defaultValue={item.caption ?? ""} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Caption" />
                      <div className="grid grid-cols-2 gap-2">
                        <input name="sort_order" type="number" defaultValue={item.sort_order ?? 0} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
                        <select name="is_featured" defaultValue={String(Boolean(item.is_featured))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
                          <option value="false">Standard</option>
                          <option value="true">Featured</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">Save</button>
                      </div>
                    </form>

                    <form action={galleryAction}>
                      <input type="hidden" name="kind" value="delete" />
                      <input type="hidden" name="item_id" value={item.id} />
                      <button className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">Remove</button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-5 xl:col-span-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
              <Lightbulb className="h-4 w-4 text-emerald-700" />
              Tips for a Great Portfolio
            </h2>
            <ul className="space-y-2.5 text-sm leading-relaxed text-slate-600">
              <li>• Upload high-quality images</li>
              <li>• Show before and after results</li>
              <li>• Add clear descriptions</li>
              <li>• Organize with categories</li>
              <li>• Keep your portfolio updated</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
              <Folder className="h-4 w-4 text-emerald-700" />
              Recommended Categories
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {recommendedCategories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm shadow-slate-200/30"
                >
                  {category}
                </span>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-700/90 bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 p-5 text-white shadow-sm shadow-emerald-950/40">
            <div className="mb-4 inline-flex rounded-xl bg-white/15 p-2.5 ring-1 ring-white/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Grow Your Business</h2>
            <p className="mt-2 text-sm leading-relaxed text-emerald-50">A strong portfolio helps you stand out and win more trust and projects.</p>
            <Link
              href="/dashboard/msme/services"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
            >
              Go to Services
            </Link>
          </article>
        </aside>
      </div>
    </section>
  );
}
