import { useEffect, useState } from 'react';
import { X, MapPin, Phone, CreditCard, Building, User } from 'lucide-react';
import { getClientPrestacoes } from '../api/apiService';

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

export default function ClientModal({ isOpen, onClose, client, onPrestacaoClick }) {
    const [fullClient, setFullClient] = useState(null);
    const [prestacoes, setPrestacoes] = useState([]);
    const [prestacoesLoading, setPrestacoesLoading] = useState(false);
    const [prestacoesError, setPrestacoesError] = useState('');

    const codcli = client?.CODCLI;

    // Os hooks devem ser chamados incondicionalmente (regra oxlint react/rules-of-hooks),
    // por isso este useEffect vai antes do early-return do modal.
    useEffect(() => {
        if (!isOpen || !codcli) {
            setFullClient(null);
            setPrestacoes([]);
            setPrestacoesError('');
            return;
        }

        const controller = new AbortController();
        setPrestacoesLoading(true);
        setPrestacoesError('');

        getClientPrestacoes(codcli, { limit: 200, offset: 0 }, { signal: controller.signal })
            .then((data) => {
                if (controller.signal.aborted) return;
                setFullClient(data);
                setPrestacoes(data.prestacoes || []);
            })
            .catch((err) => {
                if (err.name !== 'AbortError') setPrestacoesError('Não foi possível carregar as prestações do cliente.');
            })
            .finally(() => {
                if (!controller.signal.aborted) setPrestacoesLoading(false);
            });

        return () => controller.abort();
    }, [isOpen, codcli]);

    if (!isOpen || !client) return null;

    const displayClient = fullClient || client;
    
    const totalVencido = prestacoes
        .filter((p) => getStatus(p) === 'Vencido')
        .reduce((sum, p) => sum + Number(p.VALOR || 0), 0);
    const totalPago = prestacoes
        .filter((p) => getStatus(p) === 'Pago')
        .reduce((sum, p) => sum + Number(p.VALOR || 0), 0);
    const totalAPagar = (prestacoes.reduce((sum, p) => sum + Number(p.VALOR || 0), 0))-totalPago;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-slate-900 p-6 flex justify-between items-start text-white relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 opacity-10">
                        <User size={150} />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="bg-blue-500/20 text-blue-200 text-xs font-bold px-3 py-1 rounded-full border border-blue-400/30">
                                Cód: {displayClient.CODCLI}
                            </span>
                        </div>
                        <h2 className="text-2xl font-extrabold tracking-tight">{displayClient.CLIENTE || 'Cliente sem nome'}</h2>
                    </div>

                    <button
                        onClick={onClose}
                        className="relative z-10 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Column 1 */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Informações Principais</h3>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                                            <CreditCard size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">Limite de Crédito</p>
                                            <p className="text-lg font-bold text-slate-900">{formatCurrency(displayClient.LIMCRED)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                                            <Building size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">CPF / CNPJ</p>
                                            <p className="font-semibold text-slate-800">{displayClient.CGCENT || 'Não informado'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contato & Endereço</h3>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
                                            <Phone size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">Telefone</p>
                                            <p className="font-semibold text-slate-800">{displayClient.TELENT || 'Não informado'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                                            <MapPin size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">Localização</p>
                                            <p className="font-semibold text-slate-800 leading-tight">
                                                {displayClient.ENDERENT ? `${displayClient.ENDERENT}` : 'Endereço não cadastrado'}
                                                <br />
                                                <span className="text-slate-500 text-sm font-normal">{displayClient.MUNICENT}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Observações */}
                    {displayClient.OBS && (
                        <div className="mt-5 pt-5 border-t border-slate-100">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Observações</h3>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 text-sm italic">
                                "{displayClient.OBS}"
                            </div>
                        </div>
                    )}

                    {/* Prestações */}
                    <div className="mt-5 pt-5 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prestações do Cliente</h3>
                            <div className="flex gap-3 text-xs font-semibold">
                                <span className="text-slate-600">Pago: <span className="text-green-600">{formatCurrency(totalPago)}</span></span>
                                <span className="text-slate-600">A receber: <span className="text-blue-600">{formatCurrency(totalAPagar)}</span></span>
                                <span className="text-slate-600">Vencido: <span className="text-rose-600">{formatCurrency(totalVencido)}</span></span>
                            </div>
                        </div>

                        {prestacoesError && (
                            <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800 text-sm font-medium mt-3">
                                {prestacoesError}
                            </p>
                        )}

                        {!prestacoesLoading && prestacoes.length > 0 && (
                            <div
                                className="overflow-x-auto overflow-y-auto max-h-72 mt-3 rounded-xl border border-slate-200
                   [&::-webkit-scrollbar]:w-1.5
                   [&::-webkit-scrollbar-track]:bg-slate-50
                   [&::-webkit-scrollbar-thumb]:bg-slate-300
                   [&::-webkit-scrollbar-thumb]:rounded-full
                   [&::-webkit-scrollbar-thumb:hover]:bg-slate-400"
                            >
                                <table className="w-full text-left text-xs sm:text-sm">
                                    <thead className="sticky top-0 bg-slate-50">
                                        <tr className="text-slate-500 border-b border-slate-200">
                                            <th className="px-3 py-2 font-semibold">Duplicata</th>
                                            <th className="px-3 py-2 font-semibold">Parc.</th>
                                            <th className="px-3 py-2 font-semibold">Valor</th>
                                            <th className="px-3 py-2 font-semibold">Vencimento</th>
                                            <th className="px-3 py-2 font-semibold">Cód. cob.</th>
                                            <th className="px-3 py-2 font-semibold">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {prestacoes.map((p, idx) => {
                                            const s = getStatus(p);
                                            return (
                                                <tr
                                                    key={`${p.DUPLIC}-${p.PREST ?? ''}-${p.CODFILIAL ?? ''}-${idx}`}
                                                    onClick={() => onPrestacaoClick?.(p)}
                                                    className={onPrestacaoClick ? 'transition-colors cursor-pointer hover:bg-slate-100' : 'transition-colors hover:bg-slate-50'}
                                                    title={onPrestacaoClick ? 'Ver detalhes da prestação' : undefined}
                                                >
                                                    <td className="px-3 py-2 font-medium text-slate-700">{p.DUPLIC}</td>
                                                    <td className="px-3 py-2 text-slate-600 font-medium">{p.PREST != null ? p.PREST : '—'}</td>
                                                    <td className="px-3 py-2 font-semibold text-slate-800">{formatCurrency(p.VALOR)}</td>
                                                    <td className="px-3 py-2 text-slate-700">{formatDate(p.DTVENC)}</td>
                                                    <td className="px-3 py-2 text-slate-700">{p.CODCOB || '—'}</td>
                                                    <td className="px-3 py-2">
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
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

