import { useState, useEffect } from 'react'
import { LogOut, User, Mail, Github, Twitter, Shield, AlertTriangle, CheckCircle2, Cloud, Wallet } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../services/supa'
import { useWalletStore } from '../store/walletStore'

export function Profile() {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    export function Profile() {
        const [user, setUser] = useState<any>(null)
        const [loading, setLoading] = useState(true)
        const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin')
        const [email, setEmail] = useState('')
        const [password, setPassword] = useState('')
        const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
        const { trades, wallets } = useWalletStore()

        // ... (useEffect hooks remain the same, skipped for brevity in replacement if possible, but replace_file_content needs context. 
        // I will target the specific blocks to minimize changes, but the tool requires contiguous blocks. 
        // Since I'm changing the state definition and adding a handler, it might be cleaner to replace the logic parts.
        // However, the file is large. Let's try to do it in chunks using multi_replace if I can, but I only have replace_file_content available as per instructions "Use this tool ONLY when you are making a SINGLE CONTIGUOUS block...". Wait, I have multi_replace available in the declaration.
        // Actually, I can just replace the component body parts.

        // Let's stick to replace_file_content for the upper part (state) and the form part.
        // Actually, I need to use `multi_replace_file_content` because the changes are in state def (top) and render (bottom).

        // Wait, I will use `multi_replace_file_content`.

        /* 
           Plan with multi_replace:
           1. Update useState definition.
           2. Add handlePasswordReset function.
           3. Update Render logic to handle 'reset' mode.
        */

        return (
       // ...
    )
    }

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
    const { trades, wallets } = useWalletStore()

    useEffect(() => {
        if (!isSupabaseConfigured()) {
            setLoading(false)
            return
        }

        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            setLoading(false)
        }).catch(err => {
            console.error("Session check failed:", err)
            setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [])

    // Auto-login anonymously when wallet is connected (if not already logged in)
    useEffect(() => {
        if (wallets.length > 0 && !user && !loading && isSupabaseConfigured()) {
            const loginAnonymously = async () => {
                console.log("Wallet connected, signing in anonymously...")
                const { error } = await supabase.auth.signInAnonymously()
                if (error) {
                    console.error("Anon login failed:", error)
                    setMessage({ type: 'error', text: error.message })
                }
            }
            loginAnonymously()
        }
    }, [wallets, user, loading])

    const handleSocialLogin = async (provider: 'google' | 'apple' | 'twitter' | 'github' | 'discord') => {
        if (!isSupabaseConfigured()) {
            setMessage({ type: 'error', text: 'Cloud sync is not configured (Missing API Keys).' })
            return
        }
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`
            }
        })
        if (!error) {
            localStorage.setItem('posthuman_auth_redirect', 'true')
        }
        if (error) setMessage({ type: 'error', text: error.message })
    }

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isSupabaseConfigured()) {
            setMessage({ type: 'error', text: 'Cloud sync is not configured.' })
            return
        }

        setLoading(true)
        setMessage(null)

        if (authMode === 'signup') {
            const { error } = await supabase.auth.signUp({ email: email.trim(), password })
            if (error) setMessage({ type: 'error', text: error.message })
            else setMessage({ type: 'success', text: 'Check your email for the confirmation link!' })
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
            if (error) {
                let msg = error.message
                if (msg.includes("Invalid login credentials")) {
                    msg += " (Did you Sign Up first? OAuth accounts need a separate password set.)"
                }
                setMessage({ type: 'error', text: msg })
            }
        }
        setLoading(false)
    }

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) {
            setMessage({ type: 'error', text: 'Please enter your email address.' })
            return
        }
        setLoading(true)
        setMessage(null)

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}#/profile?reset=true`,
        })

        if (error) {
            setMessage({ type: 'error', text: error.message })
        } else {
            setMessage({ type: 'success', text: 'Password reset link sent! Check your email.' })
        }
        setLoading(false)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
    }

    if (!isSupabaseConfigured()) {
        return (
            <div className="max-w-md mx-auto pt-20 px-4 text-center">
                <div className="bg-[#14141b] border border-white/5 rounded-3xl p-8">
                    <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Cloud Sync Not Configured</h2>
                    <p className="text-gray-400 text-sm mb-6">
                        The application is missing Supabase credentials. Cloud sync and profiles are currently disabled.
                    </p>
                    <div className="text-xs text-gray-500 font-mono bg-black/50 p-4 rounded-xl">
                        VITE_SUPABASE_URL<br />
                        VITE_SUPABASE_ANON_KEY
                    </div>
                </div>
            </div>
        )
    }

    if (loading) {
        return <div className="flex justify-center pt-40"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
    }

    // AUTHENTICATED VIEW
    if (user) {
        const userEmail = user.email || "Anonymous User"
        const userId = user.id ? user.id.slice(0, 8) : "Unknown"

        return (
            <div className="max-w-md mx-auto pt-8 pb-20 px-4">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-white tracking-tight">Profile</h1>
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-red-400 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>

                {/* User Card */}
                <div className="p-6 rounded-3xl bg-[#14141b] border border-white/5 backdrop-blur-xl mb-6 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-xl">
                        {user.email?.[0]?.toUpperCase() || <User />}
                    </div>
                    <div>
                        <div className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Signed in as</div>
                        <div className="text-white font-bold truncate max-w-[200px]">{userEmail}</div>
                        <div className="flex items-center gap-2 mt-2 text-[10px] font-black uppercase tracking-widest text-green-400">
                            <Cloud className="w-3 h-3" />
                            Sync Active
                        </div>
                    </div>
                </div>

                {/* Account Stats */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-5 rounded-[2rem] bg-[#14141b] border border-white/5">
                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Trades</div>
                        <div className="text-2xl font-bold text-white">{trades.length}</div>
                    </div>
                    <div className="p-5 rounded-[2rem] bg-[#14141b] border border-white/5">
                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Account ID</div>
                        <div className="text-xs font-mono text-gray-400 truncate">#{userId}</div>
                    </div>
                </div>
            </div>
        )
    }

    // LOGIN / SIGNUP VIEW
    return (
        <div className="max-w-md mx-auto pt-8 pb-20 px-4">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Posthuman ID</h1>
                <p className="text-gray-400 text-sm">One account for the entire interchain.</p>
            </div>

            <div className="p-6 rounded-3xl bg-[#14141b] border border-white/5 backdrop-blur-xl shadow-2xl">
                {/* Social Logins */}
                <div className="grid grid-cols-4 gap-3 mb-8">
                    <button onClick={() => handleSocialLogin('google')} className="flex items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 hover:scale-105 transition-all text-white border border-white/5">
                        <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.96h6.39c-.44 2.15-2.26 3.48-5.24 3.48-3.55 0-6.42-2.81-6.42-6.42s2.88-6.42 6.42-6.42c1.61 0 3.09.59 4.23 1.57l2.14-2.14C18.42 2.7 16.54 2 14.58 2 8.74 2 4 6.74 4 12.58S8.74 23.16 14.58 23.16c6.43 0 10.16-4.59 9.8-10.99-.02-.45-.09-.76-.09-.76z" /></svg>
                    </button>
                    <button onClick={() => handleSocialLogin('twitter')} className="flex items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 hover:scale-105 transition-all text-white border border-white/5">
                        <Twitter className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleSocialLogin('github')} className="flex items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 hover:scale-105 transition-all text-white border border-white/5">
                        <Github className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleSocialLogin('discord')} className="flex items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 hover:scale-105 transition-all text-white border border-white/5">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.085 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.085 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" /></svg>
                    </button>
                    <button onClick={() => useWalletStore.getState().toggleModal()} className="flex items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 hover:scale-105 transition-all text-white border border-white/5 col-span-4 gap-2">
                        <Wallet className="w-5 h-5 text-blue-400" />
                        <span className="text-xs font-bold uppercase tracking-wider">Continue with Wallet</span>
                    </button>
                </div>

                <div className="relative mb-8">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#14141b] px-4 text-gray-500 font-bold tracking-widest">Or with email</span></div>
                </div>

                <form onSubmit={authMode === 'reset' ? handlePasswordReset : handleEmailAuth} className="space-y-4">
                    <div className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="email"
                                placeholder="Email address"
                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:border-blue-500/50 transition-colors font-medium outline-none"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        {authMode !== 'reset' && (
                            <div className="relative">
                                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:border-blue-500/50 transition-colors font-medium outline-none"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (authMode === 'signin' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Send Reset Link')}
                    </button>

                    {authMode === 'signin' && (
                        <button
                            type="button"
                            onClick={() => { setAuthMode('reset'); setMessage(null); }}
                            className="w-full text-center text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            Forgot Password?
                        </button>
                    )}
                </form>

                {message && (
                    <div className={`mt-4 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${message.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                        {message.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                        {message.text}
                    </div>
                )}

                <div className="mt-6 text-center">
                    <div className="mt-6 text-center">
                        <button
                            onClick={() => {
                                if (authMode === 'reset') setAuthMode('signin');
                                else setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                                setMessage(null);
                            }}
                            className="text-xs text-gray-400 hover:text-white font-bold transition-colors"
                        >
                            {authMode === 'reset' ? "Back to Sign In" : (authMode === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
