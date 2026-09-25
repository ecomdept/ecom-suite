type TrendPoint = {
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  usedHours: number;
  unusedHours: number;
  rolloverHours: number;
};

function points(values: number[], max: number, width: number, height: number, top: number) {
  return values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * width},${top + height - (value / max) * height}`).join(" ");
}

export function MonthlyTrendCharts({ trends }: { trends: TrendPoint[] }) {
  const width = 680;
  const height = 150;
  const top = 12;
  const moneyMax = Math.max(1, ...trends.flatMap((point) => [point.revenue, point.cost, point.profit]));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="financial-trend-heading">
        <div><h2 className="font-semibold" id="financial-trend-heading">Financial trend</h2><p className="mt-1 text-sm text-slate-500">Recognized revenue, delivery cost, and estimated gross profit by calendar month.</p></div>
        <div className="mt-6 overflow-x-auto"><svg aria-label="Financial trend line chart" className="min-w-[620px]" role="img" viewBox={`0 0 ${width} 210`}><line stroke="#e7e5e4" x1="0" x2={width} y1={top + height} y2={top + height} />
          <polyline fill="none" points={points(trends.map((point) => point.revenue), moneyMax, width, height, top)} stroke="#f00073" strokeWidth="4" />
          <polyline fill="none" points={points(trends.map((point) => point.cost), moneyMax, width, height, top)} stroke="#94a3b8" strokeWidth="3" />
          <polyline fill="none" points={trends.map((point, index) => `${(index / Math.max(1, trends.length - 1)) * width},${top + height - (Math.max(0, point.profit) / moneyMax) * height}`).join(" ")} stroke="#10b981" strokeWidth="3" />
          {trends.map((point, index) => <text fill="#78716c" fontSize="11" key={point.label} textAnchor={index === 0 ? "start" : index === trends.length - 1 ? "end" : "middle"} x={(index / Math.max(1, trends.length - 1)) * width} y="195">{point.label}</text>)}
        </svg></div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-pink-600" />Revenue</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-slate-400" />Labor cost</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-emerald-500" />Gross profit</span></div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="capacity-trend-heading">
        <div><h2 className="font-semibold" id="capacity-trend-heading">Retainer capacity trend</h2><p className="mt-1 text-sm text-slate-500">Used, unused, and eligible rollover hours across the portfolio.</p></div>
        <div className="mt-7 flex h-[170px] min-w-[520px] items-end justify-around gap-4 overflow-hidden border-b border-stone-200 px-2">
          {trends.map((point) => { const total = Math.max(1, point.usedHours + point.unusedHours); return <div className="flex h-full flex-1 flex-col items-center justify-end" key={point.label}><div className="flex w-full max-w-12 flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${Math.max(5, Math.min(100, (total / Math.max(...trends.map((item) => item.usedHours + item.unusedHours), 1)) * 100))}%` }}><span className="bg-pink-600" style={{ height: `${(point.usedHours / total) * 100}%` }} /><span className="bg-stone-200" style={{ height: `${(point.unusedHours / total) * 100}%` }} /></div><span className="mt-2 text-[10px] text-slate-500">{point.label}</span></div>; })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-pink-600" />Used</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-stone-200" />Unused</span><span>Current eligible rollover: {trends.at(-1)?.rolloverHours.toFixed(1) ?? "0.0"}h</span></div>
      </section>
    </div>
  );
}
