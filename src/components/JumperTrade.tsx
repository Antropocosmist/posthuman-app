import { useState, useEffect } from 'react'
import { LiFiWidget, useWidgetEvents, WidgetEvent } from '@lifi/widget'
import type { WidgetConfig, Route } from '@lifi/widget'
import { TradeHistory } from './TradeHistory'
import { useWalletStore } from '../store/walletStore'

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
    const addTrade = useWalletStore(state => state.addTrade)
    const widgetEvents = useWidgetEvents()

    useEffect(() => {
        const onRouteExecutionCompleted = (route: Route) => {
            if (route) {
                const step = route.steps[0] as any

                addTrade({
                    id: route.id,
                    timestamp: Date.now(),
                    sourceAsset: {
                        symbol: step.action.fromToken.symbol,
                        logo: step.action.fromToken.logoURI || '',
                        amount: (Number(step.action.fromAmount) / Math.pow(10, step.action.fromToken.decimals)).toString(),
                        chainId: step.action.fromChainId.toString()
                    },
                    destAsset: {
                        symbol: step.action.toToken.symbol,
                        logo: step.action.toToken.logoURI || '',
                        amount: (Number(step.execution?.toAmount || step.estimate.toAmount) / Math.pow(10, step.action.toToken.decimals)).toString(),
                        chainId: step.action.toChainId.toString()
                    },
                    usdValue: Number(route.toAmountUSD),
                    status: 'completed',
                    txHash: step.execution?.process.find((p: any) => p.type === 'CROSS_CHAIN' || p.type === 'SWAP')?.txHash
                })
                console.log("✅ Jumper Trade Captured via Event:", route.id)
            }
        }

        widgetEvents.on(WidgetEvent.RouteExecutionCompleted, onRouteExecutionCompleted)

        return () => {
            widgetEvents.off(WidgetEvent.RouteExecutionCompleted, onRouteExecutionCompleted)
        }
    }, [widgetEvents, addTrade])

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
