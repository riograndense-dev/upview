import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, ArrowRight, ShieldCheck, BarChart3, Users, Mail } from 'lucide-react';

export default function Home() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <header className="bg-white border-b border-slate-100 py-4 px-6 md:px-12 flex justify-between items-center">
                <div className="flex items-center gap-2 text-blue-600">
                    <LayoutDashboard size={28} />
                    <span className="text-xl font-bold text-slate-800 tracking-tight">Up<span className="text-blue-600">View</span></span>
                </div>
                <nav className="flex gap-4">
                    <Link to="/contato" className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-2">
                        <Mail size={16} />
                        Fale Conosco
                    </Link>
                    <Link to="/login" className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                        Entrar no Painel
                    </Link>
                </nav>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl opacity-30 pointer-events-none">
                    <div className="absolute top-20 left-0 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
                    <div className="absolute top-20 right-0 w-72 h-72 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
                    <div className="absolute -bottom-8 left-40 w-72 h-72 bg-rose-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>
                </div>

                <div className="relative z-10 max-w-3xl">
                    <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-8">
                        Gestão Financeira <br className="hidden md:block"/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500">
                            Inteligente e Clara
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                        Tenha o controle total dos seus clientes e recebíveis. Uma interface moderna para distribuidoras que buscam eficiência e resultados.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/dashboard" className="px-8 py-4 bg-blue-600 text-white rounded-xl font-medium text-lg hover:bg-blue-700 transition-all hover:shadow-lg hover:shadow-blue-600/20 flex items-center justify-center gap-2">
                            Acessar Dashboard
                            <ArrowRight size={20} />
                        </Link>
                    </div>
                </div>

                {/* Features */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mt-24 relative z-10">
                    <div className="bg-white p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col items-center text-center">
                        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                            <BarChart3 size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-3">Métricas em Tempo Real</h3>
                        <p className="text-slate-500">Visualize gráficos interativos e acompanhe o faturamento, prestações vencidas e a vencer.</p>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col items-center text-center transform md:-translate-y-4">
                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                            <Users size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-3">Gestão de Clientes</h3>
                        <p className="text-slate-500">Tenha o controle completo da sua carteira de clientes, limites de crédito e histórico.</p>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col items-center text-center">
                        <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mb-6">
                            <ShieldCheck size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-3">Seguro e Confiável</h3>
                        <p className="text-slate-500">Integrado diretamente com o seu ERP, garantindo dados precisos e sempre atualizados.</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
