/**
 * DLMM Position Manager - Fib Retracement Strategy
 * Handles entry, monitoring, and exit for single-side SOL liquidity positions
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { deployPosition, closePosition } from './dlmm.js';
import * as technicals from './technicals.js';
import * as stateManager from '../state.js';
import { config } from '../config.js';

// Constants
const TARGET_PROFIT_PERCENT = 2.0; // 2% profit target
const STOP_LOSS_TRIGGER = 'CLOSE_BELOW_RANGE'; // Cut loss when 5m candle closes below range bottom

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
 * Execute Entry - Deploy Single-Side SOL Liquidity
 * @param {string} poolAddress - DLMM pool address
 * @param {Object} setup - Technical analysis setup
 * @param {Keypair} wallet - Wallet keypair
 * @param {Connection} connection - Solana connection
 * @returns {Promise<Object>} - Position details or null
 */
async function executeEntry(poolAddress, setup, wallet, connection) {
    console.log(`[PositionManager] Executing entry for ${poolAddress}...`);
    
    try {
        const pool = await getPool(poolAddress);
        if (!pool) {
            throw new Error('Pool not found');
        }
        
        // Calculate bin range
        const binConfig = calculateBinRangeFromFib(setup.fibLevels, setup.currentPrice);
        
        // Determine capital allocation (from config or LLM recommendation)
        const capitalAmount = config.DEFAULT_POSITION_SIZE_SOL || 0.5; // Default 0.5 SOL
        
        console.log(`[PositionManager] Deploying ${capitalAmount} SOL in bins ${binConfig.idealLowerBin} to ${binConfig.idealUpperBin}`);
        
        // Create position (single-sided SOL)
        const positionTx = await createPosition({
            poolAddress,
            owner: wallet,
            lowerBinId: binConfig.idealLowerBin,
            upperBinId: binConfig.idealUpperBin,
            amountX: capitalAmount, // SOL amount
            amountY: 0,             // No token side (single-sided)
            connection
        });
        
        if (!positionTx) {
            throw new Error('Failed to create position');
        }
        
        const positionData = {
            poolAddress,
            tokenAddress: setup.tokenAddress,
            positionId: positionTx.positionId,
            entryPrice: setup.currentPrice,
            fibLevels: setup.fibLevels,
            rangeTop: setup.fibLevels.rangeTop,
            rangeBottom: setup.fibLevels.rangeBottom,
            capitalSol: capitalAmount,
            createdAt: Date.now(),
            status: 'ACTIVE'
        };
        
        // Save to state
        await stateManager.addPosition(positionData);
        
        console.log(`[PositionManager] Entry successful! Position ID: ${positionTx.positionId}`);
        
        return positionData;
        
    } catch (error) {
        console.error(`[PositionManager] Entry failed:`, error.message);
        return null;
    }
}

/**
 * Monitor Position for Exit Conditions
 * @param {Object} position - Position data from state
 * @param {Connection} connection - Solana connection
 * @returns {Promise<Object>} - { action: 'HOLD' | 'TAKE_PROFIT' | 'STOP_LOSS', reason: string }
 */
async function monitorPosition(position, connection) {
    try {
        // Fetch current price
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
 * @param {Keypair} wallet - Wallet keypair
 * @param {Connection} connection - Solana connection
 * @returns {Promise<boolean>} - Success status
 */
async function executeExit(position, action, wallet, connection) {
    console.log(`[PositionManager] Executing ${action} for position ${position.positionId}...`);
    
    try {
        // Withdraw liquidity
        const withdrawResult = await withdrawPosition({
            poolAddress: position.poolAddress,
            positionId: position.positionId,
            owner: wallet,
            connection
        });
        
        if (!withdrawResult) {
            throw new Error('Failed to withdraw position');
        }
        
        const { receivedSOL, receivedToken } = withdrawResult;
        
        console.log(`[PositionManager] Withdrawn: ${receivedSOL} SOL, ${receivedToken.amount} tokens`);
        
        // Swap received tokens back to SOL (if any)
        let totalSOL = receivedSOL;
        if (receivedToken && receivedToken.amount > 0) {
            console.log(`[PositionManager] Swapping ${receivedToken.amount} tokens to SOL...`);
            const swapResult = await swapToken({
                inputMint: position.tokenAddress,
                outputMint: 'So11111111111111111111111111111111111111112', // SOL
                amount: receivedToken.amount,
                owner: wallet,
                connection
            });
            
            if (swapResult) {
                totalSOL += swapResult.outputAmount;
                console.log(`[PositionManager] Swap successful: +${swapResult.outputAmount} SOL`);
            }
        }
        
        // Update position status
        await stateManager.updatePosition(position.positionId, {
            status: 'CLOSED',
            exitAction: action,
            exitPrice: position.currentPrice,
            totalSOLReturned: totalSOL,
            closedAt: Date.now()
        });
        
        const pnl = ((totalSOL - position.capitalSol) / position.capitalSol) * 100;
        console.log(`[PositionManager] Position closed. Total SOL: ${totalSOL}, PnL: ${pnl.toFixed(2)}%`);
        
        return true;
        
    } catch (error) {
        console.error(`[PositionManager] Exit failed:`, error.message);
        return false;
    }
}

/**
 * Main management loop for all active positions
 * @param {Keypair} wallet - Wallet keypair
 * @param {Connection} connection - Solana connection
 */
async function manageAllPositions(wallet, connection) {
    console.log('[PositionManager] Starting position management cycle...');
    
    const activePositions = await stateManager.getActivePositions();
    
    if (activePositions.length === 0) {
        console.log('[PositionManager] No active positions.');
        return;
    }
    
    for (const position of activePositions) {
        console.log(`\n[PositionManager] Checking position ${position.positionId}...`);
        
        const decision = await monitorPosition(position, connection);
        console.log(`[PositionManager] Decision: ${decision.action} - ${decision.reason}`);
        
        if (decision.action === 'TAKE_PROFIT' || decision.action === 'STOP_LOSS') {
            const success = await executeExit(position, decision.action, wallet, connection);
            
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
