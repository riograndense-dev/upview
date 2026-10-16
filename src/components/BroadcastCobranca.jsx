import { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    LoaderCircle,
    MessageCircle,
    RefreshCw,
    Search,
    Send,
    Smartphone,
    Users,
    X,
    XCircle,
} from 'lucide-react';

import * as apiService from '../api/apiService';

const MAX_CLIENTES_ENVIO = 100;

const FILTERS = [
    { value: 'todas', label: 'Todas', description: 'Vencidas, hoje e próximos 3 dias' },
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

function billingType(invoices, today) {
    const overdue = invoices.some((invoice) => invoice.dataVencimento < today);
    const upcoming = invoices.some((invoice) => invoice.dataVencimento >= today);
    if (overdue && upcoming) return 'Vencidas e próximas';
    return overdue ? 'Vencidas' : 'Próximas';
}

function prepareBroadcastClients(data, matchesPeriod = false) {
    return (Array.isArray(data?.clientes) ? data.clientes : [])
        .map((client) => ({
            id: String(client.codcli),
            codcli: client.codcli,
            nome: client.nome || `Cliente ${client.codcli}`,
            cnpj: client.cnpj || client.CGCENT || client.cgcent || '',
            celular: normalizePhone(client.celular),
            telefoneOriginal: client.telefoneOriginal || client.celular || '',
            matchesPeriod,
            faturas: (Array.isArray(client.faturas) ? client.faturas : [])
                .map((invoice) => ({
                    dataVencimento: invoice.dataVencimento?.slice(0, 10),
                    valor: Number(Number(invoice.valor || 0).toFixed(2)),
                }))
                .filter((invoice) => invoice.dataVencimento && invoice.valor > 0)
                .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento)),
        }))
        .filter((client) => client.codcli != null && client.faturas.length > 0)
        .sort((a, b) => a.faturas[0].dataVencimento.localeCompare(b.faturas[0].dataVencimento));
}

export default function BroadcastCobranca() {
    const [filter, setFilter] = useState('todas');
    const [reloadKey, setReloadKey] = useState(0);
    const [clients, setClients] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [clientSearch, setClientSearch] = useState('');
    const [searchMatchIds, setSearchMatchIds] = useState(null);
    const [searchingClients, setSearchingClients] = useState(false);
    const [searchError, setSearchError] = useState('');

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
            try {
                const data = await apiService.listBroadcastCobranca(
                    { periodo: filter, dias_passados: 365, dias_futuros: 3 },
                    { signal: controller.signal },
                );
                if (controller.signal.aborted) return;

                const preparedClients = prepareBroadcastClients(data, true);

                const eligible = preparedClients.filter((client) => client.celular);
                setClients(preparedClients);
                setSelectedIds(new Set(eligible.slice(0, MAX_CLIENTES_ENVIO).map((client) => client.id)));
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setLoadError(error.message || 'Não foi possível preparar as cobranças.');
                    setClients([]);
                    setSelectedIds(new Set());
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        loadBillingClients();
        return () => controller.abort();
    }, [filter, reloadKey, today]);

    useEffect(() => {
        const query = clientSearch.trim();
        if (!query) return undefined;

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setSearchingClients(true);
            setSearchError('');
            try {
                const data = await apiService.listBroadcastCobranca(
                    { periodo: 'abertas', search: query },
                    { signal: controller.signal },
                );
                if (controller.signal.aborted) return;

                const searchClients = prepareBroadcastClients(data);
                setSearchMatchIds(new Set(searchClients.map((client) => client.id)));
                setClients((current) => {
                    const merged = new Map(current.map((client) => [client.id, client]));
                    searchClients.forEach((client) => {
                        const existing = merged.get(client.id);
                        merged.set(client.id, {
                            ...existing,
                            ...client,
                            matchesPeriod: Boolean(existing?.matchesPeriod),
                        });
                    });
                    return Array.from(merged.values()).sort(
                        (a, b) => a.faturas[0].dataVencimento.localeCompare(b.faturas[0].dataVencimento),
                    );
                });
            } catch (error) {
                if (error.name !== 'AbortError' && !controller.signal.aborted) {
                    setSearchMatchIds(null);
                    setSearchError(error.message || 'Não foi possível buscar clientes com faturas em aberto.');
                }
            } finally {
                if (!controller.signal.aborted) setSearchingClients(false);
            }
        }, 300);

        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [clientSearch]);

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

    const selectedClients = useMemo(
        () => clients.filter((client) => client.celular && selectedIds.has(client.id)),
        [clients, selectedIds],
    );
    const locallyMatchedClients = useMemo(() => {
        const query = clientSearch.trim().toLocaleLowerCase('pt-BR');
        if (!query) return clients.filter((client) => client.matchesPeriod || selectedIds.has(client.id));

        const digits = query.replace(/\D/g, '');
        return clients.filter((client) => (
            client.nome.toLocaleLowerCase('pt-BR').includes(query)
            || String(client.codcli).includes(query)
            || (digits && String(client.cnpj).replace(/\D/g, '').includes(digits))
        ));
    }, [clientSearch, clients, selectedIds]);
    const filteredClients = useMemo(() => {
        if (!clientSearch.trim() || searchMatchIds == null) return locallyMatchedClients;

        const matchedIds = new Set(searchMatchIds);
        locallyMatchedClients.forEach((client) => matchedIds.add(client.id));
        return clients.filter((client) => matchedIds.has(client.id));
    }, [clientSearch, clients, locallyMatchedClients, searchMatchIds]);
    const validClients = filteredClients.filter((client) => client.celular);
    const invalidClients = filteredClients.length - validClients.length;
    const unselectedClients = validClients.filter((client) => !selectedIds.has(client.id)).length;
    const invoiceCount = selectedClients.reduce((total, client) => total + client.faturas.length, 0);
    const invoiceTotal = selectedClients.reduce(
        (total, client) => total + client.faturas.reduce((sum, invoice) => sum + invoice.valor, 0),
        0,
    );

    function updateClientSearch(value) {
        setClientSearch(value);
        setSearchMatchIds(null);
        setSearchError('');
        if (!value.trim()) setSearchingClients(false);
    }

    function toggleClient(client) {
        if (!client.celular) return;
        setReviewConfirmed(false);
        setSendResult(null);
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(client.id)) next.delete(client.id);
            else if (next.size < MAX_CLIENTES_ENVIO) next.add(client.id);
            return next;
        });
    }

    function toggleAll() {
        setReviewConfirmed(false);
        setSendResult(null);
        if (selectedClients.length > 0) {
            setSelectedIds(new Set());
            return;
        }
        setSelectedIds(new Set(validClients.slice(0, MAX_CLIENTES_ENVIO).map((client) => client.id)));
    }

    async function reconnect() {
        setReconnecting(true);
        setSessionError('');
        try {
            const status = await apiService.reconnectWhatsApp();
            setSession(status);
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
                faturas: client.faturas,
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

    return (
        <section className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <MessageCircle className="text-emerald-600" size={23} />
                                <h2 className="text-xl font-bold text-slate-900">Broadcast de cobrança</h2>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">Revise clientes e faturas antes de enviar as mensagens automáticas.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReloadKey((value) => value + 1)}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        <fieldset>
                            <legend className="text-sm font-bold text-slate-700 mb-2">Período das faturas</legend>
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
                                                ? 'bg-slate-900 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <label htmlFor="broadcast-client-search" className="mb-2 block text-sm font-bold text-slate-700">
                                Buscar clientes
                            </label>
                            <div className="relative max-w-xl">
                                <Search size={17} className="absolute inset-y-0 left-3 my-auto text-slate-400" aria-hidden="true" />
                                <input
                                    id="broadcast-client-search"
                                    type="search"
                                    value={clientSearch}
                                    maxLength={120}
                                    onChange={(event) => updateClientSearch(event.target.value)}
                                    placeholder="Digite o nome, CNPJ ou código do cliente"
                                    className="block w-full rounded-xl border-2 border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                                />
                                {clientSearch && (
                                    <button
                                        type="button"
                                        onClick={() => updateClientSearch('')}
                                        aria-label="Limpar busca de clientes"
                                        className="absolute inset-y-0 right-2 my-auto inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                            <p className="mt-2 text-xs text-slate-500" aria-live="polite">
                                {clientSearch.trim() && searchingClients
                                    ? 'Buscando clientes...'
                                    : clientSearch.trim()
                                        ? `${filteredClients.length} de ${clients.length} cliente(s) exibido(s)`
                                        : 'Pesquise em todos os clientes com faturas em aberto, independentemente do período.'}
                            </p>
                            {clientSearch.trim() && searchError && (
                                <p role="alert" className="mt-2 text-xs font-medium text-amber-700">{searchError}</p>
                            )}
                        </div>

                        {loadError && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</p>}

                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <SummaryCard label="Selecionados" value={`${selectedClients.length}/${MAX_CLIENTES_ENVIO}`} />
                            <SummaryCard label="Faturas" value={invoiceCount} />
                            <SummaryCard label="Valor" value={formatCurrency(invoiceTotal)} />
                            <SummaryCard label="Não selecionados" value={unselectedClients} />
                            <SummaryCard label="Sem telefone" value={invalidClients} warning={invalidClients > 0} />
                        </div>

                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <Users size={16} /> Clientes encontrados
                                    {clientSearch.trim() && <span className="font-normal text-slate-500">({filteredClients.length} de {clients.length})</span>}
                                </div>
                                <button type="button" onClick={toggleAll} disabled={!validClients.length} className="text-sm font-semibold text-blue-700 disabled:opacity-50">
                                    {selectedClients.length ? 'Limpar seleção' : 'Selecionar até 100'}
                                </button>
                            </div>
                            {selectedClients.length === MAX_CLIENTES_ENVIO && validClients.length > MAX_CLIENTES_ENVIO && (
                                <p role="status" className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-800">
                                    Limite da API atingido. Desmarque um cliente para selecionar outro.
                                </p>
                            )}
                            <div className="max-h-[430px] overflow-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 w-10">Enviar</th>
                                            <th className="px-4 py-3">Cliente</th>
                                            <th className="px-4 py-3">Telefone</th>
                                            <th className="px-4 py-3">Cobrança</th>
                                            <th className="px-4 py-3 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading ? (
                                            <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-400">Preparando clientes e faturas...</td></tr>
                                        ) : clients.length === 0 ? (
                                            <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-400">Nenhuma fatura encontrada para este filtro.</td></tr>
                                        ) : filteredClients.length === 0 ? (
                                            <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-400">Nenhum cliente encontrado para esta busca.</td></tr>
                                        ) : filteredClients.map((client) => {
                                            const total = client.faturas.reduce((sum, invoice) => sum + invoice.valor, 0);
                                            return (
                                                <tr key={client.id} className={!client.celular ? 'bg-amber-50/50' : 'hover:bg-slate-50'}>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(client.celular && selectedIds.has(client.id))}
                                                            disabled={!client.celular || (!selectedIds.has(client.id) && selectedClients.length >= MAX_CLIENTES_ENVIO)}
                                                            onChange={() => toggleClient(client)}
                                                            aria-label={`Selecionar ${client.nome}`}
                                                            className="size-4 accent-slate-900"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-semibold text-slate-800 max-w-[240px] truncate" title={client.nome}>{client.nome}</p>
                                                        <p className="text-xs text-slate-400">Cód. {client.codcli} · {client.faturas.length} fatura(s)</p>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {client.celular
                                                            ? <span className="text-slate-700">{client.telefoneOriginal || client.celular}</span>
                                                            : <span className="text-xs font-semibold text-amber-700">Telefone inválido</span>}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                                        <span className="font-medium">{billingType(client.faturas, today)}</span>
                                                        <p className="text-xs text-slate-400">a partir de {formatDate(client.faturas[0]?.dataVencimento)}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-slate-800">{formatCurrency(total)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden xl:sticky xl:top-6">
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

                        <div className="border-t border-slate-100 pt-4">
                            <p className="text-sm text-slate-600 mb-3">
                                O texto é definido automaticamente pelo serviço conforme existam faturas vencidas, próximas ou ambas.
                            </p>
                            <label className="mb-3 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs font-medium text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={reviewConfirmed}
                                    onChange={(event) => setReviewConfirmed(event.target.checked)}
                                    disabled={!selectedClients.length || sending}
                                    className="mt-0.5 size-4 shrink-0 accent-emerald-600"
                                />
                                Revisei os destinatários, telefones, valores e autorizo este envio.
                            </label>
                            <button
                                type="button"
                                onClick={sendBroadcast}
                                disabled={!connected || !selectedClients.length || !reviewConfirmed || sending || loading}
                                className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {sending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
                                {sending ? 'Enviando...' : `Enviar para ${selectedClients.length} cliente(s)`}
                            </button>
                            {!connected && <p className="text-xs text-center text-slate-400 mt-2">Conecte o WhatsApp para liberar o envio.</p>}
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

function SummaryCard({ label, value, warning = false }) {
    return (
        <div className={`rounded-xl border p-3 ${warning ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1 text-lg font-black ${warning ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
        </div>
    );
}
