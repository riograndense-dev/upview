import React from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

export default function DataTable({
    columns,
    data,
    title,
    onSearch,
    searchValue = '',
    loading,
    onRowClick,
    page = 1,
    pageSize = 50,
    hasNext = false,
    onPageChange,
    extraActions,
}) {
    const start = data.length ? (page - 1) * pageSize + 1 : 0;
    const end = start ? start + data.length - 1 : 0;

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                <div className="flex flex-wrap items-center justify-end gap-4">
                    {onSearch && (
                        <div className="relative w-full sm:w-72">
                            <Search size={16} className="absolute inset-y-0 left-3 my-auto text-slate-400" />
                            <input
                                type="search"
                                value={searchValue}
                                maxLength={120}
                                className="block w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-white text-slate-900 font-medium"
                                placeholder="Buscar..."
                                onChange={(event) => onSearch(event.target.value)}
                            />
                        </div>
                    )}
                    {extraActions}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900 text-white border-b-2 border-slate-900">
                            {columns.map((column) => (
                                <th
                                    key={column.header}
                                    className={`px-3 py-3 sm:px-4 sm:py-3.5 text-xs font-bold uppercase tracking-wider text-slate-100 ${column.headerClassName || ''} ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                                    Carregando dados...
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                                    Nenhum registro encontrado.
                                </td>
                            </tr>
                        ) : (
                            data.map((row, index) => (
                                <tr
                                    key={`${row.CODFILIAL ?? 'sem-filial'}-${row.DUPLIC ?? row.CODCLI ?? 'registro'}-${row.PREST ?? 'sem-prest'}-${index}`}
                                    onClick={() => onRowClick?.(row)}
                                    className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-100' : 'hover:bg-slate-50'}`}
                                >
                                    {columns.map((column) => (
                                        <td
                                            key={column.header}
                                            className={`px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium text-slate-700 ${column.className || 'whitespace-nowrap'} ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}
                                        >
                                            {column.render ? column.render(row) : row[column.accessor] ?? '-'}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {onPageChange && !loading && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                    <span>{start ? `Registros ${start}–${end}` : 'Sem registros nesta página'}</span>
                    <div className="flex items-center gap-2">
                        <button type="button" aria-label="Página anterior" onClick={() => onPageChange(page - 1)} disabled={page === 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-50"><ChevronLeft size={16} /></button>
                        <span className="px-2 font-medium">Página {page}</span>
                        <button type="button" aria-label="Próxima página" onClick={() => onPageChange(page + 1)} disabled={!hasNext} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-50"><ChevronRight size={16} /></button>
                    </div>
                </div>
            )}
        </div>
    );
}
