import { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    CircleDollarSign,
    FileText,
    LoaderCircle,
    MessageCircle,
    Phone,
    ReceiptText,
    RefreshCw,
    Search,
    Send,
    SlidersHorizontal,
    Smartphone,
    Users,
    X,
    XCircle,
} from 'lucide-react';

import * as apiService from '../api/apiService';

const MAX_CLIENTES_ENVIO = 100;

const FILTERS = [
    { value: 'todas', label: 'Todas', description: 'Vencidas, hoje e próximos 3 dias' },
    { value: 'vencidas_3_dias', label: 'Vencidas há 3 dias', description: 'Vencidas nos últimos 3 dias' },
    { value: 'vencidas', label: 'Vencidas', description: 'Vencidas nos últimos 365 dias' },
    { value: 'hoje', label: 'Vencem hoje', description: 'Somente com vencimento hoje' },
    { value: 'proximas', label: 'Próximos 3 dias', description: 'De amanhã até o terceiro dia' },
];

const STATUS_LABELS = {
    disconnected: 'Desconectado',
    connecting: 'Conectando',
    awaiting_qr: 'Aguardando QR Code',
    connected: 'Conectado',
    logged_out: 'Sessão encerrada',
};

const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatDate = (value) =>
    value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';

function dateToIso(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function normalizePhone(value) {
    const candidates = String(value || '')
        .split(/[;,/|]/)
        .map((part) => part.replace(/\D/g, ''));
    return candidates.find((phone) => phone.length >= 10 && phone.length <= 15) || '';
}

function normalizeMoney(value) {
    return Number(String(value || '').replace(',', '.')) || 0;
}

function prepareBroadcastClients(data) {
    return (Array.isArray(data?.clientes) ? data.clientes : [])
        .map((client) => ({
            id: String(client.codcli),
            codcli: client.codcli,
            nome: client.nome || `Cliente ${client.codcli}`,
            cnpj: client.cnpj || client.CGCENT || client.cgcent || '',
            celular: normalizePhone(client.celular),
            telefoneOriginal: client.telefoneOriginal || client.celular || '',
            faturas: (Array.isArray(client.faturas) ? client.faturas : [])
                .map((invoice, index) => {
                    const date = invoice.dataVencimento?.slice(0, 10);
                    const value = Number(Number(invoice.valor || 0).toFixed(2));
                    const duplic = invoice.duplic ?? invoice.DUPLIC ?? null;
                    const prest = invoice.prest ?? invoice.PREST ?? null;
                    const codcob = invoice.codcob ?? invoice.CODCOB ?? null;

                    return {
                        id: `${client.codcli}:${duplic ?? index}:${prest ?? ''}:${date}:${value.toFixed(2)}`,
                        dataVencimento: date,
                        valor: value,
                        duplic,
                        prest,
                        codcob,
                    };
                })
                .filter((invoice) => invoice.dataVencimento && invoice.valor > 0)
                .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento)),
        }))
        .filter((client) => client.codcli != null && client.faturas.length > 0)
        .sort((a, b) => a.faturas[0].dataVencimento.localeCompare(b.faturas[0].dataVencimento));
}

function invoicePassesFilters(invoice, dueDate, minimumValue) {
    if (dueDate && invoice.dataVencimento !== dueDate) return false;
    if (minimumValue && invoice.valor < normalizeMoney(minimumValue)) return false;
    return true;
}

export default function BroadcastCobranca() {
    const [filter, setFilter] = useState('todas');
    const [reloadKey, setReloadKey] = useState(0);
    const [clients, setClients] = useState([]);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [search, setSearch] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [minimumValue, setMinimumValue] = useState('');
    const [onlyValidPhones, setOnlyValidPhones] = useState(false);

    const [session, setSession] = useState(null);
    const [qr, setQr] = useState(null);
    const [sessionError, setSessionError] = useState('');
    const [reconnecting, setReconnecting] = useState(false);

    const [sending, setSending] = useState(false);
    const [reviewConfirmed, setReviewConfirmed] = useState(false);
    const [sendError, setSendError] = useState('');
    const [sendResult, setSendResult] = useState(null);

    const today = dateToIso(new Date());

    useEffect(() => {
        const controller = new AbortController();

        async function loadBillingClients() {
            setLoading(true);
            setLoadError('');
            setSendResult(null);
            setSendError('');
            setReviewConfirmed(false);

            const daysPast = filter === 'vencidas_3_dias' ? 3 : 365;
            const period = filter === 'vencidas_3_dias' ? 'vencidas' : filter;

            try {
                const data = await apiService.listBroadcastCobranca(
                    {
                        periodo: period,
                        dias_passados: daysPast,
                        dias_futuros: 3,
                        search: search.trim() || undefined,
                        venc: dueDate || undefined,
                        valormin: normalizeMoney(minimumValue) || undefined,
                        pagina: 1,
                        limite: MAX_CLIENTES_ENVIO,
                    },
                    { signal: controller.signal },
                );

                if (controller.signal.aborted) return;

                const preparedClients = prepareBroadcastClients(data);
                const eligibleClients = preparedClients.filter((client) => client.celular);
                const initiallySelected = eligibleClients
                    .slice(0, MAX_CLIENTES_ENVIO)
                    .flatMap((client) => client.faturas.map((invoice) => invoice.id));

                setClients(preparedClients);
                setSelectedInvoiceIds(new Set(initiallySelected));
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setLoadError(error.message || 'Não foi possível preparar as cobranças.');
                    setClients([]);
                    setSelectedInvoiceIds(new Set());
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        const timer = setTimeout(loadBillingClients, search.trim() ? 300 : 0);
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [dueDate, filter, minimumValue, reloadKey, search]);

    useEffect(() => {
        const controller = new AbortController();

        async function refreshSession() {
            try {
                const status = await apiService.getWhatsAppSessionStatus({ signal: controller.signal });
                if (controller.signal.aborted) return;
                setSession(status);
                setSessionError('');

                if (status.status === 'awaiting_qr' && status.qrAvailable) {
                    try {
                        const qrData = await apiService.getWhatsAppQr({ signal: controller.signal });
                        if (!controller.signal.aborted) setQr(qrData);
                    } catch (error) {
                        if (error.name !== 'AbortError' && !controller.signal.aborted) setQr(null);
                    }
                } else {
                    setQr(null);
                }
            } catch (error) {
                if (error.name !== 'AbortError' && !controller.signal.aborted) {
                    setSessionError(error.message || 'Não foi possível consultar a sessão do WhatsApp.');
                }
            }
        }

        refreshSession();
        const interval = setInterval(refreshSession, 5000);
        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, []);

    const activeInvoicesByClient = useMemo(() => new Map(
        clients.map((client) => [
            client.id,
            client.faturas.filter((invoice) => invoicePassesFilters(invoice, dueDate, minimumValue)),
        ]),
    ), [clients, dueDate, minimumValue]);

    const filteredClients = useMemo(() => clients.flatMap((client) => {
        if (onlyValidPhones && !client.celular) return [];
        const activeInvoices = activeInvoicesByClient.get(client.id) || [];
        return activeInvoices.length ? [{ ...client, visibleInvoices: activeInvoices }] : [];
    }), [activeInvoicesByClient, clients, onlyValidPhones]);

    const selectedClients = useMemo(() => clients.flatMap((client) => {
        const activeInvoices = activeInvoicesByClient.get(client.id) || [];
        const faturas = activeInvoices.filter((invoice) => selectedInvoiceIds.has(invoice.id));
        return client.celular && faturas.length ? [{ ...client, faturas }] : [];
    }), [activeInvoicesByClient, clients, selectedInvoiceIds]);

    const selectedClientIds = useMemo(
        () => new Set(selectedClients.map((client) => client.id)),
        [selectedClients],
    );
    const validClients = filteredClients.filter((client) => client.celular);
    const invalidClients = filteredClients.length - validClients.length;
    const unselectedClients = validClients.filter((client) => !selectedClientIds.has(client.id)).length;
    const invoiceCount = selectedClients.reduce((total, client) => total + client.faturas.length, 0);
    const invoiceTotal = selectedClients.reduce(
        (total, client) => total + client.faturas.reduce((sum, invoice) => sum + invoice.valor, 0),
        0,
    );

    function resetReview() {
        setReviewConfirmed(false);
        setSendResult(null);
    }

    function applyInvoiceFilters(nextDueDate, nextMinimumValue) {
        setDueDate(nextDueDate);
        setMinimumValue(nextMinimumValue);
        resetReview();

        // Faturas removidas por um filtro também saem da seleção. Assim,
        // limpar o filtro depois não inclui silenciosamente cobranças antigas
        // nem permite ultrapassar o limite de 100 clientes do contrato.
        const allowedIds = new Set(clients.flatMap((client) => client.faturas
            .filter((invoice) => invoicePassesFilters(invoice, nextDueDate, nextMinimumValue))
            .map((invoice) => invoice.id)));
        setSelectedInvoiceIds((current) => new Set(
            [...current].filter((id) => allowedIds.has(id)),
        ));
    }

    function toggleInvoice(client, invoice) {
        if (!client.celular) return;
        resetReview();
        setSelectedInvoiceIds((current) => {
            const next = new Set(current);
            if (next.has(invoice.id)) {
                next.delete(invoice.id);
            } else if (selectedClientIds.has(client.id) || selectedClientIds.size < MAX_CLIENTES_ENVIO) {
                next.add(invoice.id);
            }
            return next;
        });
    }

    function toggleClient(client) {
        if (!client.celular) return;
        const invoices = client.visibleInvoices || [];
        const allSelected = invoices.length > 0 && invoices.every((invoice) => selectedInvoiceIds.has(invoice.id));
        resetReview();

        setSelectedInvoiceIds((current) => {
            const next = new Set(current);
            if (allSelected) {
                invoices.forEach((invoice) => next.delete(invoice.id));
            } else if (selectedClientIds.has(client.id) || selectedClientIds.size < MAX_CLIENTES_ENVIO) {
                invoices.forEach((invoice) => next.add(invoice.id));
            }
            return next;
        });
    }

    function toggleAll() {
        const selectableClients = validClients.slice(0, MAX_CLIENTES_ENVIO);
        const visibleInvoiceIds = selectableClients.flatMap((client) =>
            client.visibleInvoices.map((invoice) => invoice.id));
        const allSelected = visibleInvoiceIds.length > 0
            && visibleInvoiceIds.every((id) => selectedInvoiceIds.has(id));
        resetReview();

        setSelectedInvoiceIds((current) => {
            const next = new Set(current);
            if (allSelected) {
                visibleInvoiceIds.forEach((id) => next.delete(id));
                return next;
            }

            const clientIds = new Set(selectedClientIds);
            selectableClients.forEach((client) => {
                if (!clientIds.has(client.id) && clientIds.size >= MAX_CLIENTES_ENVIO) return;
                clientIds.add(client.id);
                client.visibleInvoices.forEach((invoice) => next.add(invoice.id));
            });
            return next;
        });
    }

    function clearFilters() {
        setSearch('');
        setDueDate('');
        setMinimumValue('');
        setOnlyValidPhones(false);
        resetReview();
    }

    async function reconnect() {
        setReconnecting(true);
        setSessionError('');
        try {
            setSession(await apiService.reconnectWhatsApp());
        } catch (error) {
            setSessionError(error.message || 'Não foi possível reconectar o WhatsApp.');
        } finally {
            setReconnecting(false);
        }
    }

    async function sendBroadcast() {
        if (!selectedClients.length || sending) return;
        setSending(true);
        setSendError('');
        setSendResult(null);

        try {
            const payload = selectedClients.map((client) => ({
                nome: client.nome.slice(0, 160),
                celular: client.celular,
                faturas: client.faturas.map((invoice) => ({
                    dataVencimento: invoice.dataVencimento,
                    valor: invoice.valor,
                })),
            }));
            setSendResult(await apiService.sendWhatsAppBilling(payload));
            setReviewConfirmed(false);
        } catch (error) {
            setSendError(error.message || 'Não foi possível enviar as cobranças.');
        } finally {
            setSending(false);
        }
    }

    const connected = session?.status === 'connected' && session?.sendingEnabled;
    const hasFilters = Boolean(search || dueDate || minimumValue || onlyValidPhones);

    return (
        <section className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.35)] overflow-hidden">
                    <div className="bg-gradient-to-br from-white via-emerald-50/70 to-sky-50 p-6 text-slate-900 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                                    <MessageCircle size={23} />
                                </span>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Central de envio</p>
                                    <h2 className="text-2xl font-black tracking-tight">Broadcast de cobrança</h2>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 mt-3 max-w-2xl">Filtre a carteira, confira cada prestação e monte o lote que será enviado pelo WhatsApp.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReloadKey((value) => value + 1)}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <legend className="px-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Período das faturas</legend>
                            <div className="flex flex-wrap gap-2">
                                {FILTERS.map((option) => (
                                    <button
                                        type="button"
                                        key={option.value}
                                        onClick={() => setFilter(option.value)}
                                        title={option.description}
                                        aria-pressed={filter === option.value}
                                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                                            filter === option.value
                                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                            <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-800">
                                <SlidersHorizontal size={17} className="text-emerald-600" /> Refinar cobranças
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_180px_auto] xl:items-end">
                                <div className="block text-sm font-bold text-slate-700">
                                    <label htmlFor="broadcast-search">Cliente ou prestação</label>
                                    <div className="relative mt-2">
                                        <Search size={17} className="absolute inset-y-0 left-3 my-auto text-slate-400" aria-hidden="true" />
                                        <input
                                            id="broadcast-search"
                                            type="search"
                                            value={search}
                                            maxLength={120}
                                            onChange={(event) => setSearch(event.target.value)}
                                            placeholder="Nome, código, duplicata, parcela ou cobrança"
                                            className="block w-full rounded-xl border-2 border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                                        />
                                        {search && (
                                            <button
                                                type="button"
                                                onClick={() => setSearch('')}
                                                aria-label="Limpar busca"
                                                className="absolute inset-y-0 right-2 my-auto inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <label className="block text-sm font-bold text-slate-700">
                                    Vencimento
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(event) => applyInvoiceFilters(event.target.value, minimumValue)}
                                        className="mt-2 block w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                    />
                                </label>

                                <label className="block text-sm font-bold text-slate-700">
                                    Valor mínimo
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={minimumValue}
                                        onChange={(event) => applyInvoiceFilters(dueDate, event.target.value)}
                                        placeholder="R$ 0,00"
                                        className="mt-2 block w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                    />
                                </label>

                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    disabled={!hasFilters}
                                    className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                                >
                                    Limpar filtros
                                </button>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                                <button
                                    type="button"
                                    aria-pressed={onlyValidPhones}
                                    onClick={() => setOnlyValidPhones((value) => !value)}
                                    className={`inline-flex items-center gap-2 rounded-xl border-2 px-3.5 py-2 text-sm font-bold transition-colors ${
                                        onlyValidPhones
                                            ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50'
                                    }`}
                                >
                                    <Phone size={16} aria-hidden="true" />
                                    Somente com telefone válido
                                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                                        onlyValidPhones ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {onlyValidPhones ? 'Ativo' : 'Todos'}
                                    </span>
                                </button>
                                <p className="text-xs text-slate-500" aria-live="polite">
                                    {filteredClients.length} de {clients.length} cliente(s) · busca por cliente, telefone, duplicata, parcela, cobrança, data ou valor.
                                </p>
                            </div>
                        </div>

                        {loadError && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</p>}

                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <SummaryCard icon={Users} label="Clientes" value={`${selectedClients.length}/${MAX_CLIENTES_ENVIO}`} tone="blue" />
                            <SummaryCard icon={FileText} label="Prestações" value={invoiceCount} tone="violet" />
                            <SummaryCard icon={CircleDollarSign} label="Valor selecionado" value={formatCurrency(invoiceTotal)} tone="emerald" />
                            <SummaryCard icon={ReceiptText} label="Não selecionados" value={unselectedClients} />
                            <SummaryCard icon={Phone} label="Sem telefone" value={invalidClients} warning={invalidClients > 0} />
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
                                <div>
                                    <div className="flex items-center gap-2 font-black text-slate-900">
                                        <Users size={18} className="text-emerald-600" /> Clientes para revisão
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{filteredClients.length}</span>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">Marque o cliente inteiro ou escolha prestações individualmente.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleAll}
                                    disabled={!validClients.length}
                                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Selecionar/limpar exibidos
                                </button>
                            </div>

                            {selectedClients.length === MAX_CLIENTES_ENVIO && validClients.length > MAX_CLIENTES_ENVIO && (
                                <p role="status" className="border-b border-blue-100 bg-blue-50 px-5 py-2.5 text-xs font-semibold text-blue-800">
                                    Limite de 100 clientes atingido. Desmarque um cliente para selecionar outro.
                                </p>
                            )}

                            <div className="max-h-[680px] space-y-4 overflow-auto p-4">
                                {loading ? (
                                    <div className="space-y-3" aria-label="Carregando cobranças">
                                        {[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
                                    </div>
                                ) : clients.length === 0 ? (
                                    <EmptyState title="Nenhuma cobrança neste período" description="Tente outro período ou atualize os filtros." />
                                ) : filteredClients.length === 0 ? (
                                    <EmptyState title="Nenhum resultado encontrado" description="Revise os termos da busca ou limpe os filtros aplicados." />
                                ) : filteredClients.map((client) => {
                                    const allSelected = client.visibleInvoices.every((invoice) => selectedInvoiceIds.has(invoice.id));
                                    const selectedVisible = client.visibleInvoices.filter((invoice) => selectedInvoiceIds.has(invoice.id));
                                    const total = selectedVisible.reduce((sum, invoice) => sum + invoice.valor, 0);
                                    const cannotSelect = !client.celular
                                        || (!selectedClientIds.has(client.id) && selectedClientIds.size >= MAX_CLIENTES_ENVIO);
                                    const hasSelection = selectedVisible.length > 0;

                                    return (
                                        <article
                                            key={client.id}
                                            className={`overflow-hidden rounded-2xl border bg-white transition-shadow ${
                                                hasSelection
                                                    ? 'border-emerald-300 shadow-[0_12px_30px_-20px_rgba(5,150,105,0.65)]'
                                                    : 'border-slate-200 shadow-sm'
                                            } ${!client.celular ? 'bg-amber-50/40' : ''}`}
                                        >
                                            <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
                                                <input
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    disabled={cannotSelect}
                                                    onChange={() => toggleClient(client)}
                                                    aria-label={`Selecionar todas as prestações de ${client.nome}`}
                                                    className="size-5 shrink-0 accent-emerald-600"
                                                />
                                                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-700 ring-1 ring-emerald-200">
                                                    {client.nome.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="min-w-[180px] flex-1">
                                                    <h3 className="truncate font-black text-slate-900" title={client.nome}>{client.nome}</h3>
                                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                                        <span className="font-semibold">Cliente #{client.codcli}</span>
                                                        {client.celular ? (
                                                            <span className="inline-flex items-center gap-1"><Phone size={12} /> {client.telefoneOriginal || client.celular}</span>
                                                        ) : (
                                                            <span className="font-bold text-amber-700">Telefone inválido</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="ml-auto text-right">
                                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Selecionado</p>
                                                    <p className={`text-lg font-black ${hasSelection ? 'text-emerald-700' : 'text-slate-400'}`}>{formatCurrency(total)}</p>
                                                    <p className="text-xs font-semibold text-slate-500">{selectedVisible.length} de {client.visibleInvoices.length} prestações</p>
                                                </div>
                                            </div>

                                            <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 2xl:grid-cols-3">
                                                {client.visibleInvoices.map((invoice) => {
                                                    const selected = selectedInvoiceIds.has(invoice.id);
                                                    const overdue = invoice.dataVencimento < today;
                                                    const dueToday = invoice.dataVencimento === today;

                                                    return (
                                                        <label
                                                            key={invoice.id}
                                                            className={`group flex cursor-pointer gap-3 rounded-xl border p-3 transition-all ${
                                                                selected
                                                                    ? 'border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-200'
                                                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                                            } ${cannotSelect ? 'cursor-not-allowed opacity-60' : ''}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selected}
                                                                disabled={cannotSelect}
                                                                onChange={() => toggleInvoice(client, invoice)}
                                                                className="mt-1 size-4 shrink-0 accent-emerald-600"
                                                            />
                                                            <span className="min-w-0 flex-1">
                                                                <span className="flex items-start justify-between gap-2">
                                                                    <span>
                                                                        <span className="block text-base font-black text-slate-900">{formatCurrency(invoice.valor)}</span>
                                                                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                                                                            <CalendarDays size={12} /> {formatDate(invoice.dataVencimento)}
                                                                        </span>
                                                                    </span>
                                                                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                                                                        overdue
                                                                            ? 'bg-rose-100 text-rose-700'
                                                                            : dueToday
                                                                                ? 'bg-amber-100 text-amber-700'
                                                                                : 'bg-blue-100 text-blue-700'
                                                                    }`}>
                                                                        {overdue ? 'Vencida' : dueToday ? 'Hoje' : 'A vencer'}
                                                                    </span>
                                                                </span>
                                                                <span className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-600">
                                                                    {invoice.duplic != null && <span className="rounded-md bg-slate-100 px-2 py-1">Dup. {invoice.duplic}</span>}
                                                                    {invoice.prest != null && <span className="rounded-md bg-slate-100 px-2 py-1">Parc. {invoice.prest}</span>}
                                                                    {invoice.codcob && <span className="rounded-md bg-violet-100 px-2 py-1 text-violet-700">Cob. {invoice.codcob}</span>}
                                                                </span>
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="bg-white rounded-3xl border border-slate-200 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.35)] overflow-hidden xl:sticky xl:top-6">
                    <div className="p-5 border-b border-slate-200 flex items-center gap-3">
                        <div className={`size-10 rounded-xl flex items-center justify-center ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            <Smartphone size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Conexão WhatsApp</h3>
                            <p className={`text-sm font-semibold ${connected ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {session?.status === 'connected' && !session?.sendingEnabled
                                    ? 'Conectado · envio indisponível'
                                    : STATUS_LABELS[session?.status] || 'Consultando...'}
                            </p>
                        </div>
                    </div>

                    <div className="p-5 space-y-4">
                        {sessionError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{sessionError}</p>}

                        {qr?.qrDataUrl && (
                            <div className="text-center">
                                <img src={qr.qrDataUrl} alt="QR Code para conectar o WhatsApp" className="mx-auto w-56 max-w-full rounded-xl border border-slate-200" />
                                <p className="text-xs text-slate-500 mt-3">No WhatsApp, abra Aparelhos conectados e escaneie o código.</p>
                            </div>
                        )}

                        {!connected && ['disconnected', 'logged_out'].includes(session?.status) && (
                            <button
                                type="button"
                                onClick={reconnect}
                                disabled={reconnecting || session?.status === 'connecting'}
                                className="w-full inline-flex justify-center items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                {reconnecting ? <LoaderCircle size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                                {session?.status === 'awaiting_qr' ? 'Gerar novo QR' : 'Conectar WhatsApp'}
                            </button>
                        )}

                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-slate-900">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Resumo do lote</p>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-2xl font-black">{selectedClients.length}</p>
                                    <p className="text-xs text-slate-500">clientes</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-black">{invoiceCount}</p>
                                    <p className="text-xs text-slate-500">prestações</p>
                                </div>
                            </div>
                            <div className="my-4 border-t border-emerald-200 pt-4">
                                <p className="text-xs text-slate-500">Valor total selecionado</p>
                                <p className="text-2xl font-black text-emerald-700">{formatCurrency(invoiceTotal)}</p>
                            </div>
                            <p className="mb-3 text-xs leading-relaxed text-slate-600">
                                Somente as prestações marcadas serão agrupadas e enviadas para cada cliente.
                            </p>
                            <label className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-white p-3 text-xs font-medium text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={reviewConfirmed}
                                    onChange={(event) => setReviewConfirmed(event.target.checked)}
                                    disabled={!selectedClients.length || sending}
                                    className="mt-0.5 size-4 shrink-0 accent-emerald-600"
                                />
                                Revisei os destinatários, faturas, valores e autorizo este envio.
                            </label>
                            <button
                                type="button"
                                onClick={sendBroadcast}
                                disabled={!connected || !selectedClients.length || !reviewConfirmed || sending || loading}
                                className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {sending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
                                {sending ? 'Enviando...' : `Enviar ${invoiceCount} fatura(s)`}
                            </button>
                            {!connected && <p className="mt-2 text-center text-xs text-slate-500">Conecte o WhatsApp para liberar o envio.</p>}
                        </div>

                        {sendError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{sendError}</p>}
                        {sendResult && (
                            <div className={`rounded-xl p-4 ${sendResult.failed ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                                <div className="flex items-center gap-2 font-bold text-slate-800">
                                    {sendResult.failed ? <AlertCircle size={18} className="text-amber-600" /> : <CheckCircle2 size={18} className="text-emerald-600" />}
                                    Envio concluído
                                </div>
                                <p className="text-sm text-slate-600 mt-1">{sendResult.sent} enviada(s) · {sendResult.failed} falha(s)</p>
                                {sendResult.failed > 0 && (
                                    <div className="mt-3 space-y-1">
                                        {sendResult.results?.filter((item) => item.status === 'failed').map((item) => (
                                            <p key={`${item.index}-${item.celular}`} className="text-xs text-rose-700 flex items-center gap-1">
                                                <XCircle size={13} /> {item.nome}: {item.errorCode || 'falha no envio'}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </section>
    );
}

function SummaryCard({ icon: Icon, label, value, tone = 'slate', warning = false }) {
    const tones = {
        slate: 'bg-slate-100 text-slate-700',
        blue: 'bg-blue-100 text-blue-700',
        violet: 'bg-violet-100 text-violet-700',
        emerald: 'bg-emerald-100 text-emerald-700',
    };

    return (
        <div className={`rounded-2xl border p-3.5 ${warning ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white shadow-sm'}`}>
            <div className={`mb-3 flex size-8 items-center justify-center rounded-xl ${warning ? 'bg-amber-100 text-amber-700' : tones[tone]}`}>
                {Icon && <Icon size={16} />}
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
            <p className={`mt-1 text-lg font-black tracking-tight ${warning ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
        </div>
    );
}

function EmptyState({ title, description }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <ReceiptText size={22} />
            </span>
            <h3 className="mt-4 font-black text-slate-800">{title}</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
        </div>
    );
}
