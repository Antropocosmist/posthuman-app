import { useState, useEffect } from 'react'
import { LogOut, User, Mail, Shield, AlertTriangle, CheckCircle2, Cloud, Edit2, Wallet } from 'lucide-react'
import { auth } from '../config/firebase'
import {
    onAuthStateChanged,
    signInAnonymously,
    signInWithPopup,
    GoogleAuthProvider,
    GithubAuthProvider,
    TwitterAuthProvider,
    OAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile,
    signOut,
    linkWithPopup
} from 'firebase/auth'
import { useWalletStore } from '../store/walletStore'
import { AvatarSelectionModal } from '../components/AvatarSelectionModal'

export function Profile() {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin')

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
    const { trades, wallets } = useWalletStore()
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser)
            setLoading(false)
        })
        return () => unsubscribe()
    }, [])

    // Auto-login anonymously when wallet is connected
    useEffect(() => {
        if (wallets.length > 0 && !user && !loading) {
            const loginAnonymously = async () => {
                console.log("Wallet connected, signing in anonymously...")
                try {
                    await signInAnonymously(auth)
                } catch (error: any) {
                    console.error("Anon login failed:", error)
                    setMessage({ type: 'error', text: error.message })
                }
            }
            loginAnonymously()
        }
    }, [wallets, user, loading])

    const handleSocialLogin = async (providerName: 'google' | 'twitter' | 'github' | 'discord') => {
        let provider: any;
        if (providerName === 'google') provider = new GoogleAuthProvider();
        if (providerName === 'twitter') provider = new TwitterAuthProvider();
        if (providerName === 'github') provider = new GithubAuthProvider();
        if (providerName === 'discord') provider = new OAuthProvider('discord.com');

        try {
            await signInWithPopup(auth, provider);
            localStorage.setItem('posthuman_auth_redirect', 'true');
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        }
    }

    const handleSocialLink = async (providerName: 'twitter' | 'github' | 'discord') => {
        setLoading(true)
        if (!auth.currentUser) return;

        let provider: any;
        if (providerName === 'twitter') provider = new TwitterAuthProvider();
        if (providerName === 'github') provider = new GithubAuthProvider();
        if (providerName === 'discord') provider = new OAuthProvider('discord.com');

        try {
            await linkWithPopup(auth.currentUser, provider);
            setMessage({ type: 'success', text: `Linked ${providerName} successfully!` });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        }
        setLoading(false)
    }

    const handleUpdateAvatar = async (url: string) => {
        setLoading(true)
        if (!auth.currentUser) return;

        try {
            await updateProfile(auth.currentUser, { photoURL: url })
            setMessage({ type: 'success', text: "Avatar updated successfully!" })
            // React state will update via onAuthStateChanged listener eventually, 
            // but we might need to force refresh or set local state if listener is slow?
            // Usually onAuthStateChanged fires on token refresh, but updateProfile might not trigger it immediately.
            // We can manually update local user state.
            setUser({ ...auth.currentUser, photoURL: url })
        } catch (error: any) {
            setMessage({ type: 'error', text: "Failed to update avatar: " + error.message })
        }
        setLoading(false)
    }

    // Capture OAuth Errors (e.g. from X/Twitter redirect)
    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.substring(1)) // Handle hash routing params
        const errorDescription = params.get('error_description')
        const error = params.get('error')

        if (errorDescription || error) {
            setMessage({ type: 'error', text: errorDescription || error || "Authentication failed" })
            // Clean URL
            window.history.replaceState(null, '', window.location.pathname)
        }
    }, [])


    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            if (authMode === 'signup') {
                await createUserWithEmailAndPassword(auth, email.trim(), password)
                // Firebase automatically signs in.
                setMessage({ type: 'success', text: 'Account created!' })
            } else {
                await signInWithEmailAndPassword(auth, email.trim(), password)
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message })
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

        try {
            await sendPasswordResetEmail(auth, email.trim())
            setMessage({ type: 'success', text: 'Password reset link sent! Check your email.' })
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message })
        }
        setLoading(false)
    }

    const handleLogout = async () => {
        await signOut(auth)
    }

    // Firebase is always configured via static config
    // if (!isSupabaseConfigured()) checks removed

    if (loading) {
        return <div className="flex justify-center pt-40"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
    }

    // AUTHENTICATED VIEW
    if (user) {
        const userEmail = user.email || "Anonymous User"
        const userId = user.id ? user.id.slice(0, 8) : "Unknown"
        // @ts-ignore
        const connectedProviders = user.identities?.map((i: any) => i.provider) || []

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
                    <div className="relative group">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-xl overflow-hidden border-2 border-transparent group-hover:border-white/20 transition-all">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                user.email?.[0]?.toUpperCase() || <User />
                            )}
                        </div>
                        <button
                            onClick={() => setIsAvatarModalOpen(true)}
                            className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                            <Edit2 className="w-6 h-6 text-white" />
                        </button>
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

                {/* Messages */}
                {message && (
                    <div className={`mb-6 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${message.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                        {message.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                        {message.text}
                    </div>
                )}

                {/* Connected Accounts */}
                <div className="mb-8">
                    <h3 className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-4 px-2">Connected Accounts</h3>
                    <div className="space-y-3">

                        {/* X (Twitter) */}
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#14141b] border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
                                </div>
                                <span className="text-sm font-medium text-white">X (Twitter)</span>
                            </div>
                            {connectedProviders.includes('twitter') ? (
                                <span className="text-xs font-bold text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Connected</span>
                            ) : (
                                <button onClick={() => handleSocialLink('twitter')} className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors">
                                    Connect
                                </button>
                            )}
                        </div>

                        {/* GitHub */}
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#14141b] border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                                </div>
                                <span className="text-sm font-medium text-white">GitHub</span>
                            </div>
                            {connectedProviders.includes('github') ? (
                                <span className="text-xs font-bold text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Connected</span>
                            ) : (
                                <button onClick={() => handleSocialLink('github')} className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors">
                                    Connect
                                </button>
                            )}
                        </div>

                        {/* Discord */}
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#14141b] border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.085 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.085 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" /></svg>
                                </div>
                                <span className="text-sm font-medium text-white">Discord</span>
                            </div>
                            {connectedProviders.includes('discord') ? (
                                <span className="text-xs font-bold text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Connected</span>
                            ) : (
                                <button onClick={() => handleSocialLink('discord')} className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors">
                                    Connect
                                </button>
                            )}
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

                <AvatarSelectionModal
                    isOpen={isAvatarModalOpen}
                    onClose={() => setIsAvatarModalOpen(false)}
                    onSelect={handleUpdateAvatar}
                    currentAvatar={user.user_metadata?.avatar_url}
                />
            </div>
        )
    }

    // LOGIN / SIGNUP VIEW
    return (
        <div className="max-w-md mx-auto pt-8 pb-20 px-4">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Posthuman ID</h1>
                <p className="text-gray-400 text-sm">One account for the entire interchain.</p>
                <span className="text-[10px] text-gray-700 block mt-2 font-mono">v1.2</span>
            </div>

            <div className="p-6 rounded-3xl bg-[#14141b] border border-white/5 backdrop-blur-xl shadow-2xl">
                {/* Social Logins */}
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {/* Google */}
                    <button onClick={() => handleSocialLogin('google')} className="flex items-center justify-center p-3 w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 hover:scale-105 transition-all text-white border border-white/5 shadow-lg">
                        <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.96h6.39c-.44 2.15-2.26 3.48-5.24 3.48-3.55 0-6.42-2.81-6.42-6.42s2.88-6.42 6.42-6.42c1.61 0 3.09.59 4.23 1.57l2.14-2.14C18.42 2.7 16.54 2 14.58 2 8.74 2 4 6.74 4 12.58S8.74 23.16 14.58 23.16c6.43 0 10.16-4.59 9.8-10.99-.02-.45-.09-.76-.09-.76z" /></svg>
                    </button>

                    {/* Wallet */}
                    <button onClick={() => useWalletStore.getState().toggleModal()} className="flex items-center justify-center p-3 w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 hover:scale-105 transition-all text-white border border-white/5 shadow-lg">
                        <Wallet className="w-5 h-5 text-blue-400" />
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
    )
}
