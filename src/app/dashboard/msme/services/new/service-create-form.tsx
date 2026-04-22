"use client";

import { useMemo, useState } from "react";

type ServiceCreateFormProps = {
  categories: string[];
  createAction: (formData: FormData) => Promise<void>;
};

export function ServiceCreateForm({ categories, createAction }: ServiceCreateFormProps) {
  const [priceType, setPriceType] = useState<"fixed" | "starting_from" | "negotiable" | "request_quote">("fixed");
  const showPriceAmount = useMemo(() => priceType === "fixed" || priceType === "starting_from", [priceType]);

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

      {showPriceAmount ? (
        <div className="space-y-1.5">
          <label htmlFor="price_amount" className="text-sm font-medium text-slate-700">
            Price amount (₦)
          </label>
          <input
            id="price_amount"
            name="price_amount"
            type="number"
            min={0}
            step="0.01"
            required={showPriceAmount}
            placeholder="50000"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm"
          />
        </div>
      ) : (
        <input type="hidden" name="price_amount" value="" />
      )}

      <div className="space-y-1.5">
        <label htmlFor="availability_status" className="text-sm font-medium text-slate-700">
          Availability / status
        </label>
        <select
          id="availability_status"
          name="availability_status"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
          defaultValue="available"
        >
          <option value="available">Available</option>
          <option value="limited">Limited</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="turnaround_time" className="text-sm font-medium text-slate-700">
          Turnaround time (optional)
        </label>
        <input
          id="turnaround_time"
          name="turnaround_time"
          placeholder="e.g. 3-5 business days"
          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="vat_applicable" className="text-sm font-medium text-slate-700">
          VAT
        </label>
        <select id="vat_applicable" name="vat_applicable" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm">
          <option value="false">VAT not applicable</option>
          <option value="true">VAT applicable</option>
        </select>
      </div>

      <div className="flex items-end justify-end md:col-span-2">
        <button className="inline-flex h-11 items-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800">
          Save Service
        </button>
      </div>
    </form>
  );
}
