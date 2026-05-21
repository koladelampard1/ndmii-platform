"use client";

import { useMemo, useState } from "react";

type ServiceCreateFormProps = {
  categories: string[];
  createAction: (formData: FormData) => Promise<void>;
};

export function ServiceCreateForm({ categories, createAction }: ServiceCreateFormProps) {
  const [priceType, setPriceType] = useState<"fixed" | "starting_from" | "negotiable" | "request_quote">("fixed");
  const showPriceRange = useMemo(() => priceType === "fixed" || priceType === "starting_from", [priceType]);

  return (
    <form action={createAction} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1.5 md:col-span-2">
        <label htmlFor="title" className="text-sm font-medium text-slate-700">
          Service title
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="e.g. CAC Registration Support"
          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="category" className="text-sm font-medium text-slate-700">
          Category
        </label>
        <select id="category" name="category" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm">
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="specialization" className="text-sm font-medium text-slate-700">
          Subcategory / specialization (optional)
        </label>
        <input
          id="specialization"
          name="specialization"
          placeholder="e.g. Startup package"
          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm"
        />
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <label htmlFor="short_description" className="text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="short_description"
          name="short_description"
          rows={4}
          required
          placeholder="Describe what is included in this service, expected deliverables, and turnaround details."
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="price_type" className="text-sm font-medium text-slate-700">
          Price type
        </label>
        <select
          id="price_type"
          name="price_type"
          value={priceType}
          onChange={(event) => setPriceType(event.target.value as typeof priceType)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
        >
          <option value="fixed">Fixed</option>
          <option value="starting_from">Starting from</option>
          <option value="negotiable">Negotiable</option>
          <option value="request_quote">Request quote</option>
        </select>
      </div>

      {showPriceRange ? (
        <>
          <div className="space-y-1.5">
            <label htmlFor="min_price" className="text-sm font-medium text-slate-700">
              Minimum price (₦)
            </label>
            <input
              id="min_price"
              name="min_price"
              type="number"
              min={0}
              step="0.01"
              required={showPriceRange}
              placeholder="50000"
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="max_price" className="text-sm font-medium text-slate-700">
              Maximum price (₦)
            </label>
            <input
              id="max_price"
              name="max_price"
              type="number"
              min={0}
              step="0.01"
              required={priceType === "fixed"}
              placeholder={priceType === "fixed" ? "50000" : "Optional"}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm"
            />
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="min_price" value="" />
          <input type="hidden" name="max_price" value="" />
        </>
      )}

      <div className="space-y-1.5">
        <label htmlFor="turnaround_days" className="text-sm font-medium text-slate-700">
          Turnaround days (optional)
        </label>
        <input
          id="turnaround_days"
          name="turnaround_days"
          type="number"
          min={0}
          step={1}
          placeholder="7"
          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="availability_status" className="text-sm font-medium text-slate-700">
          Availability
        </label>
        <select id="availability_status" name="availability_status" defaultValue="available" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm">
          <option value="available">Available</option>
          <option value="limited">Limited</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      <input type="hidden" name="currency" value="NGN" />

      <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm md:col-span-2">
        <input type="checkbox" name="vat_applicable" value="true" className="h-4 w-4 rounded border-slate-300" />
        VAT applies to this service
      </label>

      <div className="flex items-end justify-end md:col-span-2">
        <button className="inline-flex h-11 items-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800">
          Save Service
        </button>
      </div>
    </form>
  );
}
