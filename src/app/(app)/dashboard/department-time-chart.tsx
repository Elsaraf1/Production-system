"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";

interface Props {
  data: Array<{ department: string; avgDays: number | null; count: number }>;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { department: string; value: number; count: number } }> }) {
  if (!active || !payload?.length) return null;
  const { department, value, count } = payload[0].payload;
  return (
    <div className="rounded border bg-white px-2 py-1 text-xs shadow">
      <p className="font-medium">{department}</p>
      <p>{count > 0 ? `${value} days` : "No data yet"} ({count} item{count === 1 ? "" : "s"})</p>
    </div>
  );
}

export function DepartmentTimeChart({ data }: Props) {
  const chartData = data.map(d => ({ ...d, value: d.avgDays ?? 0 }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 16, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="department" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} label={{ value: "days", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" fill="#93c5fd" name="Avg days" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="value" position="top" fontSize={11} formatter={(value) => (Number(value) > 0 ? `${value}d` : "—")} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
