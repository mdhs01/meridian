/**
 * Technical Analysis Module for DLMM Bot
 * Handles ATH detection, Swing Low identification, and Fibonacci calculations
 * Timeframe: 5 minutes
 */

import axios from 'axios';

// Configuration
const TIMEFRAME = '5m';
const LOOKBACK_PERIODS = 100; // Candle lookback for ATH/Swing detection

/**
 * Fetch OHLCV data from GeckoTerminal API (primary free source)
 * @param {string} tokenAddress - Token address
 * @param {string} baseToken - Base token (usually SOL)
 * @returns {Promise<Array>} - Array of candles [{time, open, high, low, close, volume}]
 */
async function fetchCandles(tokenAddress, baseToken = 'So11111111111111111111111111111111111111112') {
    try {
        // Primary: GeckoTerminal API (free, no auth required)
        // Format: https://api.geckoterminal.com/api/v2/networks/solana/tokens/{token_address}/ohlcv/day?limit=100
        // For 5m candles, we use the pairs endpoint
        
        const geckoUrl = `https://api.geckoterminal.com/api/v2/networks/solana/pairs/${tokenAddress}/ohlcv/${TIMEFRAME}`;
        
        const response = await axios.get(geckoUrl, {
            headers: { 
                'accept': 'application/json',
                'User-Agent': 'Meridian-DLMM-Bot'
            },
            timeout: 10000
        });

        if (response.data && response.data.data && response.data.data.attributes) {
            const ohlcvData = response.data.data.attributes.ohlcv_list;
            
            // GeckoTerminal returns: [timestamp, open, high, low, close, volume]
            return ohlcvData.map(item => ({
                time: item[0] * 1000, // Convert to ms
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            })).reverse(); // Ensure chronological order (newest last)
        }
        
        throw new Error('No candle data from GeckoTerminal');
    } catch (geckoError) {
        console.log(`[Technical] GeckoTerminal API failed: ${geckoError.message}`);
        
        // Fallback: DexScreener for current price only (no historical candles)
        try {
            const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${tokenAddress}`;
            const response = await axios.get(dexScreenerUrl, { timeout: 5000 });
            
            if (response.data && response.data.pairs && response.data.pairs.length > 0) {
                const pair = response.data.pairs[0];
                const currentPrice = parseFloat(pair.priceUsd || pair.priceNative);
                const now = Date.now();
                
                // Create synthetic candles from available data
                // This is limited but better than nothing
                console.log(`[Technical] Using DexScreener fallback for ${tokenAddress}`);
                
                // Try to get some historical context from pair info
                const candles = [];
                if (pair.priceChange && pair.priceChange.m5) {
                    // Estimate previous candles based on price change
                    const prevPrice = currentPrice / (1 + (pair.priceChange.m5 / 100));
                    candles.push({
                        time: now - 300000,
                        open: prevPrice,
                        high: Math.max(prevPrice, currentPrice),
                        low: Math.min(prevPrice, currentPrice),
                        close: currentPrice,
                        volume: 0
                    });
                }
                
                candles.push({
                    time: now,
                    open: currentPrice,
                    high: currentPrice,
                    low: currentPrice,
                    close: currentPrice,
                    volume: 0
                });
                
                return candles;
            }
        } catch (dexError) {
            console.log(`[Technical] DexScreener fallback also failed: ${dexError.message}`);
        }
        
        console.error(`[Technical] All candle sources failed for ${tokenAddress}`);
        return [];
    }
}

/**
 * Detect All-Time High (ATH) from recent data
 * @param {Array} candles - Array of candle objects
 * @returns {Object|null} - { price, index, timestamp } or null
 */
function detectATH(candles) {
    if (!candles || candles.length === 0) return null;

    let maxPrice = 0;
    let athIndex = -1;

    for (let i = 0; i < candles.length; i++) {
        if (candles[i].high > maxPrice) {
            maxPrice = candles[i].high;
            athIndex = i;
        }
    }

    if (athIndex === -1) return null;

    return {
        price: maxPrice,
        index: athIndex,
        timestamp: candles[athIndex].time
    };
}

/**
 * Detect Swing Low before ATH breakout
 * Looks for the lowest low between the start of the trend and the ATH
 * @param {Array} candles - Array of candle objects
 * @param {number} athIndex - Index of the ATH candle
 * @returns {Object|null} - { price, index, timestamp } or null
 */
function detectSwingLow(candles, athIndex) {
    if (!candles || athIndex <= 0) return null;

    // Look back from ATH to find the support level before the breakout
    // We scan from the beginning up to the ATH index
    let minPrice = Infinity;
    let swingIndex = -1;

    for (let i = 0; i < athIndex; i++) {
        if (candles[i].low < minPrice) {
            minPrice = candles[i].low;
            swingIndex = i;
        }
    }

    if (swingIndex === -1) return null;

    return {
        price: minPrice,
        index: swingIndex,
        timestamp: candles[swingIndex].time
    };
}

/**
 * Calculate Fibonacci Retracement Levels
 * @param {number} high - ATH price
 * @param {number} low - Swing Low price
 * @returns {Object} - Fib levels
 */
function calculateFibLevels(high, low) {
    const diff = high - low;
    
    return {
        level_0: high,          // 0% (ATH)
        level_382: high - (diff * 0.382),
        level_500: high - (diff * 0.5),   // 50% - Entry Zone Top
        level_618: high - (diff * 0.618),
        level_786: high - (diff * 0.786), // 78.6% - Entry Zone Bottom
        level_100: low,         // 100% (Swing Low)
        
        // Liquidity Range Definition
        rangeTop: high - (diff * 0.5),    // 0.5 Fib
        rangeBottom: high - (diff * 0.786) // 0.786 Fib
    };
}

/**
 * Check if price has broken out above ATH
 * @param {Array} candles - Array of candles
 * @param {number} athPrice - ATH price level
 * @returns {boolean}
 */
function isBreakoutConfirmed(candles, athPrice) {
    if (candles.length < 2) return false;
    
    const currentCandle = candles[candles.length - 1];
    const previousCandle = candles[candles.length - 2];
    
    // Breakout confirmed if current close is above ATH
    // Or if a recent candle closed above ATH
    return currentCandle.close > athPrice || previousCandle.close > athPrice;
}

/**
 * Check if price is within the Fibonacci Entry Zone
 * @param {number} currentPrice - Current market price
 * @param {Object} fibLevels - Calculated fib levels
 * @returns {boolean}
 */
function isPriceInEntryZone(currentPrice, fibLevels) {
    return currentPrice <= fibLevels.rangeTop && currentPrice >= fibLevels.rangeBottom;
}

/**
 * Main analysis function
 * @param {string} tokenAddress - Token address
 * @returns {Promise<Object|null>} - Analysis result or null if setup invalid
 */
async function analyzeSetup(tokenAddress) {
    console.log(`[Technical] Analyzing setup for ${tokenAddress}...`);
    
    const candles = await fetchCandles(tokenAddress);
    if (candles.length === 0) {
        console.log(`[Technical] No candle data available for ${tokenAddress}`);
        return null;
    }

    // 1. Detect ATH
    const ath = detectATH(candles);
    if (!ath) {
        console.log(`[Technical] No clear ATH found for ${tokenAddress}`);
        return null;
    }

    // 2. Detect Swing Low before ATH
    const swingLow = detectSwingLow(candles, ath.index);
    if (!swingLow) {
        console.log(`[Technical] No clear Swing Low found before ATH for ${tokenAddress}`);
        return null;
    }

    // 3. Validate Breakout
    // We need price to have broken ATH first, then pulled back
    const hasBrokenATH = candles.some(c => c.close > ath.price);
    if (!hasBrokenATH) {
        console.log(`[Technical] Price has not broken ATH yet for ${tokenAddress}`);
        return null;
    }

    // 4. Calculate Fib Levels
    const fibLevels = calculateFibLevels(ath.price, swingLow.price);

    // 5. Get Current Price
    const currentPrice = candles[candles.length - 1].close;

    // 6. Determine Status
    let status = 'WAITING';
    if (isPriceInEntryZone(currentPrice, fibLevels)) {
        status = 'READY_TO_ENTRY';
    } else if (currentPrice > fibLevels.rangeTop) {
        status = 'PULLBACK_PENDING';
    } else if (currentPrice < fibLevels.rangeBottom) {
        status = 'BELOW_RANGE';
    }

    const result = {
        tokenAddress,
        ath: ath.price,
        swingLow: swingLow.price,
        fibLevels,
        currentPrice,
        status,
        timestamp: Date.now(),
        candlesCount: candles.length
    };

    console.log(`[Technical] Analysis complete for ${tokenAddress}: ${status}`);
    console.log(`  ATH: $${ath.price.toFixed(8)}`);
    console.log(`  Swing Low: $${swingLow.price.toFixed(8)}`);
    console.log(`  Entry Zone: $${fibLevels.rangeBottom.toFixed(8)} - $${fibLevels.rangeTop.toFixed(8)}`);
    console.log(`  Current Price: $${currentPrice.toFixed(8)}`);

    return result;
}

export {
    fetchCandles,
    detectATH,
    detectSwingLow,
    calculateFibLevels,
    isBreakoutConfirmed,
    isPriceInEntryZone,
    analyzeSetup
};
