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
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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

  return (
    <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-900">Previsão de Recebimentos</h3>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {dias ? `Próximos ${dias} dias` : 'Próximos 30 dias'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height="85%">
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
            tickFormatter={(value) => `R$ ${value / 1000}k`}
          />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
            }}
            formatter={(value) => [formatCurrency(value), 'Valor']}
            labelFormatter={labelFormatter}
            labelStyle={{ color: '#475569', fontWeight: 'bold', marginBottom: '4px' }}
          />
          <Bar
            dataKey="valor"
            fill="#3b82f6"
            radius={[6, 6, 0, 0]}
            barSize={hasDateField ? 24 : 40}
            activeBar={{ fill: '#2563eb' }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// Gráfico de Pizza — Status das Prestações
// ─────────────────────────────────────────────

const STATUS_COLORS = {
  Pago: '#34d399',
  'A Vencer': '#fbbf24',
  Vencido: '#f87171'
};
const FALLBACK_COLORS = ['#34d399', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa'];

export function PieChartStatus({ data }) {
  const getColor = (entry, index) =>
    STATUS_COLORS[entry.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 h-[400px]">
      <h3 className="text-xl font-bold text-slate-900 mb-6">Status das Prestações</h3>

      <div className="relative h-[85%]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={80}
              outerRadius={120}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry, index)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatCurrency(value), 'Valor']}
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
              }}
            />
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

      </div>
    </div>
  );
}
