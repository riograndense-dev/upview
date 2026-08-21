import React from 'react';
import {
    X, Hash, User, DollarSign, Calendar, CalendarCheck,
    CalendarX, CreditCard, Building2, UserCheck, MessageSquare, Pencil
} from 'lucide-react';

const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatDate = (value) =>
    value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';

function getStatus(prestacao) {
    if (prestacao.DTBAIXA) return 'Pago';
    if (prestacao.DTVENC && new Date(`${prestacao.DTVENC.slice(0, 10)}T12:00:00`) < new Date(new Date().setHours(0, 0, 0, 0)))
        return 'Vencido';
    return 'A vencer';
}

const STATUS_STYLES = {
    Pago:      'bg-emerald-100 text-emerald-700 border-emerald-200',
    Vencido:   'bg-rose-100    text-rose-700    border-rose-200',
    'A vencer':'bg-amber-100   text-amber-700   border-amber-200',
};

function Field({ icon: Icon, iconClass, label, value }) {
    return (
        <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${iconClass}`}>
                <Icon size={16} />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="font-semibold text-slate-800 text-sm mt-0.5">{value || '—'}</p>
            </div>
        </div>
    );
}

export default function PrestacaoModal({ isOpen, onClose, prestacao, onEditObservacao }) {
    if (!isOpen || !prestacao) return null;

    const status = getStatus(prestacao);
    const statusStyle = STATUS_STYLES[status];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-slate-900 p-6 flex justify-between items-start text-white relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 opacity-10">
                        <Hash size={140} />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="bg-blue-500/20 text-blue-200 text-xs font-bold px-3 py-1 rounded-full border border-blue-400/30">
                                Duplicata #{prestacao.DUPLIC}
                            </span>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusStyle}`}>
                                {status}
                            </span>
                        </div>
                        <h2 className="text-xl font-extrabold tracking-tight">
                            {prestacao.CLIENTE || 'Cliente não identificado'}
                        </h2>
                        <p className="text-slate-400 text-sm mt-0.5">Cód. cliente: {prestacao.CODCLI ?? '—'}</p>
                    </div>

                    <button
                        onClick={onClose}
                        className="relative z-10 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                        aria-label="Fechar modal"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Valor em destaque */}
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Valor total</p>
                        <p className="text-2xl font-black text-slate-900">{formatCurrency(prestacao.VALOR)}</p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field
                        icon={Hash}
                        iconClass="bg-purple-50 text-purple-600"
                        label="Código da prestação"
                        value={prestacao.DUPLIC}
                    />
                    <Field
                        icon={Hash}
                        iconClass="bg-indigo-50 text-indigo-600"
                        label="Código da parcela"
                        value={prestacao.DUPLIC}
                    />
                    <Field
                        icon={User}
                        iconClass="bg-cyan-50 text-cyan-600"
                        label="Cliente"
                        value={prestacao.CLIENTE || 'Cliente não identificado'}
                    />
                    <Field
                        icon={Calendar}
                        iconClass="bg-amber-50 text-amber-600"
                        label="Vencimento"
                        value={formatDate(prestacao.DTVENC)}
                    />
                    <Field
                        icon={CalendarCheck}
                        iconClass="bg-slate-100 text-slate-500"
                        label="Emissão"
                        value={formatDate(prestacao.DTEMISSAO)}
                    />
                    <Field
                        icon={CalendarX}
                        iconClass="bg-emerald-50 text-emerald-600"
                        label="Data de baixa"
                        value={formatDate(prestacao.DTBAIXA)}
                    />
                    <Field
                        icon={CreditCard}
                        iconClass="bg-violet-50 text-violet-600"
                        label="Cód. cobrança"
                        value={prestacao.CODCOB}
                    />
                    <Field
                        icon={Building2}
                        iconClass="bg-sky-50 text-sky-600"
                        label="Filial"
                        value={prestacao.CODFILIAL}
                    />
                    <Field
                        icon={UserCheck}
                        iconClass="bg-rose-50 text-rose-600"
                        label="Cód. vendedor"
                        value={prestacao.CODUSUR}
                    />
                </div>

                {/* Observação */}
                <div className="px-6 pb-2">
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center gap-2 text-slate-600">
                                <MessageSquare size={15} />
                                <span className="text-xs font-semibold uppercase tracking-wide">Observação</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => onEditObservacao(prestacao)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                            >
                                <Pencil size={13} />
                                {prestacao.OBS ? 'Editar' : 'Adicionar'}
                            </button>
                        </div>
                        <div className="px-4 py-3 min-h-[56px]">
                            {prestacao.OBS
                                ? <p className="text-sm text-slate-700 italic">"{prestacao.OBS}"</p>
                                : <p className="text-sm text-slate-400 italic">Nenhuma observação registrada.</p>
                            }
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 flex justify-end">
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
