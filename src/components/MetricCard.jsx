import React from 'react';

export default function MetricCard({ title, value, icon: Icon, trend, trendValue, colorClass }) {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1">
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</p>
                    <h3 className="text-3xl font-extrabold text-slate-900">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${colorClass}`}>
                    <Icon size={24} strokeWidth={1.5} />
                </div>
            </div>
            
            {(trend || trendValue) && (
                <div className="flex items-center text-sm">
                    {trend === 'up' && <span className="text-emerald-500 font-medium flex items-center">↑ {trendValue}</span>}
                    {trend === 'down' && <span className="text-rose-500 font-medium flex items-center">↓ {trendValue}</span>}
                    {trend === 'neutral' && <span className="text-slate-500 font-medium flex items-center">- {trendValue}</span>}
                    <span className="text-slate-400 ml-2">vs último mês</span>
                </div>
            )}
        </div>
    );
}
