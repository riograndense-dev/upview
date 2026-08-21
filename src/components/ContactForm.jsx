import React from 'react';
import { Send, Mail, Building, User } from 'lucide-react';
import { sendMail } from '../api/apiService';

export default function ContactForm() {
    const [nome, setNome] = React.useState('');
    const [empresa, setEmpresa] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [mensagem, setMensagem] = React.useState('');

    const [submitting, setSubmitting] = React.useState(false);
    const [feedback, setFeedback] = React.useState('');

    const isFormValid =
        nome.trim().length >= 2 &&
        email.trim().length > 0 &&
        mensagem.trim().length >= 10 &&
        mensagem.trim().length <= 4000;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFormValid || submitting) return;

        setSubmitting(true);
        setFeedback('');

        try {
            await sendMail({
                nome: nome.trim(),
                empresa: empresa.trim() || null,
                email: email.trim(),
                mensagem: mensagem.trim(),
            });
            setFeedback('Mensagem enviada com sucesso! Entraremos em contato em breve.');
            setNome('');
            setEmpresa('');
            setEmail('');
            setMensagem('');
        } catch (err) {
            setFeedback(err?.message || 'Não foi possível enviar a mensagem. Tente novamente.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <header className="bg-white border-b border-slate-100 py-4 px-6 md:px-12">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-3xl font-bold text-slate-900">Fale Conosco</h1>
                    <p className="text-slate-500 mt-1">
                        Envie sua dúvida ou sugestão e nossa equipe entrará em contato.
                    </p>
                </div>
            </header>

            <main className="flex-1 flex justify-center py-12 px-6 md:px-12">
                <div className="w-full max-w-2xl">
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 md:p-10">
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {feedback && (
                                <p
                                    role={feedback.includes('sucesso') ? 'status' : 'alert'}
                                    className={`rounded-xl p-4 text-sm ${
                                        feedback.includes('sucesso')
                                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                                    }`}
                                >
                                    {feedback}
                                </p>
                            )}

                            {/* Nome */}
                            <div>
                                <label htmlFor="nome" className="block text-sm font-medium text-slate-700 mb-1">
                                    Nome *
                                </label>
                                <div className="relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        id="nome"
                                        type="text"
                                        value={nome}
                                        maxLength={120}
                                        minLength={2}
                                        required
                                        onChange={(e) => setNome(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50/50"
                                        placeholder="Seu nome completo"
                                    />
                                </div>
                            </div>

                            {/* Empresa */}
                            <div>
                                <label htmlFor="empresa" className="block text-sm font-medium text-slate-700 mb-1">
                                    Empresa
                                </label>
                                <div className="relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Building className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        id="empresa"
                                        type="text"
                                        value={empresa}
                                        maxLength={120}
                                        onChange={(e) => setEmpresa(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50/50"
                                        placeholder="Nome da sua empresa (opcional)"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                                    E-mail *
                                </label>
                                <div className="relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        required
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50/50"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>

                            {/* Mensagem */}
                            <div>
                                <label htmlFor="mensagem" className="block text-sm font-medium text-slate-700 mb-1">
                                    Mensagem *
                                </label>
                                <textarea
                                    id="mensagem"
                                    value={mensagem}
                                    maxLength={4000}
                                    minLength={10}
                                    required
                                    rows={6}
                                    onChange={(e) => setMensagem(e.target.value)}
                                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50/50 resize-none"
                                    placeholder="Conte sua dúvida ou sugestão (mínimo 10 caracteres)..."
                                />
                                <div className="mt-1 flex justify-between text-xs text-slate-500">
                                    <span>Mínimo 10 caracteres</span>
                                    <span className={mensagem.length > 3800 ? 'text-rose-500' : ''}>{mensagem.length}/4000</span>
                                </div>
                            </div>

                            {/* Submit */}
                            <div>
                                <button
                                    type="submit"
                                    disabled={!isFormValid || submitting}
                                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all hover:shadow-lg hover:shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Enviando...' : 'Enviar Mensagem'}
                                    <Send size={18} />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}
