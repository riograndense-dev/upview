import { useEffect, useState } from 'react';
import { Search, X, Users } from 'lucide-react';
import { listPrestacoesByVendedor, getVendedor } from '../api/apiService';

const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatDate = (value) =>
    value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';

function getStatus(p) {
    if (p.DTBAIXA) return 'Pago';
    if (p.DTVENC && new Date(`${p.DTVENC.slice(0, 10)}T12:00:00`) < new Date(new Date().setHours(0, 0, 0, 0))) return 'Vencido';
    return 'A vencer';
}

const STATUS_BADGE = {
    Pago: 'bg-emerald-100 text-emerald-700',
    Vencido: 'bg-rose-100 text-rose-700',
    'A vencer': 'bg-amber-100 text-amber-700',
};

const WINDOW_DIAS = 30;
const MAX_LIMIT = 200;

function PrestacoesSection({ title, data, emptyMessage }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h4>
                <span className="text-xs font-semibold text-slate-500">{data.length} registro(s)</span>
            </div>

            {data.length === 0 ? (
                <p className="text-sm text-slate-400 italic bg-slate-50 rounded-xl p-4 border border-slate-100">{emptyMessage}</p>
            ) : (
                <div
                    className="overflow-x-auto overflow-y-auto max-h-60 rounded-xl border border-slate-200
                   [&::-webkit-scrollbar]:w-1.5
                   [&::-webkit-scrollbar-track]:bg-slate-50
                   [&::-webkit-scrollbar-thumb]:bg-slate-300
                   [&::-webkit-scrollbar-thumb]:rounded-full
                   [&::-webkit-scrollbar-thumb:hover]:bg-slate-400"
                >
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-50 z-10">
                            <tr className="text-slate-500">
                                <th className="px-4 py-2 font-semibold">Duplicata</th>
                                <th className="px-4 py-2 font-semibold">Cliente</th>
                                <th className="px-4 py-2 font-semibold">Valor</th>
                                <th className="px-4 py-2 font-semibold">Vencimento</th>
                                <th className="px-4 py-2 font-semibold">Cód. cobrança</th>
                                <th className="px-4 py-2 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.map((p) => {
                                const s = getStatus(p);
                                return (
                                    <tr key={`${p.DUPLIC}-${p.CODFILIAL ?? ''}`}>
                                        <td className="px-4 py-2 text-slate-700 font-medium">{p.DUPLIC}</td>
                                        <td className="px-4 py-2 text-slate-700 truncate max-w-[200px]" title={p.CLIENTE || ''}>
                                            {p.CLIENTE || '—'}
                                        </td>
                                        <td className="px-4 py-2 font-semibold text-slate-800">{formatCurrency(p.VALOR)}</td>
                                        <td className="px-4 py-2 text-slate-700">{formatDate(p.DTVENC)}</td>
                                        <td className="px-4 py-2 text-slate-700">{p.CODCOB || '—'}</td>
                                        <td className="px-4 py-2">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[s]}`}>{s}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default function VendedorModal({ isOpen, onClose, vendedor }) {
    const codusur = vendedor?.CODUSUR;
    const propNome = vendedor?.NOME;

    const [vendedorName, setVendedorName] = useState('');
    const [prestacoes, setPrestacoes] = useState([]);
    const [prestacoesLoading, setPrestacoesLoading] = useState(false);
    const [prestacoesError, setPrestacoesError] = useState('');
    const [search, setSearch] = useState('');

    // Os hooks devem ser chamados incondicionalmente (regra oxlint react/rules-of-hooks),
    // por isso este useEffect vai antes do early-return do modal.
    useEffect(() => {
        if (!isOpen || !codusur) {
            setPrestacoes([]);
            setVendedorName('');
            setPrestacoesError('');
            setSearch('');
            return;
        }

        const controller = new AbortController();
        setPrestacoesLoading(true);
        setPrestacoesError('');

        (async () => {
            try {
                if (!propNome) {
                    const vendedorData = await getVendedor(codusur, { signal: controller.signal });
                    if (!controller.signal.aborted && vendedorData?.NOME) {
                        setVendedorName(vendedorData.NOME);
                    }
                }
                const data = await listPrestacoesByVendedor(
                    codusur,
                    { dias_passados: WINDOW_DIAS, dias_futuros: WINDOW_DIAS, limit: MAX_LIMIT },
                    { signal: controller.signal },
                );
                if (!controller.signal.aborted) {
                    setPrestacoes(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    setPrestacoesError('Não foi possível carregar as prestações do vendedor.');
                }
            } finally {
                if (!controller.signal.aborted) {
                    setPrestacoesLoading(false);
                }
            }
        })();

        return () => controller.abort();
    }, [isOpen, codusur, propNome]);

    if (!isOpen || !codusur) return null;

    const displayNome = propNome || vendedorName || `Vendedor #${codusur}`;

    // Filtro de pesquisa (por nome do cliente ou número da duplicata)
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    const filteredPrestacoes = normalizedSearch
        ? prestacoes.filter((p) =>
            `${p.CLIENTE ?? ''} ${p.DUPLIC ?? ''}`
                .toLocaleLowerCase('pt-BR')
                .includes(normalizedSearch)
        )
        : prestacoes;

    const aReceber = filteredPrestacoes.filter((p) => getStatus(p) === 'A vencer');
    const vencidas = filteredPrestacoes.filter((p) => getStatus(p) === 'Vencido');

    const totalAReceber = aReceber.reduce((sum, p) => sum + Number(p.VALOR || 0), 0);
    const totalVencidas = vencidas.reduce((sum, p) => sum + Number(p.VALOR || 0), 0);
    const totalGeral = totalAReceber + totalVencidas;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-slate-900 p-6 flex justify-between items-start text-white relative overflow-hidden shrink-0">
                    <div className="absolute -right-10 -top-10 opacity-10">
                        <Users size={150} />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="bg-blue-500/20 text-blue-200 text-xs font-bold px-3 py-1 rounded-full border border-blue-400/30">
                                Cód: {codusur}
                            </span>
                        </div>
                        <h2 className="text-2xl font-extrabold tracking-tight">{displayNome}</h2>
                        <p className="text-slate-400 text-sm mt-0.5">Prestações a receber e vencidas</p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="relative z-10 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
                    {prestacoesError && (
                        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800 text-sm font-medium">
                            {prestacoesError}
                        </p>
                    )}

                    {/* Campo de pesquisa */}
                    <div className="relative">
                        <Search size={16} className="absolute inset-y-0 left-3 my-auto text-slate-400" />
                        <input
                            type="search"
                            value={search}
                            maxLength={120}
                            className="block w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-white text-slate-900 font-medium"
                            placeholder="Buscar por cliente ou duplicata..."
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Resumo */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Totais em aberto:</span>
                        <div className="flex flex-wrap gap-4 text-xs font-semibold">
                            <span className="text-slate-600">
                                A receber: <span className="text-amber-600 font-bold">{formatCurrency(totalAReceber)}</span>
                                <span className="text-slate-400 font-normal ml-1">({aReceber.length})</span>
                            </span>
                            <span className="text-slate-600">
                                Vencidas: <span className="text-rose-600 font-bold">{formatCurrency(totalVencidas)}</span>
                                <span className="text-slate-400 font-normal ml-1">({vencidas.length})</span>
                            </span>
                            <span className="text-slate-600 border-l border-slate-200 pl-4">
                                Total: <span className="text-blue-600 font-bold">{formatCurrency(totalGeral)}</span>
                                <span className="text-slate-400 font-normal ml-1">({aReceber.length + vencidas.length})</span>
                            </span>
                        </div>
                    </div>

                    {prestacoesLoading ? (
                        <div className="py-12 text-center text-slate-400">Carregando prestações do vendedor...</div>
                    ) : (
                        <div className="space-y-6">
                            <PrestacoesSection
                                title="Prestações a Receber (A Vencer)"
                                data={aReceber}
                                emptyMessage="Nenhuma prestação a vencer nos próximos 30 dias."
                            />
                            <PrestacoesSection
                                title="Prestações Vencidas"
                                data={vencidas}
                                emptyMessage="Nenhuma prestação vencida nos últimos 30 dias."
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 text-sm"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
