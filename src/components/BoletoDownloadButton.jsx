import { useState } from 'react';
import { AlertCircle, Download, LoaderCircle } from 'lucide-react';

import { getBoletoSicredi } from '../api/apiService';

const isSicredi = (prestacao) => String(prestacao?.CODCOB ?? '').trim() === '748';

function getFilename(contentDisposition, fallback) {
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1].replace(/["']/g, ''));
        } catch {
            return fallback;
        }
    }

    const basicMatch = contentDisposition.match(/filename=["']?([^;"']+)/i);
    return basicMatch?.[1] || fallback;
}

export default function BoletoDownloadButton({ prestacao, compact = false, onError }) {
    const [loading, setLoading] = useState(false);
    const [localError, setLocalError] = useState('');

    if (!isSicredi(prestacao)) return null;

    const linhaDigitavel = prestacao.LINHADIG || prestacao.linhaDigitavel;
    const unavailable = !linhaDigitavel;

    async function handleDownload(event) {
        event.stopPropagation();
        if (unavailable || loading) return;

        setLoading(true);
        setLocalError('');
        try {
            const { blob, contentDisposition } = await getBoletoSicredi(linhaDigitavel);
            const fallback = `boleto-${prestacao.DUPLIC}${prestacao.PREST ? `-${prestacao.PREST}` : ''}.pdf`;
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = getFilename(contentDisposition, fallback);
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
        } catch (error) {
            const message = error.message || 'Não foi possível baixar o boleto.';
            setLocalError(message);
            onError?.(message);
        } finally {
            setLoading(false);
        }
    }

    const title = unavailable
        ? 'A linha digitável não está disponível para esta prestação.'
        : localError || 'Baixar boleto Sicredi em PDF';

    return (
        <div className={compact ? 'inline-flex' : 'flex flex-col items-end gap-1'}>
            <button
                type="button"
                onClick={handleDownload}
                disabled={loading || unavailable}
                title={title}
                aria-label={title}
                className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    compact
                        ? 'p-1.5 text-blue-700 hover:bg-blue-50'
                        : 'px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                }`}
            >
                {loading
                    ? <LoaderCircle size={compact ? 16 : 18} className="animate-spin" />
                    : localError
                        ? <AlertCircle size={compact ? 16 : 18} />
                        : <Download size={compact ? 16 : 18} />}
                {!compact && (loading ? 'Gerando PDF...' : localError ? 'Tentar novamente' : 'Baixar boleto')}
            </button>
            {!compact && localError && !onError && (
                <span role="alert" className="max-w-72 text-right text-xs text-rose-700">{localError}</span>
            )}
        </div>
    );
}
