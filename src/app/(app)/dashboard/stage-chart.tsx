"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Props {
  data: Array<{ name: string; PENDING: number; IN_PROGRESS: number; DONE: number; NA: number }>;
}

export function StageChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="PENDING"     stackId="a" fill="#d1d5db" name="Pending" />
        <Bar dataKey="IN_PROGRESS" stackId="a" fill="#93c5fd" name="In Progress" />
        <Bar dataKey="DONE"        stackId="a" fill="#86efac" name="Done" />
        <Bar dataKey="NA"          stackId="a" fill="#e5e7eb" name="N/A" />
      </BarChart>
    </ResponsiveContainer>
  );
}
