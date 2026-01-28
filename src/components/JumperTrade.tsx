import { useState } from 'react'
import { LiFiWidget } from '@lifi/widget'
import type { WidgetConfig } from '@lifi/widget'
import { TradeHistory } from './TradeHistory'

const widgetConfig: WidgetConfig = {
    integrator: 'posthuman-app',
    appearance: 'dark',
    theme: {
        container: {
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
        },
        palette: {
            primary: { main: '#3b82f6' },
            secondary: { main: '#a855f7' },
        },
    },
}

export function JumperTrade() {
    const [activeTab, setActiveTab] = useState<'swap' | 'history'>('swap')

    return (
        <div className="w-full max-w-[480px] mx-auto mt-4 px-2">
            {/* Toggle Header */}
            <div className="flex items-center justify-end mb-4">
                <div className="flex p-1 bg-white/5 rounded-full border border-white/5">
                    <button
                        onClick={() => setActiveTab('swap')}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'swap' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Swap
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        History
                    </button>
                </div>
            </div>

            {activeTab === 'swap' ? (
                <div className="h-[640px]">
                    <LiFiWidget config={widgetConfig} integrator="posthuman-app" />
                </div>
            ) : (
                <TradeHistory />
            )}
        </div>
    )
}
