import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(Number(value)) ? Number(value) : 0
  );

const formatCompactCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const formatInstallments = (value) => {
  const count = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? 'prestação' : 'prestações'}`;
};

// Aceita string 'YYYY-MM-DD', ISO completo, ou um objeto Date
const toDate = (raw) => {
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string') {
    // 'YYYY-MM-DD' -> evita bug de fuso horário forçando meio-dia
    const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    return new Date(isoDateOnly ? `${raw}T12:00:00` : raw);
  }
  return null;
};

const formatDayTick = (raw) => {
  const d = toDate(raw);
  if (!d || isNaN(d)) return raw;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const formatDayFull = (raw) => {
  const d = toDate(raw);
  if (!d || isNaN(d)) return raw;
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  return `${weekday}, ${date}`;
};

function BarValueTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload || {};
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-xl border border-slate-100">
      <p className="font-bold text-slate-700 mb-1">{labelFormatter(label)}</p>
      <p className="font-semibold text-blue-600">{formatCurrency(item.valor)}</p>
      <p className="text-xs text-slate-500 mt-0.5">{formatInstallments(item.quantidade)}</p>
    </div>
  );
}

function PieValueTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload || {};
  const value = Number(item.value) || 0;
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-xl border border-slate-100">
      <p className="font-bold text-slate-700 mb-1">{item.name}</p>
      <p className="font-semibold text-slate-900">{formatCurrency(value)}</p>
      <p className="text-xs text-slate-500 mt-0.5">
        {formatInstallments(item.quantidade)} · {percentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Gráfico de Barras — Previsão de Recebimentos por dia
// ─────────────────────────────────────────────

export function BarChartVencimentos({ data, dias }) {
  // Aceita dataKey "data" (data ISO) OU "name" (fallback, retrocompatibilidade)
  const hasDateField = data?.[0]?.data !== undefined;
  const xKey = hasDateField ? 'data' : 'name';
  const tickFormatter = hasDateField ? formatDayTick : (v) => v;
  const labelFormatter = hasDateField ? formatDayFull : (v) => v;


  const showAngled = (data?.length || 0) > 8;
  const hasValues = data?.some((item) => Number(item.valor) > 0);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-900">Recebimentos a vencer</h3>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {dias ? `Próximos ${dias} dias` : 'Próximos 30 dias'}
        </span>
      </div>

      {!hasValues ? (
        <div className="h-[78%] flex items-center justify-center text-sm text-slate-500">
          Nenhum recebimento previsto para o período.
        </div>
      ) : <ResponsiveContainer width="100%" height="85%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: showAngled ? 20 : 0 }}
          barCategoryGap={data?.length > 15 ? '20%' : '35%'}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey={xKey}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickFormatter={tickFormatter}
            dy={10}
            angle={showAngled ? -35 : 0}
            textAnchor={showAngled ? 'end' : 'middle'}
            height={showAngled ? 50 : 30}
            interval={data?.length > 20 ? 'preserveStartEnd' : 0}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickFormatter={formatCompactCurrency}
            width={80}
          />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            content={<BarValueTooltip labelFormatter={labelFormatter} />}
          />
          <Bar
            dataKey="valor"
            fill="#3b82f6"
            radius={[6, 6, 0, 0]}
            barSize={hasDateField ? 24 : 40}
            activeBar={{ fill: '#2563eb' }}
          />
        </BarChart>
      </ResponsiveContainer>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Gráfico de Pizza — Status das Prestações
// ─────────────────────────────────────────────

const STATUS_COLORS = {
  'A vencer': '#fbbf24',
  Vencido: '#f87171'
};
const FALLBACK_COLORS = ['#60a5fa', '#a78bfa', '#34d399'];

export function PieChartStatus({ data, dias, overdueDays }) {
  const normalizedData = (data || []).map((item) => ({
    ...item,
    value: Math.max(0, Number(item.value) || 0),
    quantidade: Math.max(0, Number(item.quantidade) || 0),
  }));
  const total = normalizedData.reduce((sum, item) => sum + item.value, 0);
  const getColor = (entry, index) =>
    STATUS_COLORS[entry.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 h-[400px]">
      <div className="mb-3">
        <h3 className="text-xl font-bold text-slate-900">Valores em aberto</h3>
        <p className="text-xs text-slate-500 mt-1">
          Vencidos em {overdueDays || 365} dias + próximos {dias || 30} dias
        </p>
      </div>

      <div className="relative h-[80%]">
        {total <= 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">
            Nenhum valor em aberto para o período.
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={normalizedData}
              cx="50%"
              cy="45%"
              innerRadius={80}
              outerRadius={120}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {normalizedData.map((entry, index) => (
                <Cell key={entry.name || `cell-${index}`} fill={getColor(entry, index)} />
              ))}
            </Pie>
            <Tooltip content={<PieValueTooltip total={total} />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              formatter={(value) => (
                <span className="text-slate-600 font-medium ml-1">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        )}

      </div>
    </div>
  );
}
