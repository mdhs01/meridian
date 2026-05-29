/**
 * DLMM Position Manager - Fib Retracement Strategy
 * Handles entry, monitoring, and exit for single-side SOL liquidity positions
 * Strategy: Bid-Ask Only (SOL side only), Entry at Fib 0.5-0.786, TP 2%, SL on candle close below range
 */

import { deployPosition, closePosition } from './dlmm.js';
import { swapToken } from './wallet.js';
import * as technicals from './technicals.js';
import * as stateManager from '../state.js';
import { config } from '../config.js';

// Constants
const TARGET_PROFIT_PERCENT = 2.0; // 2% profit target
const STOP_LOSS_TRIGGER = 'CLOSE_BELOW_RANGE'; // Cut loss when 5m candle closes below range bottom

/**
 * Wrapper function for swapping tokens to SOL
 * @param {Object} params - Swap parameters
 * @returns {Promise<Object>} - Swap result
 */
async function swapToSOL({ inputMint, amount, slippageBps = 200 }) {
    return await swapToken({
        input_mint: inputMint,
        output_mint: 'So11111111111111111111111111111111111111112', // SOL native mint
        amount: amount,
        slippage_bps: slippageBps
    });
}

/**
 * Calculate DLMM Bin Range from Fibonacci levels
 * @param {Object} fibLevels - Fibonacci levels object
 * @returns {Object} - { activeBinId, binRange }
 */
function calculateBinRangeFromFib(fibLevels, currentPrice) {
    const rangeTop = fibLevels.rangeTop;
    const rangeBottom = fibLevels.rangeBottom;
    
    // In DLMM, we need to convert prices to bin IDs
    // This is a simplified calculation - actual implementation depends on pool's binStep
    // Formula: binId = Math.floor(Math.log(price / referencePrice) / Math.log(1 + binStep/10000))
    
    // For now, we'll estimate based on price ratio
    const priceRatio = rangeTop / rangeBottom;
    const estimatedBins = Math.ceil(Math.log(priceRatio) / Math.log(1.0001)); // Approximate for binStep ~10
    
    // Find the active bin closest to current price
    const activeBinId = Math.floor(Math.log(currentPrice / rangeBottom) / Math.log(1.0001));
    
    return {
        rangeTop,
        rangeBottom,
        activeBinId,
        estimatedBinCount: estimatedBins,
        idealLowerBin: Math.floor(Math.log(rangeBottom / rangeBottom) / Math.log(1.0001)), // Should be near 0 relative
        idealUpperBin: Math.floor(Math.log(rangeTop / rangeBottom) / Math.log(1.0001))
    };
}

/**
 * Check if entry conditions are met
 * @param {Object} setup - Technical analysis setup
 * @returns {boolean}
 */
function shouldEntry(setup) {
    if (!setup || setup.status !== 'READY_TO_ENTRY') {
        return false;
    }
    
    // Additional checks can be added here
    // e.g., volume confirmation, RSI check, etc.
    
    return true;
}

/**
 * Execute Entry - Deploy Single-Side SOL Liquidity (Bid-Ask Mode)
 * @param {string} poolAddress - DLMM pool address
 * @param {Object} setup - Technical analysis setup
 * @returns {Promise<Object>} - Position details or null
 */
async function executeEntry(poolAddress, setup) {
    console.log(`[PositionManager] Executing entry for ${poolAddress}...`);
    
    try {
        // Calculate bin range from Fib levels
        const binConfig = calculateBinRangeFromFib(setup.fibLevels, setup.currentPrice);
        
        // Determine capital allocation (from config or LLM recommendation)
        const capitalAmount = config.DEFAULT_POSITION_SIZE_SOL || 0.5; // Default 0.5 SOL
        
        console.log(`[PositionManager] Deploying ${capitalAmount} SOL in Bid-Ask mode`);
        console.log(`[PositionManager] Entry Zone: $${setup.fibLevels.rangeBottom.toFixed(8)} - $${setup.fibLevels.rangeTop.toFixed(8)}`);
        
        // Deploy position with strategy='bid_ask' and amount_y=SOL, amount_x=0
        // This creates single-sided SOL liquidity
        const result = await deployPosition({
            pool_address: poolAddress,
            amount_y: capitalAmount,  // SOL side (Y token in Meteora is typically SOL)
            amount_x: 0,              // No base token (single-sided)
            strategy: 'bid_ask',      // Bid-Ask only mode
            bins_below: binConfig.estimatedBinCount,
            bins_above: 0             // No bins above (pure bid side)
        });
        
        if (!result || !result.success) {
            throw new Error(result?.error || 'Failed to create position');
        }
        
        const positionData = {
            poolAddress,
            tokenAddress: setup.tokenAddress,
            positionId: result.position,
            entryPrice: setup.currentPrice,
            fibLevels: setup.fibLevels,
            rangeTop: setup.fibLevels.rangeTop,
            rangeBottom: setup.fibLevels.rangeBottom,
            capitalSol: capitalAmount,
            createdAt: Date.now(),
            status: 'ACTIVE',
            strategy: 'bid_ask',
            txHash: result.txs?.[0]
        };
        
        // Save to state
        await stateManager.trackPosition({
            position: positionData.positionId,
            pool: poolAddress,
            pool_name: setup.tokenAddress,
            strategy: 'bid_ask',
            bin_range: { 
                min: result.bin_range?.min, 
                max: result.bin_range?.max, 
                active: result.bin_range?.active 
            },
            amount_sol: capitalAmount,
            initial_value_usd: capitalAmount * setup.currentPrice // Approximate
        });
        
        console.log(`[PositionManager] Entry successful! Position ID: ${positionData.positionId}`);
        console.log(`[PositionManager] Tx Hash: ${positionData.txHash}`);
        
        return positionData;
        
    } catch (error) {
        console.error(`[PositionManager] Entry failed:`, error.message);
        return null;
    }
}

/**
 * Monitor Position for Exit Conditions
 * @param {Object} position - Position data from state
 * @returns {Promise<Object>} - { action: 'HOLD' | 'TAKE_PROFIT' | 'STOP_LOSS', reason: string }
 */
async function monitorPosition(position) {
    try {
        // Fetch current price and candles
        const setup = await technicals.analyzeSetup(position.tokenAddress);
        if (!setup) {
            console.log(`[PositionManager] Cannot fetch price for ${position.tokenAddress}, holding...`);
            return { action: 'HOLD', reason: 'No price data' };
        }
        
        const currentPrice = setup.currentPrice;
        const rangeBottom = position.rangeBottom;
        const rangeTop = position.rangeTop;
        
        // Calculate current PnL (simplified estimation)
        // In real implementation, fetch actual position value from DLMM program
        const estimatedPnLPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
        
        // Check Stop Loss: Candle close below range bottom
        // We need to check if the latest 5m candle closed below rangeBottom
        const candles = await technicals.fetchCandles(position.tokenAddress);
        if (candles && candles.length > 0) {
            const lastCandle = candles[candles.length - 1];
            
            if (lastCandle.close < rangeBottom) {
                console.log(`[PositionManager] STOP LOSS TRIGGERED: Candle closed below range bottom ($${rangeBottom.toFixed(8)})`);
                return { 
                    action: 'STOP_LOSS', 
                    reason: `Candle closed below range at $${lastCandle.close.toFixed(8)}`,
                    currentPrice 
                };
            }
        }
        
        // Check Take Profit: PnL >= 2%
        // Note: For single-side SOL, PnL calculation is more complex due to fee accumulation
        // This is a simplified check based on price movement + estimated fees
        if (estimatedPnLPercent >= TARGET_PROFIT_PERCENT) {
            console.log(`[PositionManager] TAKE PROFIT TRIGGERED: PnL ${estimatedPnLPercent.toFixed(2)}% >= ${TARGET_PROFIT_PERCENT}%`);
            return { 
                action: 'TAKE_PROFIT', 
                reason: `Target profit reached: ${estimatedPnLPercent.toFixed(2)}%`,
                currentPrice 
            };
        }
        
        // Check if price is out of range (but not closed below yet)
        if (currentPrice > rangeTop) {
            console.log(`[PositionManager] Price above range ($${currentPrice.toFixed(8)} > $${rangeTop.toFixed(8)}), no fees being earned`);
            // Could add logic here to wait for pullback or early exit
        } else if (currentPrice < rangeBottom) {
            console.log(`[PositionManager] Price below range ($${currentPrice.toFixed(8)} < $${rangeBottom.toFixed(8)}), waiting for candle close...`);
            // Don't exit yet, wait for candle close confirmation
        }
        
        return { action: 'HOLD', reason: `PnL: ${estimatedPnLPercent.toFixed(2)}%, Price: $${currentPrice.toFixed(8)}` };
        
    } catch (error) {
        console.error(`[PositionManager] Monitoring error:`, error.message);
        return { action: 'HOLD', reason: `Error: ${error.message}` };
    }
}

/**
 * Execute Exit - Withdraw Liquidity and Swap to SOL
 * @param {Object} position - Position data
 * @param {string} action - 'TAKE_PROFIT' or 'STOP_LOSS'
 * @returns {Promise<boolean>} - Success status
 */
async function executeExit(position, action) {
    console.log(`[PositionManager] Executing ${action} for position ${position.positionId}...`);
    
    try {
        // Close position (withdraws both SOL and token)
        const closeResult = await closePosition({
            position_address: position.positionId,
            pool_address: position.poolAddress
        });
        
        if (!closeResult || !closeResult.success) {
            throw new Error(closeResult?.error || 'Failed to close position');
        }
        
        const { receivedSol, receivedToken, tokenAmount } = closeResult;
        
        console.log(`[PositionManager] Closed position. Received: ${receivedSol} SOL, ${tokenAmount} tokens`);
        
        // CRITICAL: Auto-swap all received tokens to SOL immediately
        let totalSOL = receivedSol;
        if (tokenAmount && tokenAmount > 0) {
            console.log(`[PositionManager] AUTO-SWAPPING ${tokenAmount} tokens to SOL...`);
            
            const swapResult = await swapToSOL({
                inputMint: position.tokenAddress,
                amount: tokenAmount,
                slippageBps: 200 // 2% slippage for emergency exit
            });
            
            if (swapResult && swapResult.success) {
                totalSOL += swapResult.outputAmount;
                console.log(`[PositionManager] Swap successful: +${swapResult.outputAmount.toFixed(6)} SOL`);
                console.log(`[PositionManager] Total SOL returned: ${totalSOL.toFixed(6)}`);
            } else {
                console.error(`[PositionManager] Swap failed: ${swapResult?.error || 'Unknown error'}`);
                // Don't fail the entire exit if swap fails, but log it
            }
        }
        
        // Calculate final PnL
        const pnl = ((totalSOL - position.capitalSol) / position.capitalSol) * 100;
        
        // Update position status in state
        await stateManager.recordClose({
            position: position.positionId,
            pool: position.poolAddress,
            action: action,
            pnl_usd: (totalSOL - position.capitalSol) * position.entryPrice, // Approximate
            pnl_pct: pnl,
            total_sol_returned: totalSOL,
            closed_at: Date.now()
        });
        
        console.log(`[PositionManager] Position closed. Action: ${action}, PnL: ${pnl.toFixed(2)}%`);
        
        return true;
        
    } catch (error) {
        console.error(`[PositionManager] Exit failed:`, error.message);
        return false;
    }
}

/**
 * Main management loop for all active positions
 */
async function manageAllPositions() {
    console.log('[PositionManager] Starting position management cycle...');
    
    const activePositions = await stateManager.getActivePositions();
    
    if (activePositions.length === 0) {
        console.log('[PositionManager] No active positions.');
        return;
    }
    
    for (const position of activePositions) {
        console.log(`\n[PositionManager] Checking position ${position.positionId}...`);
        
        const decision = await monitorPosition(position);
        console.log(`[PositionManager] Decision: ${decision.action} - ${decision.reason}`);
        
        if (decision.action === 'TAKE_PROFIT' || decision.action === 'STOP_LOSS') {
            const success = await executeExit(position, decision.action);
            
            if (success) {
                console.log(`[PositionManager] Successfully closed position ${position.positionId}`);
            } else {
                console.error(`[PositionManager] Failed to close position ${position.positionId}`);
            }
        }
    }
    
    console.log('[PositionManager] Management cycle complete.\n');
}

export {
    calculateBinRangeFromFib,
    shouldEntry,
    executeEntry,
    monitorPosition,
    executeExit,
    manageAllPositions
};
