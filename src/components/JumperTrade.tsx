import { LiFiWidget } from '@lifi/widget'
import type { WidgetConfig } from '@lifi/widget'

const widgetConfig: WidgetConfig = {
    integrator: 'posthuman-app',
    variant: 'drawer', // Retrying with 'drawer' or we can omit it. Let's try 'drawer' or check docs if possible. 
    // Actually, let's just omit 'variant' to be safe if 'expandable' failed.
    appearance: 'dark',
    theme: {
        container: {
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
        },
        palette: {
            primary: { main: '#3b82f6' }, // Blue-500 matching app theme
            secondary: { main: '#a855f7' }, // Purple-500
        },
    },
}

export function JumperTrade() {
    return (
        <div className="w-full max-w-[480px] mx-auto mt-4 px-2">
            <LiFiWidget config={widgetConfig} integrator="posthuman-app" />
        </div>
    )
}
