import { useState, useEffect } from 'react'
import { Moon, Sun, Globe, DollarSign } from 'lucide-react'

type Theme = 'dark' | 'light'
type Language = 'en' | 'es' | 'de' | 'ja' | 'fr' | 'pt' | 'ru' | 'it' | 'zh' | 'ko'
type Currency = 'USD' | 'EUR' | 'RUB' | 'GBP' | 'JPY' | 'CNY' | 'KRW' | 'BRL' | 'INR' | 'AUD'

const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
    { code: 'fr', name: 'French' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'it', name: 'Italian' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ko', name: 'Korean' },
]

const CURRENCIES = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'KRW', name: 'Korean Won', symbol: '₩' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
]

export function Settings() {
    const [theme, setTheme] = useState<Theme>(() => {
        return (localStorage.getItem('posthuman_theme') as Theme) || 'dark'
    })
    const [language, setLanguage] = useState<Language>(() => {
        return (localStorage.getItem('posthuman_language') as Language) || 'en'
    })
    const [currency, setCurrency] = useState<Currency>(() => {
        return (localStorage.getItem('posthuman_currency') as Currency) || 'USD'
    })

    useEffect(() => {
        localStorage.setItem('posthuman_theme', theme)
        // Apply theme to document
        if (theme === 'dark') {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [theme])

    useEffect(() => {
        localStorage.setItem('posthuman_language', language)
    }, [language])

    useEffect(() => {
        localStorage.setItem('posthuman_currency', currency)
    }, [currency])

    return (
        <div className="max-w-2xl mx-auto pt-8 pb-20 px-4">
            <h1 className="text-3xl font-bold text-white tracking-tight mb-8">Settings</h1>

            {/* Theme Section */}
            <div className="mb-8 p-6 rounded-3xl bg-[#14141b] border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                        {theme === 'dark' ? <Moon className="w-5 h-5 text-purple-400" /> : <Sun className="w-5 h-5 text-yellow-400" />}
                    </div>
                    <h2 className="text-xl font-bold text-white">Theme</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setTheme('dark')}
                        className={`p-4 rounded-2xl border transition-all ${theme === 'dark'
                            ? 'bg-purple-600/20 border-purple-500 text-white'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                            }`}
                    >
                        <Moon className="w-6 h-6 mx-auto mb-2" />
                        <span className="text-sm font-medium">Dark</span>
                    </button>
                    <button
                        onClick={() => setTheme('light')}
                        className={`p-4 rounded-2xl border transition-all ${theme === 'light'
                            ? 'bg-purple-600/20 border-purple-500 text-white'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                            }`}
                    >
                        <Sun className="w-6 h-6 mx-auto mb-2" />
                        <span className="text-sm font-medium">Light</span>
                    </button>
                </div>
            </div>

            {/* Language Section */}
            <div className="mb-8 p-6 rounded-3xl bg-[#14141b] border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Language</h2>
                </div>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-white focus:border-purple-500 focus:outline-none transition-colors"
                >
                    {LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code} className="bg-[#14141b]">
                            {lang.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Currency Section */}
            <div className="mb-8 p-6 rounded-3xl bg-[#14141b] border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-green-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Currency</h2>
                </div>
                <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-white focus:border-purple-500 focus:outline-none transition-colors"
                >
                    {CURRENCIES.map((curr) => (
                        <option key={curr.code} value={curr.code} className="bg-[#14141b]">
                            {curr.name} ({curr.symbol})
                        </option>
                    ))}
                </select>
            </div>

            {/* Info */}
            <div className="text-center text-gray-500 text-sm">
                <p>Settings are saved automatically</p>
            </div>
        </div>
    )
}
