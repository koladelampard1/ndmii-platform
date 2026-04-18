"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  galleryAction: (formData: FormData) => Promise<void>;
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

export function MsmePortfolioGalleryDashboard({ gallery, saved, galleryAction }: MsmePortfolioGalleryDashboardProps) {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "featured">("newest");

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
    <section className="space-y-6 pb-4">
      {saved && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">Portfolio updated.</p>}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Portfolio / Gallery</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">Showcase your work and build trust with your customers.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowUploadForm((open) => !open)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
        >
          <Plus className="h-4 w-4" />
          Upload New Item
        </button>
      </header>

      {showUploadForm && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Upload Portfolio Item</h2>
          <form action={galleryAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input type="hidden" name="kind" value="create" />
            <input
              name="asset_url"
              required
              placeholder="Image URL"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm shadow-sm md:col-span-2 xl:col-span-2"
            />
            <input name="caption" placeholder="Caption" className="h-11 rounded-xl border border-slate-200 px-3 text-sm shadow-sm md:col-span-2" />
            <input name="sort_order" type="number" defaultValue={0} className="h-11 rounded-xl border border-slate-200 px-3 text-sm shadow-sm" />
            <select name="is_featured" className="h-11 rounded-xl border border-slate-200 px-3 text-sm shadow-sm">
              <option value="false">Standard Item</option>
              <option value="true">Featured Item</option>
            </select>
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
          <article key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 inline-flex rounded-full bg-emerald-50 p-3 text-emerald-700 ring-1 ring-emerald-100">
              <stat.icon className="h-4 w-4" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-950">{stat.value}</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{stat.label}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.helper}</p>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search portfolio items..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm"
            />
          </label>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
          >
            <option value="all">All Categories</option>
            <option value="general">General</option>
            <option value="featured">Featured</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
          >
            <option value="all">All Status</option>
            <option value="standard">Standard</option>
            <option value="featured">Featured</option>
          </select>
          <label className="relative block">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "newest" | "oldest" | "featured")}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="featured">Sort: Featured</option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="xl:col-span-9">
          {filteredGallery.length === 0 ? (
            <article className="flex min-h-[390px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <div className="mb-6 inline-flex rounded-full bg-emerald-50 p-5 text-emerald-700 ring-1 ring-emerald-100">
                <Folder className="h-8 w-8" />
              </div>
              <h3 className="text-3xl font-bold tracking-tight text-slate-900">Your portfolio is empty</h3>
              <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
                Upload your work, project photos, or documents to showcase your expertise and build confidence with potential customers.
              </p>
              <button
                type="button"
                onClick={() => setShowUploadForm(true)}
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
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
                      <input name="asset_url" defaultValue={item.asset_url ?? ""} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Image URL" />
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

        <aside className="space-y-4 xl:col-span-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
              <Lightbulb className="h-4 w-4 text-emerald-700" />
              Tips for a Great Portfolio
            </h2>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>• Upload high-quality images</li>
              <li>• Show before and after results</li>
              <li>• Add clear descriptions</li>
              <li>• Organize with categories</li>
              <li>• Keep your portfolio updated</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
              <Folder className="h-4 w-4 text-emerald-700" />
              Recommended Categories
            </h2>
            <div className="flex flex-wrap gap-2">
              {recommendedCategories.map((category) => (
                <span key={category} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {category}
                </span>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-700 bg-gradient-to-br from-emerald-800 to-emerald-950 p-4 text-white shadow-sm">
            <div className="mb-4 inline-flex rounded-xl bg-white/15 p-2">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold">Grow Your Business</h2>
            <p className="mt-2 text-sm text-emerald-50">A strong portfolio helps you stand out and win more trust and projects.</p>
            <Link
              href="/dashboard/msme/services"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-emerald-800"
            >
              Go to Services
            </Link>
          </article>
        </aside>
      </div>
    </section>
  );
}
