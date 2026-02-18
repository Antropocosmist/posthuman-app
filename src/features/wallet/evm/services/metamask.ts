/**
 * MetaMask & Generic EVM Wallet Provider
 * Dependencies: ethers
 *
 * Handles:
 *   - connect(): EVM multi-chain discovery via window.ethereum
 *   - sendTransaction(): EVM native + ERC20 sends
 */

import { RpcService } from '../../../../shared/services/rpc'
import { PriceService } from '../../../../shared/services/price'
import type { ConnectedWallet } from '../../types/wallet.types'
import { EVM_CHAINS, ERC20_TOKENS } from '../../types/wallet.types'

const BASE_URL = import.meta.env.BASE_URL

export const MetaMaskService = {

    // ----------------------------------------------------------------
    // connect() — EVM multi-chain via window.ethereum
    // ----------------------------------------------------------------
    async connect(walletName: string): Promise<ConnectedWallet[]> {
        if (typeof window.ethereum === 'undefined') {
            alert('No EVM wallet detected!')
            return []
        }

        const prices = await PriceService.getPrices()
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
        const address = accounts[0]
        const wallets: ConnectedWallet[] = []

        for (const chainCfg of EVM_CHAINS) {
            try {
                const nativeBal = await RpcService.getBalance(chainCfg.rpc, address)
                if (nativeBal > 0) {
                    wallets.push({
                        id: `${walletName}-${chainCfg.name}-${address.substr(-4)}`,
                        name: `${chainCfg.name} (${walletName})`,
                        chain: 'EVM',
                        address,
                        icon: `${BASE_URL}icons/metamask.png`,
                        balance: nativeBal * (prices[chainCfg.symbol] || 0),
                        nativeBalance: nativeBal,
                        symbol: chainCfg.symbol,
                        chainId: chainCfg.id,
                        walletProvider: walletName
                    })
                }

                for (const token of ERC20_TOKENS) {
                    const contract = (token.contracts as any)[chainCfg.id]
                    if (contract) {
                        const tokenBal = await RpcService.getErc20Balance(chainCfg.rpc, contract, address)
                        if (tokenBal > 0) {
                            wallets.push({
                                id: `${token.symbol}-${chainCfg.name}-${address.substr(-4)}`,
                                name: `${token.symbol} on ${chainCfg.name}`,
                                chain: 'EVM',
                                address,
                                icon: `${BASE_URL}icons/metamask.png`,
                                balance: tokenBal * (prices[token.symbol] || 1),
                                nativeBalance: tokenBal,
                                symbol: token.symbol,
                                chainId: chainCfg.id,
                                walletProvider: walletName
                            })
                        }
                    }
                }
            } catch (e) {
                console.error(`[MetaMask] Failed discovery for ${chainCfg.name}:`, e)
            }
        }

        return wallets
    },

    // ----------------------------------------------------------------
    // sendTransaction() — EVM native + ERC20
    // ----------------------------------------------------------------
    async sendTransaction(wallet: ConnectedWallet, recipient: string, amount: string): Promise<string> {
        const { ethers } = await import('ethers')

        const web3Provider = (window as any).ethereum
        if (!web3Provider) throw new Error('No EVM provider found')

        const targetChainId = wallet.chainId || '0x1'
        const currentChainIdHex = await web3Provider.request({ method: 'eth_chainId' })

        if (currentChainIdHex !== targetChainId) {
            try {
                await web3Provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetChainId }] })
            } catch (switchError: any) {
                if (switchError.code === 4902) {
                    throw new Error(`Please add the correct network to your wallet.`)
                }
                throw switchError
            }
        }

        const provider = new ethers.BrowserProvider(web3Provider)
        const signer = await provider.getSigner()

        if (wallet.symbol === 'USDC' || wallet.symbol === 'USDT') {
            const token = ERC20_TOKENS.find(t => t.symbol === wallet.symbol)
            const contractAddr = (token?.contracts as any)[targetChainId]
            if (!contractAddr) throw new Error(`Contract address not found for ${wallet.symbol} on this chain`)
            const abi = ['function transfer(address, uint256) returns (bool)', 'function decimals() view returns (uint8)']
            const contract = new ethers.Contract(contractAddr, abi, signer)
            const decimals = await contract.decimals().catch(() => 6)
            const tx = await contract.transfer(recipient, ethers.parseUnits(amount.toString(), decimals))
            return tx.hash
        }

        try {
            const tx = await signer.sendTransaction({
                to: recipient,
                value: ethers.parseUnits(amount.toString(), 18),
                gasLimit: 21000
            })
            return tx.hash
        } catch (err: any) {
            if (err.code === 'INSUFFICIENT_FUNDS' || err.message?.toLowerCase().includes('insufficient funds')) {
                throw new Error(`Insufficient ${wallet.symbol} for transaction + gas fees.`)
            }
            throw err
        }
    }
}
