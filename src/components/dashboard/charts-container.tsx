"use client";

import { Bar, BarChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Legend } from "recharts";

const palette = ["#0f766e", "#0284c7", "#f59e0b", "#8b5cf6", "#ef4444", "#10b981"];

export function ChartsContainer({
  stateData,
  sectorData,
}: {
  stateData: { state: string; totalMsmes: number }[];
  sectorData: { sector: string; totalMsmes: number }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-80 rounded-lg border bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">State distribution</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stateData}>
            <XAxis dataKey="state" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="totalMsmes" fill="#0f172a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-80 rounded-lg border bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Sector distribution</h3>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={sectorData} dataKey="totalMsmes" nameKey="sector" outerRadius={100} label>
              {sectorData.map((_, index) => (
                <Cell key={index} fill={palette[index % palette.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
