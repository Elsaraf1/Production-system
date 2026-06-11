export function ProductionOrderCell({ value }: { value: string }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  if (value.trim().toLowerCase() === "inventored") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-green-100 text-green-700 border-green-200">
        {value}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{value}</span>;
}
