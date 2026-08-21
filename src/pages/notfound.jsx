import { Link } from 'react-router-dom';
import { Ghost, Home } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
            <div className="bg-white p-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 max-w-lg w-full flex flex-col items-center">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-8">
                    <Ghost size={48} strokeWidth={1.5} />
                </div>
                
                <h1 className="text-6xl font-extrabold text-slate-900 tracking-tight mb-4">404</h1>
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Página não encontrada</h2>
                <p className="text-slate-500 mb-8 max-w-md">
                    Ops! Parece que o caminho que você tentou acessar não existe ou foi movido.
                </p>
                
                <Link 
                    to="/" 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all shadow-sm hover:shadow-lg hover:shadow-blue-600/20"
                >
                    <Home size={20} />
                    Voltar para o Início
                </Link>
            </div>
        </div>
    );
}
