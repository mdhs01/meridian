/**
 * Hard Rules Validator for DLMM Bot
 * Implements all security and safety thresholds as hardcoded rules
 * LLM will ONLY see pools that pass ALL these rules
 */

import { config } from '../config.js';

/**
 * Validate Market Cap and TVL
 * @param {Object} pool - Pool data with mcap and tvl
 * @returns {Object} - { passed: boolean, reason?: string }
 */
function validateMarketCapAndTVL(pool) {
    const minMcap = config.screening.minMcap;
    const maxTvl = config.screening.maxTvl;
    
    if (pool.mcap < minMcap) {
        return { passed: false, reason: `Market Cap $${pool.mcap.toLocaleString()} < $${minMcap.toLocaleString()} minimum` };
    }
    
    if (pool.tvl > maxTvl) {
        return { passed: false, reason: `TVL $${pool.tvl.toLocaleString()} > $${maxTvl.toLocaleString()} maximum` };
    }
    
    return { passed: true };
}

/**
 * Validate Volume and Fees
 * @param {Object} pool - Pool data with volume and fees
 * @returns {Object} - { passed: boolean, reason?: string }
 */
function validateVolumeAndFees(pool) {
    const minVolume1m = config.screening.minVolume;
    const minFeesSol = config.screening.minTokenFeesSol;
    
    // Check realtime volume per minute
    if (pool.volume1m && pool.volume1m < minVolume1m) {
        return { passed: false, reason: `Volume 1m $${pool.volume1m} < $${minVolume1m} minimum` };
    }
    
    // Check total global fees in SOL
    if (pool.total_fees_sol && pool.total_fees_sol < minFeesSol) {
        return { passed: false, reason: `Total fees ${pool.total_fees_sol} SOL < ${minFeesSol} SOL minimum` };
    }
    
    return { passed: true };
}

/**
 * Validate DLMM Fee Tier
 * @param {Object} pool - Pool data with fee_tier
 * @returns {Object} - { passed: boolean, reason?: string }
 */
function validateFeeTier(pool) {
    const minTier = config.screening.dlmmFeeTierMin;
    const maxTier = config.screening.dlmmFeeTierMax;
    
    if (!pool.fee_tier) {
        return { passed: false, reason: 'Fee tier not specified' };
    }
    
    if (pool.fee_tier < minTier || pool.fee_tier > maxTier) {
        return { passed: false, reason: `Fee tier ${pool.fee_tier}% outside range ${minTier}%-${maxTier}%` };
    }
    
    return { passed: true };
}

/**
 * Validate Security Metrics (Sniper, Bundler, Insider)
 * @param {Object} pool - Pool data with security metrics
 * @returns {Object} - { passed: boolean, reason?: string }
 */
function validateSecurityMetrics(pool) {
    const maxSniper = config.screening.maxSniperPct;
    const maxBundler = config.screening.maxBundlePct;
    const maxInsider = config.screening.maxInsiderPct;
    
    if (pool.sniper_percent !== undefined && pool.sniper_percent > maxSniper) {
        return { passed: false, reason: `Sniper participation ${pool.sniper_percent}% > ${maxSniper}% maximum` };
    }
    
    if (pool.bundler_percent !== undefined && pool.bundler_percent > maxBundler) {
        return { passed: false, reason: `Bundler participation ${pool.bundler_percent}% > ${maxBundler}% maximum` };
    }
    
    if (pool.insider_percent !== undefined && pool.insider_percent > maxInsider) {
        return { passed: false, reason: `Insider holdings ${pool.insider_percent}% > ${maxInsider}% maximum` };
    }
    
    return { passed: true };
}

/**
 * Validate Dev Status (must have sold all)
 * @param {Object} pool - Pool data with dev info
 * @returns {Object} - { passed: boolean, reason?: string }
 */
function validateDevStatus(pool) {
    const mustSellAll = config.screening.devMustSellAll;
    
    if (mustSellAll && !pool.dev_sold_all) {
        return { passed: false, reason: 'Dev wallet has not sold all tokens' };
    }
    
    // Check dev rug history
    const maxRugPct = config.screening.maxDevRugPct;
    if (pool.dev_rug_percent !== undefined && pool.dev_rug_percent > maxRugPct) {
        return { passed: false, reason: `Dev rug history ${pool.dev_rug_percent}% > ${maxRugPct}% maximum` };
    }
    
    return { passed: true };
}

/**
 * Validate Top 10 Holder Distribution
 * @param {Object} pool - Pool data with top_holders array
 * @returns {Object} - { passed: boolean, reason?: string }
 */
function validateTopHolders(pool) {
    const maxFreshWallets = config.screening.maxFreshWalletsTop10;
    const minBalanceSol = config.screening.minTop10BalanceSol;
    
    if (!pool.top_holders || !Array.isArray(pool.top_holders)) {
        return { passed: false, reason: 'Top holders data not available' };
    }
    
    // Count wallets with balance < 1 SOL
    const smallWallets = pool.top_holders.filter(h => h.balance_sol < minBalanceSol);
    
    if (smallWallets.length > maxFreshWallets) {
        return { 
            passed: false, 
            reason: `${smallWallets.length} wallets in top 10 have balance < ${minBalanceSol} SOL (max allowed: ${maxFreshWallets})` 
        };
    }
    
    return { passed: true };
}

/**
 * Validate Fresh Wallets (wallet age < 24 hours)
 * @param {Object} pool - Pool data with holder info
 * @returns {Object} - { passed: boolean, reason?: string }
 */
function validateFreshWallets(pool) {
    // This requires Helius API integration to check wallet creation dates
    // For now, we'll check if the data is available
    if (pool.has_fresh_wallets === true) {
        return { passed: false, reason: 'Fresh wallets (< 24h old) detected in significant holders' };
    }
    
    return { passed: true };
}

/**
 * Validate Rugcheck Status
 * @param {Object} pool - Pool data with rugcheck info
 * @returns {Object} - { passed: boolean, reason?: string }
 */
function validateRugcheck(pool) {
    const requireGood = config.screening.requireRugcheckGood;
    
    if (requireGood && pool.rugcheck_status !== 'Good') {
        return { 
            passed: false, 
            reason: `Rugcheck status is "${pool.rugcheck_status}", required "Good"` 
        };
    }
    
    return { passed: true };
}

/**
 * Validate Token Age (2 hours to 48 hours)
 * @param {Object} pool - Pool data with creation time
 * @returns {Object} - { passed: boolean, reason?: string }
 */
function validateTokenAge(pool) {
    const minAgeHours = config.screening.minTokenAgeHours;
    const maxAgeHours = config.screening.maxTokenAgeHours;
    
    if (!pool.created_at) {
        return { passed: false, reason: 'Token creation time not available' };
    }
    
    const ageHours = (Date.now() - new Date(pool.created_at).getTime()) / (1000 * 60 * 60);
    
    if (ageHours < minAgeHours) {
        return { passed: false, reason: `Token age ${ageHours.toFixed(1)}h < ${minAgeHours}h minimum` };
    }
    
    if (ageHours > maxAgeHours) {
        return { passed: false, reason: `Token age ${ageHours.toFixed(1)}h > ${maxAgeHours}h maximum` };
    }
    
    return { passed: true };
}

/**
 * Main validation function - runs ALL hard rules
 * @param {Object} pool - Complete pool data object
 * @returns {Promise<Object>} - { passed: boolean, failedRules: Array<{rule, reason}> }
 */
async function validate(pool) {
    const failedRules = [];
    
    // Run all validations
    const checks = [
        { name: 'MarketCap/TVL', result: validateMarketCapAndTVL(pool) },
        { name: 'Volume/Fees', result: validateVolumeAndFees(pool) },
        { name: 'FeeTier', result: validateFeeTier(pool) },
        { name: 'SecurityMetrics', result: validateSecurityMetrics(pool) },
        { name: 'DevStatus', result: validateDevStatus(pool) },
        { name: 'TopHolders', result: validateTopHolders(pool) },
        { name: 'FreshWallets', result: validateFreshWallets(pool) },
        { name: 'Rugcheck', result: validateRugcheck(pool) },
        { name: 'TokenAge', result: validateTokenAge(pool) }
    ];
    
    // Collect failed rules
    for (const check of checks) {
        if (!check.result.passed) {
            failedRules.push({
                rule: check.name,
                reason: check.result.reason
            });
        }
    }
    
    const passed = failedRules.length === 0;
    
    if (!passed) {
        console.log(`[HardRules] REJECTED ${pool.symbol || pool.address}:`);
        failedRules.forEach(r => console.log(`  ❌ ${r.rule}: ${r.reason}`));
    } else {
        console.log(`[HardRules] PASSED ${pool.symbol || pool.address} ✓`);
    }
    
    return {
        passed,
        failedRules,
        validatedAt: Date.now()
    };
}

/**
 * Batch validate multiple pools
 * @param {Array} pools - Array of pool data objects
 * @returns {Promise<Array>} - Array of pools that passed all rules
 */
async function batchValidate(pools) {
    console.log(`[HardRules] Validating ${pools.length} pools...`);
    
    const passedPools = [];
    
    for (const pool of pools) {
        const result = await validate(pool);
        if (result.passed) {
            passedPools.push(pool);
        }
    }
    
    console.log(`[HardRules] ${passedPools.length}/${pools.length} pools passed all hard rules`);
    return passedPools;
}

export {
    validate,
    batchValidate,
    // Export individual validators for testing
    validateMarketCapAndTVL,
    validateVolumeAndFees,
    validateFeeTier,
    validateSecurityMetrics,
    validateDevStatus,
    validateTopHolders,
    validateFreshWallets,
    validateRugcheck,
    validateTokenAge
};
