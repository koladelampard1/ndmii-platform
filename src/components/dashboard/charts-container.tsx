"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ChartsContainer({ data }: { data: { month: string; registrations: number; complaints: number }[] }) {
  return (
    <div className="h-80 rounded-lg border bg-white p-4">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">Monthly Registrations vs Complaints</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="registrations" fill="#0f172a" />
          <Bar dataKey="complaints" fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
