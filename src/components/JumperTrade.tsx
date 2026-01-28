import { LiFiWidget } from '@lifi/widget'
import type { WidgetConfig } from '@lifi/widget'

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
    return (
        <div className="w-full max-w-[480px] mx-auto mt-4 px-2 h-[640px]">
            <LiFiWidget config={widgetConfig} integrator="posthuman-app" />
        </div>
    )
}
