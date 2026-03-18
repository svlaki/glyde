import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { ColorPalette } from '../../styles/colors'

interface ChartProps {
  data: any[]
  colors: ColorPalette
  height?: number
}

const chartMargin = { top: 8, right: 16, left: 0, bottom: 0 }

function ThemedTooltipStyle(colors: ColorPalette): React.CSSProperties {
  return {
    background: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    color: colors.textPrimary,
    fontSize: '12px',
    padding: '8px 12px',
  }
}

function formatDate(dateStr: any): string {
  const s = String(dateStr)
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatNumber(n: any): string {
  const v = Number(n)
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K'
  return String(v)
}

/** Area chart for single-metric trends (e.g. DAU over time) */
export function ThemedAreaChart({
  data,
  colors,
  height = 240,
  dataKey = 'value',
  xKey = 'date',
  label,
}: ChartProps & { dataKey?: string; xKey?: string; label?: string }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={chartMargin}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.accent} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
          <XAxis dataKey={xKey} tick={{ fill: colors.textSecondary, fontSize: 11 }} tickFormatter={formatDate} />
          <YAxis tick={{ fill: colors.textSecondary, fontSize: 11 }} tickFormatter={formatNumber} />
          <Tooltip contentStyle={ThemedTooltipStyle(colors)} labelFormatter={formatDate} formatter={(v: any) => [formatNumber(v), label || dataKey]} />
          <Area type="monotone" dataKey={dataKey} stroke={colors.accent} fill={`url(#grad-${dataKey})`} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Stacked area chart for multi-series (e.g. input vs output tokens) */
export function ThemedStackedAreaChart({
  data,
  colors,
  height = 240,
  areas,
  xKey = 'date',
}: ChartProps & { areas: { dataKey: string; color: string; label: string }[]; xKey?: string }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={chartMargin}>
          <defs>
            {areas.map((a) => (
              <linearGradient key={a.dataKey} id={`grad-${a.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={a.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={a.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
          <XAxis dataKey={xKey} tick={{ fill: colors.textSecondary, fontSize: 11 }} tickFormatter={formatDate} />
          <YAxis tick={{ fill: colors.textSecondary, fontSize: 11 }} tickFormatter={formatNumber} />
          <Tooltip contentStyle={ThemedTooltipStyle(colors)} labelFormatter={formatDate} formatter={(v: any, name: any) => {
            const area = areas.find(a => a.dataKey === name)
            return [formatNumber(v), area?.label || name]
          }} />
          <Legend formatter={(value: any) => {
            const area = areas.find(a => a.dataKey === value)
            return area?.label || value
          }} />
          {areas.map((a) => (
            <Area key={a.dataKey} type="monotone" dataKey={a.dataKey} stackId="1" stroke={a.color} fill={`url(#grad-${a.dataKey})`} strokeWidth={2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Horizontal bar chart for comparisons (page views by path, top users) */
export function ThemedBarChart({
  data,
  colors,
  height = 300,
  dataKey = 'value',
  nameKey = 'name',
  label,
  barColor,
}: ChartProps & { dataKey?: string; nameKey?: string; label?: string; barColor?: string }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ ...chartMargin, left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
          <XAxis type="number" tick={{ fill: colors.textSecondary, fontSize: 11 }} tickFormatter={formatNumber} />
          <YAxis type="category" dataKey={nameKey} tick={{ fill: colors.textSecondary, fontSize: 11 }} width={80} />
          <Tooltip contentStyle={ThemedTooltipStyle(colors)} formatter={(v: any) => [formatNumber(v), label || dataKey]} />
          <Bar dataKey={dataKey} fill={barColor || colors.accent} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Multi-line chart for trends (responded vs dismissed) */
export function ThemedLineChart({
  data,
  colors,
  height = 240,
  lines,
  xKey = 'date',
}: ChartProps & { lines: { dataKey: string; color: string; label: string }[]; xKey?: string }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
          <XAxis dataKey={xKey} tick={{ fill: colors.textSecondary, fontSize: 11 }} tickFormatter={formatDate} />
          <YAxis tick={{ fill: colors.textSecondary, fontSize: 11 }} tickFormatter={formatNumber} />
          <Tooltip contentStyle={ThemedTooltipStyle(colors)} labelFormatter={formatDate} formatter={(v: any, name: any) => {
            const line = lines.find(l => l.dataKey === name)
            return [formatNumber(v), line?.label || name]
          }} />
          <Legend formatter={(value: any) => {
            const line = lines.find(l => l.dataKey === value)
            return line?.label || value
          }} />
          {lines.map((l) => (
            <Line key={l.dataKey} type="monotone" dataKey={l.dataKey} stroke={l.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Pie/donut chart for ratios (responded vs dismissed) */
export function ThemedPieChart({
  data,
  colors,
  height = 200,
  pieColors,
}: ChartProps & { pieColors: string[] }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
          >
            {data.map((_: any, idx: number) => (
              <Cell key={idx} fill={pieColors[idx % pieColors.length] || '#888'} />
            ))}
          </Pie>
          <Tooltip contentStyle={ThemedTooltipStyle(colors)} formatter={(v: any) => [formatNumber(v)]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Vertical bar chart for retention rates */
export function ThemedRetentionBarChart({
  data,
  colors,
  height = 200,
}: ChartProps) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
          <XAxis dataKey="label" tick={{ fill: colors.textSecondary, fontSize: 11 }} />
          <YAxis tick={{ fill: colors.textSecondary, fontSize: 11 }} domain={[0, 100]} tickFormatter={(v: any) => `${v}%`} />
          <Tooltip contentStyle={ThemedTooltipStyle(colors)} formatter={(v: any) => [`${v}%`, 'Retention Rate']} />
          <Bar dataKey="rate" fill={colors.accent} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
