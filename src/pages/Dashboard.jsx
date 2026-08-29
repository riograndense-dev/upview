import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowDownWideNarrow, ArrowUpNarrowWide, BarChart3, CalendarX, DollarSign, FileText, LogOut, Pencil, UserCheck, Users } from 'lucide-react';

import * as apiService from '../api/apiService';
import { BarChartVencimentos, PieChartStatus } from '../components/Charts';
import ClientModal from '../components/ClientModal';
import DataTable from '../components/DataTable';
import MetricCard from '../components/MetricCard';
import PrestacaoModal from '../components/PrestacaoModal';
import VendedorModal from '../components/VendedorModal';
import { useAuth } from '../hooks/useAuth';

const PAGE_SIZE = 50;

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const formatDate = (value) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '-';

function getStatus(prestacao) {
    if (prestacao.DTBAIXA) return 'Pago';
    if (prestacao.DTVENC && new Date(`${prestacao.DTVENC.slice(0, 10)}T12:00:00`) < new Date(new Date().setHours(0, 0, 0, 0))) return 'Vencido';
    return 'A vencer';
}

// Dias de atraso de uma prestação (0 para não vencidas ou sem data de vencimento)
function diasAtraso(prestacao) {
    if (!prestacao?.DTVENC) return 0;
    const hoje = new Date(new Date().setHours(0, 0, 0, 0));
    const vencimento = new Date(`${prestacao.DTVENC.slice(0, 10)}T12:00:00`);
    const atraso = Math.round((hoje - vencimento) / 86400000);
    return atraso > 0 ? atraso : 0;
}

export default function Dashboard() {
    const { logout } = useAuth();
    const [view, setView] = useState('visao-geral');

    // Visão geral
    const [diasPrevisao, setDiasPrevisao] = useState(30);
    const [diasInput, setDiasInput] = useState('30'); // string para o input
    const [overview, setOverview] = useState([]);
    const [chartBarData, setChartBarData] = useState([]);
    const [totalReceber, setTotalReceber] = useState(0);
    const [overviewLoading, setOverviewLoading] = useState(true);

    // Clientes
    const [clients, setClients] = useState([]);
    const [clientsLoading, setClientsLoading] = useState(true);
    const [clientsPage, setClientsPage] = useState(1);
    const [clientsHasNext, setClientsHasNext] = useState(false);
    const [clientSearch, setClientSearch] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);

    // Prestações
    const [prestacoes, setPrestacoes] = useState([]);
    const [prestacoesLoading, setPrestacoesLoading] = useState(true);
    const [prestacoesPage, setPrestacoesPage] = useState(1);
    const [prestacoesHasNext, setPrestacoesHasNext] = useState(false);
    const [prestacaoSearch, setPrestacaoSearch] = useState('');
    const [prestacaoEmissao, setPrestacaoEmissao] = useState('');
    const [prestacaoVenc, setPrestacaoVenc] = useState('');
    // Filtro de prestações vencidas: '' (desligado) | 'mais-vencidas' | 'menos-vencidas'
    const [prestacaoVencidas, setPrestacaoVencidas] = useState('');
    const [selectedPrestacao, setSelectedPrestacao] = useState(null);

    // Vendedores
    const [vendedores, setVendedores] = useState([]);
    const [vendedoresLoading, setVendedoresLoading] = useState(true);
    const [vendedoresPage, setVendedoresPage] = useState(1);
    const [vendedorSearch, setVendedorSearch] = useState('');
    const [selectedVendedor, setSelectedVendedor] = useState(null);

    // Edição de observação
    const [editingPrestacao, setEditingPrestacao] = useState(null);
    const [observacao, setObservacao] = useState('');
    const [savingObservation, setSavingObservation] = useState(false);

    const [error, setError] = useState('');

    // ── Overview ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const controller = new AbortController();

        async function loadOverview() {
            setOverviewLoading(true);
            setError('');
            try {
                // O backend já agrega o total por dia via /prestacoes/a-vencer/por-dia,
                // eliminando a necessidade de paginar todas as prestações e somar no cliente.
                const [porDia, vencidas, aVencerSample] = await Promise.all([
                    apiService.listPrestacoesAVencerPorDia({ dias: diasPrevisao }, { signal: controller.signal }),
                    apiService.listPrestacoesVencidas({ dias: 30, limit: 200 }, { signal: controller.signal }),
                    apiService.listPrestacoesAVencer({ dias: diasPrevisao, limit: 200 }, { signal: controller.signal }),
                ]);
                if (controller.signal.aborted) return;

                // Converte { DTVENC, total, quantidade } → { data, valor } para o gráfico
                setChartBarData(porDia.map((p) => ({ data: p.DTVENC, valor: Number(p.total || 0) })));

                // Pie chart: amostra de vencidas + a-vencer
                setOverview([...vencidas, ...aVencerSample]);

                // Total a receber exato: agregação do backend + vencidas da amostra
                const aVencerTotal = porDia.reduce((sum, p) => sum + Number(p.total || 0), 0);
                const vencidasTotal = vencidas.reduce((sum, p) => sum + Number(p.VALOR || 0), 0);
                setTotalReceber(aVencerTotal + vencidasTotal);
            } catch (requestError) {
                if (requestError.name !== 'AbortError') setError('Não foi possível carregar a visão geral.');
            } finally {
                if (!controller.signal.aborted) setOverviewLoading(false);
            }
        }

        loadOverview();
        return () => controller.abort();
    }, [diasPrevisao]);

    // ── Clientes ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setClientsLoading(true);
            try {
                const result = await apiService.listClients(
                    { search: clientSearch, limit: PAGE_SIZE + 1, offset: (clientsPage - 1) * PAGE_SIZE },
                    { signal: controller.signal },
                );
                setClients(result.slice(0, PAGE_SIZE));
                setClientsHasNext(result.length > PAGE_SIZE);
            } catch (requestError) {
                if (requestError.name !== 'AbortError') setError('Não foi possível carregar os clientes.');
            } finally {
                if (!controller.signal.aborted) setClientsLoading(false);
            }
        }, 300);
        return () => { controller.abort(); clearTimeout(timer); };
    }, [clientSearch, clientsPage]);

    // ── Prestações (busca no backend via parâmetro `search`) ────────────────
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setPrestacoesLoading(true);
            try {
                // O backend espera datas no formato AAAA-MM-DD (ex: 2025-03-15)
                const toApiDate = (iso) => {
                    if (!iso) return null;
                    const [y, m, d] = iso.split('-');
                    return y && m && d ? `${y}-${m}-${d}` : null;
                };
                // Filtro de vencidas ativo → busca o lote completo (até 200) e
                // ordena/pagina no cliente, pois a API não expõe ordenação.
                const vencidasAtivo = prestacaoVencidas !== '';

                const result = await apiService.listPrestacoes({
                    dias_passados: 30,
                    dias_futuros: vencidasAtivo ? 0 : 30,
                    search: prestacaoSearch,
                    emissao: toApiDate(prestacaoEmissao),
                    venc: toApiDate(prestacaoVenc),
                    ...(vencidasAtivo
                        ? { limit: 200 }
                        : { limit: PAGE_SIZE + 1, offset: (prestacoesPage - 1) * PAGE_SIZE }),
                }, { signal: controller.signal });

                if (vencidasAtivo) {
                    // Mantém apenas as vencidas em aberto e ordena por dias de atraso
                    const vencidas = (Array.isArray(result) ? result : []).filter((p) => !p.DTBAIXA && diasAtraso(p) > 0);
                    vencidas.sort((a, b) =>
                        prestacaoVencidas === 'mais-vencidas'
                            ? diasAtraso(b) - diasAtraso(a)
                            : diasAtraso(a) - diasAtraso(b)
                    );
                    setPrestacoes(vencidas.slice((prestacoesPage - 1) * PAGE_SIZE, prestacoesPage * PAGE_SIZE));
                    setPrestacoesHasNext(vencidas.length > prestacoesPage * PAGE_SIZE);
                } else {
                    setPrestacoes(result.slice(0, PAGE_SIZE));
                    setPrestacoesHasNext(result.length > PAGE_SIZE);
                }
            } catch (requestError) {
                if (requestError.name !== 'AbortError') setError('Não foi possível carregar as prestações.');
            } finally {
                if (!controller.signal.aborted) setPrestacoesLoading(false);
            }
        }, 300);
        return () => { controller.abort(); clearTimeout(timer); };
    }, [prestacaoSearch, prestacaoEmissao, prestacaoVenc, prestacoesPage, prestacaoVencidas]);

    // ── Vendedores ──────────────────────────────────────────────────────────────
    // Carrega a lista completa de vendedores (até 200). O mapa codusur → nome
    // alimenta a coluna de prestações; a lista alimenta a aba de Vendedores.
    useEffect(() => {
        const controller = new AbortController();
        setVendedoresLoading(true);
        apiService.listVendedores({ limit: 200 }, { signal: controller.signal })
            .then((data) => {
                if (controller.signal.aborted) return;
                setVendedores(Array.isArray(data) ? data : []);
            })
            .catch(() => setVendedores([]))
            .finally(() => {
                if (!controller.signal.aborted) setVendedoresLoading(false);
            });
        return () => controller.abort();
    }, []);

    // ── Métricas ──────────────────────────────────────────────────────────────
    const metrics = overview.reduce((accumulator, prestacao) => {
        const value = Number(prestacao.VALOR || 0);
        if (getStatus(prestacao) === 'Vencido') accumulator.totalVencido += value;
        accumulator.totalPrestacoes += 1;
        return accumulator;
    }, { totalVencido: 0, totalPrestacoes: 0 });

    const chartPie = overview.reduce((accumulator, prestacao) => {
        const value = Number(prestacao.VALOR || 0);
        const status = getStatus(prestacao);
        accumulator[status] = (accumulator[status] || 0) + value;
        return accumulator;
    }, {});

    // ── Salvar observação ─────────────────────────────────────────────────────
    async function saveObservation(event) {
        event.preventDefault();
        const normalized = observacao.trim();
        if (!normalized || !editingPrestacao) return;
        setSavingObservation(true);
        try {
            const updated = await apiService.updatePrestacaoObservacao(
                editingPrestacao.DUPLIC,
                normalized,
                editingPrestacao.PREST ?? null
            );
            setPrestacoes((current) => current.map((item) =>
                item.DUPLIC === updated.DUPLIC && (item.PREST == null || item.PREST === updated.PREST)
                    ? updated
                    : item
            ));
            // Atualiza também o modal de detalhes se estiver aberto na mesma prestação
            if (
                selectedPrestacao &&
                selectedPrestacao.DUPLIC === updated.DUPLIC &&
                (selectedPrestacao.PREST == null || selectedPrestacao.PREST === updated.PREST)
            ) {
                setSelectedPrestacao(updated);
            }
            setEditingPrestacao(null);
        } catch {
            setError('Não foi possível salvar a observação.');
        } finally {
            setSavingObservation(false);
        }
    }

    function handleEditObservacao(prestacao) {
        setEditingPrestacao(prestacao);
        setObservacao(prestacao.OBS || '');
    }

    // ── Colunas ───────────────────────────────────────────────────────────────
    const clientsColumns = [
        { header: 'Código', accessor: 'CODCLI', className: 'whitespace-nowrap font-medium' },
        { header: 'Cliente', accessor: 'CLIENTE', className: 'truncate max-w-[220px]' },
        { header: 'Município', accessor: 'MUNICENT', className: 'whitespace-nowrap text-slate-600' },
        { header: 'Telefone', accessor: 'TELENT', className: 'whitespace-nowrap text-slate-600' },
        { header: 'Limite de crédito', render: (row) => formatCurrency(row.LIMCRED), className: 'whitespace-nowrap font-semibold text-slate-900' },
    ];

    const STATUS_BADGE = {
        Pago:       'bg-emerald-100 text-emerald-700',
        Vencido:    'bg-rose-100 text-rose-700',
        'A vencer': 'bg-amber-100 text-amber-700',
    };

    // ── Derivados de vendedores ────────────────────────────────────────────────
    const vendedoresMap = {};
    vendedores.forEach((u) => {
        if (u?.CODUSUR != null) vendedoresMap[u.CODUSUR] = u.NOME ?? null;
    });
    // Filtro de pesquisa local (nome ou código) e paginação
    const normalizedVendedorSearch = vendedorSearch.trim().toLocaleLowerCase('pt-BR');
    const vendedoresFiltrados = normalizedVendedorSearch
        ? vendedores.filter((u) =>
            `${u?.NOME ?? ''} ${u?.CODUSUR ?? ''}`
                .toLocaleLowerCase('pt-BR')
                .includes(normalizedVendedorSearch)
        )
        : vendedores;
    const vendedoresPageData = vendedoresFiltrados.slice(
        (vendedoresPage - 1) * PAGE_SIZE,
        vendedoresPage * PAGE_SIZE,
    );
    const vendedoresHasNext = vendedoresFiltrados.length > vendedoresPage * PAGE_SIZE;

    const vendedoresColumns = [
        { header: 'Código', accessor: 'CODUSUR', className: 'whitespace-nowrap font-medium' },
        { header: 'Nome', accessor: 'NOME', className: 'font-semibold text-slate-800' },
    ];

    const prestacoesColumns = [
        { header: 'Duplicata', accessor: 'DUPLIC', className: 'whitespace-nowrap font-semibold text-slate-900' },
        {
            header: 'Parc.',
            align: 'center',
            className: 'whitespace-nowrap text-center',
            render: (row) => row.PREST != null
                ? <span className="font-semibold text-slate-700">{row.PREST}</span>
                : <span className="text-slate-400">—</span>,
        },
        {
            header: 'Cliente',
            className: 'max-w-[170px]',
            render: (row) => (
                <span className="block truncate text-slate-800" title={row.CLIENTE || ''}>
                    {row.CLIENTE || '—'}
                </span>
            ),
        },
        {
            header: 'Vendedor',
            className: 'max-w-[130px]',
            render: (row) => {
                if (row.CODUSUR == null) return <span className="text-slate-400">—</span>;
                const nome = vendedoresMap[row.CODUSUR];
                return (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVendedor({ CODUSUR: row.CODUSUR, NOME: nome });
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-blue-700 hover:underline transition-colors cursor-pointer truncate max-w-[130px]"
                        title={nome ? `${nome} (#${row.CODUSUR})` : `Vendedor #${row.CODUSUR}`}
                    >
                        {nome ? `${nome}` : `#${row.CODUSUR}`}
                    </button>
                );
            },
        },
        {
            header: 'Valor',
            className: 'whitespace-nowrap font-semibold text-slate-900',
            render: (row) => formatCurrency(row.VALOR),
        },
        {
            header: 'Vencimento',
            className: 'whitespace-nowrap text-slate-700',
            render: (row) => formatDate(row.DTVENC),
        },
        {
            header: 'Cód. cob.',
            accessor: 'CODCOB',
            className: 'whitespace-nowrap text-slate-600',
        },
        {
            header: 'Status',
            className: 'whitespace-nowrap',
            render: (row) => {
                const s = getStatus(row);
                return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[s]}`}>{s}</span>;
            },
        },
        {
            header: 'Observação',
            className: 'min-w-[150px]',
            render: (row) => (
                <div className="flex items-center justify-between gap-1.5 max-w-[220px]">
                    {row.OBS
                        ? <span className="text-xs text-slate-600 italic truncate" title={row.OBS}>"{row.OBS}"</span>
                        : <span className="text-xs text-slate-400 italic">—</span>
                    }
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleEditObservacao(row); }}
                        className="inline-flex items-center p-1 rounded-md text-blue-600 hover:text-blue-900 hover:bg-blue-50 shrink-0 transition-colors"
                        title={row.OBS ? 'Editar observação' : 'Adicionar observação'}
                    >
                        <Pencil size={13} />
                    </button>
                </div>
            ),
        },
    ];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
            <main className="max-w-7xl mx-auto space-y-8">
                <header className="flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900">Painel Financeiro</h1>
                        <p className="text-slate-600 mt-1">Acompanhamento de recebimentos da distribuidora.</p>
                    </div>
                    <button
                        type="button"
                        onClick={logout}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium text-sm"
                        title="Sair"
                    >
                        <LogOut size={16} />
                        Sair
                    </button>
                </header>

                <nav aria-label="Seções do dashboard" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                    {[['visao-geral', 'Visão geral', BarChart3], ['clientes', 'Clientes', Users], ['prestacoes', 'Prestações', FileText], ['vendedores', 'Vendedores', UserCheck]].map(([key, label, Icon]) => (
                        <button
                            type="button"
                            key={key}
                            onClick={() => setView(key)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${view === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                        >
                            <Icon size={17} />{label}
                        </button>
                    ))}
                </nav>

                {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800">{error}</p>}

                {/* ── Visão geral ─────────────────────────────────────────── */}
                {view === 'visao-geral' && (
                    <section className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <p className="text-sm text-slate-500">
                                Indicadores calculados a partir de até 200 prestações vencidas e a previsão exata dos próximos {diasPrevisao} dias.
                            </p>
                            {/* Configuração de dias */}
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
                                <label htmlFor="dias-previsao" className="text-sm font-medium text-slate-600 whitespace-nowrap">
                                    Previsão:
                                </label>
                                <input
                                    id="dias-previsao"
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={diasInput}
                                    onChange={(e) => setDiasInput(e.target.value)}
                                    onBlur={() => {
                                        const parsed = parseInt(diasInput, 10);
                                        const clamped = Math.max(1, Math.min(365, isNaN(parsed) ? 30 : parsed));
                                        setDiasInput(String(clamped));
                                        setDiasPrevisao(clamped);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.target.blur();
                                    }}
                                    className="w-16 text-center font-bold text-slate-900 bg-transparent border-none focus:outline-none focus:ring-0 text-sm"
                                />
                                <span className="text-sm text-slate-500">dias</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <MetricCard title="A receber" value={formatCurrency(totalReceber)} icon={DollarSign} colorClass="bg-blue-100 text-blue-600" />
                            <MetricCard title="Total vencido" value={formatCurrency(metrics.totalVencido)} icon={AlertCircle} colorClass="bg-rose-100 text-rose-600" />
                            <MetricCard title="Prestações na amostra" value={metrics.totalPrestacoes} icon={FileText} colorClass="bg-amber-100 text-amber-600" />
                        </div>

                        {overviewLoading
                            ? <p>Carregando gráficos...</p>
                            : (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2">
                                        <BarChartVencimentos
                                            dias={diasPrevisao}
                                            data={chartBarData}
                                        />
                                    </div>
                                    <PieChartStatus data={Object.entries(chartPie).map(([name, value]) => ({ name, value }))} />
                                </div>
                            )
                        }
                    </section>
                )}

                {/* ── Clientes ─────────────────────────────────────────────── */}
                {view === 'clientes' && (
                    <DataTable
                        title="Carteira de clientes"
                        columns={clientsColumns}
                        data={clients}
                        loading={clientsLoading}
                        onRowClick={setSelectedClient}
                        onSearch={(value) => { setClientSearch(value); setClientsPage(1); }}
                        searchValue={clientSearch}
                        page={clientsPage}
                        pageSize={PAGE_SIZE}
                        hasNext={clientsHasNext}
                        onPageChange={setClientsPage}
                    />
                )}

                {/* ── Prestações ───────────────────────────────────────────── */}
                {view === 'prestacoes' && (
                    <DataTable
                        title="Prestações"
                        columns={prestacoesColumns}
                        data={prestacoes}
                        loading={prestacoesLoading}
                        onRowClick={(row) => setSelectedPrestacao(row)}
                        onSearch={(value) => { setPrestacaoSearch(value); setPrestacoesPage(1); }}
                        searchValue={prestacaoSearch}
                        page={prestacoesPage}
                        pageSize={PAGE_SIZE}
                        hasNext={prestacoesHasNext}
                        onPageChange={setPrestacoesPage}
                        extraActions={
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPrestacaoVencidas((current) =>
                                            current === '' ? 'mais-vencidas'
                                                : current === 'mais-vencidas' ? 'menos-vencidas'
                                                    : ''
                                        );
                                        setPrestacoesPage(1);
                                    }}
                                    aria-pressed={prestacaoVencidas !== ''}
                                    title={prestacaoVencidas === 'mais-vencidas'
                                        ? 'Filtro de vencidas: mais vencidas primeiro (clique para alternar)'
                                        : prestacaoVencidas === 'menos-vencidas'
                                            ? 'Filtro de vencidas: menos vencidas primeiro (clique para alternar)'
                                            : 'Filtrar apenas prestações vencidas'}
                                    className={`inline-flex items-center gap-1.5 rounded-xl text-sm font-medium px-2.5 py-2 border-2 transition-colors ${
                                        prestacaoVencidas
                                            ? 'bg-rose-600 border-rose-600 text-white'
                                            : 'bg-white border-rose-200 text-slate-700 hover:border-rose-400'
                                    }`}
                                >
                                    {prestacaoVencidas === 'mais-vencidas' && <ArrowDownWideNarrow size={16} />}
                                    {prestacaoVencidas === 'menos-vencidas' && <ArrowUpNarrowWide size={16} />}
                                    {prestacaoVencidas === '' && <CalendarX size={16} />}
                                    {prestacaoVencidas === 'mais-vencidas' ? 'Mais vencidas' : prestacaoVencidas === 'menos-vencidas' ? 'Menos vencidas' : 'Vencidas'}
                                </button>
                                <input
                                    type="date"
                                    value={prestacaoEmissao}
                                    aria-label="Filtrar por data de emissão"
                                    title="Filtrar por data de emissão"
                                    onChange={(event) => { setPrestacaoEmissao(event.target.value); setPrestacoesPage(1); }}
                                    className="border-2 border-green-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-slate-900 bg-white px-2.5 py-2"
                                />
                                <input
                                    type="date"
                                    value={prestacaoVenc}
                                    aria-label="Filtrar por data de vencimento"
                                    title="Filtrar por data de vencimento"
                                    onChange={(event) => { setPrestacaoVenc(event.target.value); setPrestacoesPage(1); }}
                                    className="border-2 border-red-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-slate-900 bg-white px-2.5 py-2"
                                />
                                {(prestacaoEmissao || prestacaoVenc || prestacaoVencidas) && (
                                    <button
                                        type="button"
                                        onClick={() => { setPrestacaoEmissao(''); setPrestacaoVenc(''); setPrestacaoVencidas(''); setPrestacoesPage(1); }}
                                        className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                                    >
                                        Limpar filtros
                                    </button>
                                )}
                            </>
                        }
                    />
                )}

                {/* ── Vendedores ───────────────────────────────────────────── */}
                {view === 'vendedores' && (
                    <DataTable
                        title="Vendedores"
                        columns={vendedoresColumns}
                        data={vendedoresPageData}
                        loading={vendedoresLoading}
                        onRowClick={setSelectedVendedor}
                        onSearch={(value) => { setVendedorSearch(value); setVendedoresPage(1); }}
                        searchValue={vendedorSearch}
                        page={vendedoresPage}
                        pageSize={PAGE_SIZE}
                        hasNext={vendedoresHasNext}
                        onPageChange={setVendedoresPage}
                    />
                )}
            </main>

            {/* ── Modais ────────────────────────────────────────────────────── */}
            <ClientModal
                isOpen={Boolean(selectedClient)}
                onClose={() => setSelectedClient(null)}
                client={selectedClient}
                onPrestacaoClick={(p) => setSelectedPrestacao(p)}
            />

            <PrestacaoModal
                isOpen={Boolean(selectedPrestacao)}
                onClose={() => setSelectedPrestacao(null)}
                prestacao={selectedPrestacao}
                onEditObservacao={(p) => { handleEditObservacao(p); }}
            />

            <VendedorModal
                isOpen={Boolean(selectedVendedor)}
                onClose={() => setSelectedVendedor(null)}
                vendedor={selectedVendedor}
            />

            {editingPrestacao && (
                <div className="fixed inset-0 z-[60] bg-slate-950/50 flex items-center justify-center p-4">
                    <form onSubmit={saveObservation} className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-2xl">
                        <h2 className="text-xl font-bold text-slate-900">
                            Observação da duplicata #{editingPrestacao.DUPLIC}
                            {editingPrestacao.PREST != null && (
                                <span className="text-slate-500 font-medium text-base ml-2">
                                    (Parcela #{editingPrestacao.PREST})
                                </span>
                            )}
                        </h2>
                        <textarea
                            autoFocus
                            required
                            maxLength={200}
                            value={observacao}
                            onChange={(event) => setObservacao(event.target.value)}
                            className="w-full min-h-28 rounded-xl border border-slate-300 p-3"
                        />
                        <p className="text-xs text-slate-500">Máximo de 200 caracteres.</p>
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => setEditingPrestacao(null)} className="px-4 py-2">Cancelar</button>
                            <button disabled={savingObservation} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
                                {savingObservation ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
