import { corsFetch } from '@/sdk/scrape'
import { formatUnits, parseUnits, type Address, type Hex } from 'viem'

// https://0x.org/docs/0x-swap-api/api-references/get-swap-v1-quote#response
type ZeroXSwapQuote = {
    chainId: number
    price: string
    grossPrice: string
    estimatedPriceImpact: string
    value: string
    gasPrice: string
    gas: string
    estimatedGas: string
    protocolFee: string
    minimumProtocolFee: string
    buyTokenAddress: string
    buyAmount: string
    grossBuyAmount: string
    sellTokenAddress: string
    sellAmount: string
    grossSellAmount: string
    sources: Array<{
        name: string
        proportion: string
    }>
    allowanceTarget: string
    sellTokenToEthRate: string
    buyTokenToEthRate: string
    to: Address
    from: Address
    data: Hex
    decodedUniqueId: Hex
    guaranteedPrice: string
    orders: any[]
    fees: {
        zeroExFee: null
    }
    auxiliaryChainData: {
        l1GasEstimate: number
    }
}
// https://0x.org/docs/0x-swap-api/api-references/get-swap-v1-price#response
type ZeroXSwapPrice = Omit<ZeroXSwapQuote, 'orders' | 'guaranteedPrice' | 'to' | 'data'>

const FEE_RECIPIENT = '0xeE15d275dbC6392019FCdE476d4A6f000F76F6A9'
const AFFILIATE_FEE = 0.01

const get0xApiBase = (networkId: number) => {
    const CHAIN_ID_0X_API_BASE_MAP: Record<number, string> = {
        1: 'api.0x.org',
        10: 'optimism.api.0x.org',
        8453: 'base.api.0x.org',
        42161: 'arbitrum.api.0x.org',
    }

    const baseURL = CHAIN_ID_0X_API_BASE_MAP[networkId]
    return baseURL || null
}

export async function fetchPrice({
    network,
    amount,
    buyToken,
    sellToken,
}: {
    network: { id: number; name: string }
    amount: string
    buyToken: {
        address: Hex
        decimals: number
        symbol: string
    }
    sellToken: {
        address: Hex
        decimals: number
        symbol: string
    }
}) {
    const baseURL = get0xApiBase(network.id)

    if (!baseURL) {
        console.error(`Swaps are not supported on ${network.name}`)
        return null
    }

    const url = new URL(`https://${baseURL}/swap/v1/price`)
    url.searchParams.append('sellToken', sellToken.address)
    url.searchParams.append('buyToken', buyToken.address)
    url.searchParams.append('buyAmount', parseUnits(amount, buyToken.decimals).toString())
    url.searchParams.append('feeRecipient', FEE_RECIPIENT)
    url.searchParams.append('buyTokenPercentageFee', AFFILIATE_FEE.toString())
    url.searchParams.append('feeRecipientTradeSurplus', FEE_RECIPIENT)

    const response = await corsFetch(url.toString(), {
        headers: { '0x-api-key': process.env.ZEROX_API_KEY || '' },
    })

    if (!response) return null

    const data = JSON.parse(response) as ZeroXSwapPrice
    const price = formatUnits(BigInt(data.sellAmount), sellToken.decimals)
    console.log(
        `Price for buying ${buyToken.symbol} with ${sellToken.symbol} is ${price} ${buyToken.symbol}`,
        data
    )

    return {
        price: +price,
        rate: data.buyTokenToEthRate,
    }
}

export async function fetchQuote({
    network,
    amount,
    buyToken,
    sellToken,
}: {
    network: { id: number; name: string }
    amount: string
    buyToken: {
        address: Hex
        decimals: number
        symbol: string
    }
    sellToken: {
        address: Hex
        decimals: number
        symbol: string
    }
}) {
    const baseURL = get0xApiBase(network.id)

    if (!baseURL) {
        console.error(`Swaps are not supported on ${network.name}`)
        return null
    }

    const url = new URL(`https://${baseURL}/swap/v1/quote`)
    url.searchParams.append('sellToken', sellToken.address)
    url.searchParams.append('buyToken', buyToken.address)
    url.searchParams.append('sellAmount', parseUnits(amount, sellToken.decimals).toString())
    url.searchParams.append('feeRecipient', FEE_RECIPIENT)
    url.searchParams.append('buyTokenPercentageFee', AFFILIATE_FEE.toString())
    url.searchParams.append('feeRecipientTradeSurplus', FEE_RECIPIENT)

    const response = await corsFetch(url.toString(), {
        headers: { '0x-api-key': process.env.ZEROX_API_KEY || '' },
    })

    if (!response) return null

    const data = JSON.parse(response) as ZeroXSwapQuote
    const price = formatUnits(BigInt(data.sellAmount), sellToken.decimals)

    console.log(
        `Quote for selling ${sellToken.symbol} for ${buyToken.symbol} is ${price} ${sellToken.symbol}`,
        data
    )

    return data
}
