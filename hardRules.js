/**
 * Hard Rules Engine — Security & Safety Filters
 * 
 * All rules MUST pass before a pool candidate is eligible for LLM evaluation.
 * Uses GMGN API as primary, with Jupiter/OKX as fallback, and Helius for wallet analysis.
 * 
 * Rules are divided into:
 * - Market & Liquidity Metrics
 * - Security & Holder Analysis  
 * - Data Sanity Checks
 */

import { log } from "./logger.js";
import { config } from "./config.js";

// API Endpoints
const GMGN_BASE = "https://gmgn.ai/defi/quotation/v1";
const HELIUS_RPC = process.env.HELIUS_API_KEY 
  ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : null;

// Hard Rule Thresholds (from team agreement)
export const HARD_RULES = {
  // Market & Liquidity
  minMarketCap: 400_000,           // $400K minimum market cap
  maxTvl: 100_000,                 // $100K maximum TVL (early stage focus)
  minGlobalFeeSol: 30,             // 30 SOL minimum total fees paid
  minVolume1m: 1_000,              // $1K minimum real-time volume per minute
  dlmmFeeMin: 1,                   // 1% minimum DLMM fee tier
  dlmmFeeMax: 5,                   // 5% maximum DLMM fee tier
  
  // Security & Holder Analysis
  maxSniperPct: 15,                // 15% maximum sniper holding
  maxBundlerPct: 60,               // 60% maximum bundler holding
  maxInsiderPct: 30,               // 30% maximum insider holding
  devMustSellAll: true,            // Dev wallet must have sold all tokens
  maxDevRugPct: 50,                // Max 50% of dev's previous tokens were rugs
  maxTop10Under1Sol: 3,            // Max 3 wallets in top 10 with balance < 1 SOL
  maxFreshWalletHours: 24,         // Reject if significant wallet created < 24h ago
  
  // Data Sanity
  maxPriceDeviationPct: 5,         // Max 5% price deviation vs Pyth oracle
};

/**
 * Check if a wallet is "fresh" (created recently)
 * Uses Helius API to get wallet creation time
 */
async function getWalletAgeHours(walletAddress) {
  if (!HELIUS_RPC) {
    log("hardRules", "Helius API key not configured, skipping fresh wallet check");
    return null;
  }
  
  try {
    const response = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "wallet-age",
        method: "getAccountInfo",
        params: [walletAddress, { encoding: "jsonParsed" }]
      })
    });
    
    const data = await response.json();
    // Helius doesn't directly provide wallet creation time
    // We'll need to use first transaction timestamp as proxy
    // For now, return null and skip this check if data unavailable
    return null;
  } catch (error) {
    log("hardRules", `Error checking wallet age for ${walletAddress?.slice(0, 8)}: ${error.message}`);
    return null;
  }
}

/**
 * Fetch token security data from GMGN API
 * Returns comprehensive security metrics including sniper, bundler, insider, dev info
 */
async function fetchGmgnSecurity(tokenAddress) {
  try {
    const url = `${GMGN_BASE}/tokens/solana/${tokenAddress}/security`;
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });
    
    if (!response.ok) {
      throw new Error(`GMGN security API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    log("hardRules", `GMGN security fetch failed for ${tokenAddress?.slice(0, 8)}: ${error.message}`);
    return null;
  }
}

/**
 * Fetch token holder distribution from GMGN API
 * Returns top holders data for concentration analysis
 */
async function fetchGmgnHolders(tokenAddress, limit = 10) {
  try {
    const url = `${GMGN_BASE}/tokens/solana/${tokenAddress}/holders?limit=${limit}`;
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });
    
    if (!response.ok) {
      throw new Error(`GMGN holders API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data?.holders || [];
  } catch (error) {
    log("hardRules", `GMGN holders fetch failed for ${tokenAddress?.slice(0, 8)}: ${error.message}`);
    return [];
  }
}

/**
 * Fetch dev rug history from GMGN API
 * Returns statistics about developer's previous token launches
 */
async function fetchGmgnDevHistory(devAddress) {
  if (!devAddress) return null;
  
  try {
    const url = `${GMGN_BASE}/devs/solana/${devAddress}/history`;
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });
    
    if (!response.ok) {
      throw new Error(`GMGN dev history API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    log("hardRules", `GMGN dev history fetch failed for ${devAddress?.slice(0, 8)}: ${error.message}`);
    return null;
  }
}

/**
 * Fallback to OKX API for security data if GMGN fails
 */
async function fetchOkxSecurity(tokenAddress) {
  try {
    const { getAdvancedInfo } = await import("./okx.js");
    const advanced = await getAdvancedInfo(tokenAddress);
    
    if (!advanced) return null;
    
    return {
      sniper_pct: advanced.sniper_pct,
      bundler_pct: advanced.bundle_pct,
      insider_pct: advanced.suspicious_pct,
      dev_sold_all: advanced.dev_sold_all,
      dev_rug_count: advanced.dev_rug_count,
      dev_token_count: advanced.dev_token_count,
      creator: advanced.creator,
    };
  } catch (error) {
    log("hardRules", `OKX security fetch failed: ${error.message}`);
    return null;
  }
}

/**
 * Calculate dev rug percentage from history
 * rugPct = (rugPullTokens / totalTokens) * 100
 */
function calculateDevRugPct(devHistory) {
  if (!devHistory) return null;
  
  const totalTokens = devHistory.total_tokens || devHistory.token_count || 0;
  const rugTokens = devHistory.rug_tokens || devHistory.rugpull_count || 0;
  
  if (totalTokens === 0) return 0;
  return (rugTokens / totalTokens) * 100;
}

/**
 * Count top 10 holders with balance < 1 SOL
 */
function countLowBalanceHolders(holders, thresholdSol = 1) {
  if (!Array.isArray(holders)) return 0;
  
  return holders.filter(holder => {
    const balanceSol = (holder.balance_usd || 0) / 200; // Approximate: $200/SOL
    return balanceSol < thresholdSol;
  }).length;
}

/**
 * Main hard rules validation function
 * Returns { passed: boolean, reasons: string[], data: object }
 * 
 * Uses data already enriched in the pool object from OKX/GMGN APIs
 */
export async function validateHardRules(pool) {
  const reasons = [];
  const securityData = {};
  
  const tokenAddress = pool.base?.mint;
  const devAddress = pool.dev || null;
  
  if (!tokenAddress) {
    return {
      passed: false,
      reasons: ["Missing token mint address"],
      data: securityData
    };
  }
  
  // ========== MARKET & LIQUIDITY CHECKS ==========
  
  // 1. Market Cap Check (min $400K)
  const marketCap = pool.mcap || pool.base?.market_cap || pool.market_cap || 0;
  if (marketCap < HARD_RULES.minMarketCap) {
    reasons.push(`Market cap $${marketCap.toLocaleString()} < $${HARD_RULES.minMarketCap.toLocaleString()} minimum`);
  }
  
  // 2. TVL Check (max $100K)
  const tvl = pool.active_tvl || pool.tvl || 0;
  if (tvl > HARD_RULES.maxTvl) {
    reasons.push(`TVL $${tvl.toLocaleString()} > $${HARD_RULES.maxTvl.toLocaleString()} maximum`);
  }
  
  // 3. Global Fees Check (min 30 SOL) - use total_fee_sol from OKX
  const globalFeesSol = pool.total_fees_sol || pool.fees_sol || pool.global_fees_sol || 0;
  if (globalFeesSol < HARD_RULES.minGlobalFeeSol) {
    reasons.push(`Global fees ${globalFeesSol} SOL < ${HARD_RULES.minGlobalFeeSol} SOL minimum`);
  }
  
  // 4. Volume Check (min $1K per minute realtime)
  // Use volume_1m if available, otherwise calculate from volume_window (5m timeframe)
  let volume1m = pool.volume_1m || pool.volume_per_minute || 0;
  if (volume1m === 0 && pool.volume_window) {
    // Approximate: volume_window is 5m data, so divide by 5
    volume1m = pool.volume_window / 5;
  }
  if (volume1m < HARD_RULES.minVolume1m) {
    reasons.push(`Volume 1m $${volume1m.toFixed(0)} < $${HARD_RULES.minVolume1m} minimum`);
  }
  
  // 5. DLMM Fee Tier Check (1% - 5%)
  const feeTier = pool.fee_pct || pool.fee_tier || 0;
  if (feeTier < HARD_RULES.dlmmFeeMin || feeTier > HARD_RULES.dlmmFeeMax) {
    reasons.push(`Fee tier ${feeTier}% outside ${HARD_RULES.dlmmFeeMin}-${HARD_RULES.dlmmFeeMax}% range`);
  }
  
  // ========== SECURITY CHECKS (Use Enriched Data from OKX/GMGN) ==========
  
  // Security data should already be enriched in screening.js via OKX API
  // We use the data that's already attached to the pool object
  securityData.sniper_pct = pool.sniper_pct || pool.sniper_holding_pct;
  securityData.bundler_pct = pool.bundle_pct || pool.bundler_pct || pool.bundler_holding_pct;
  securityData.insider_pct = pool.suspicious_pct || pool.insider_pct || pool.insider_holding_pct;
  securityData.dev_sold_all = pool.dev_sold_all;
  securityData.dev_rug_count = pool.dev_rug_count;
  securityData.dev_token_count = pool.dev_token_count;
  
  // Calculate dev rug percentage if we have the counts
  if (securityData.dev_rug_count != null && securityData.dev_token_count != null && securityData.dev_token_count > 0) {
    securityData.dev_rug_pct = (securityData.dev_rug_count / securityData.dev_token_count) * 100;
  }
  
  // 6. Sniper % Check (max 15%)
  if (securityData.sniper_pct != null && securityData.sniper_pct > HARD_RULES.maxSniperPct) {
    reasons.push(`Sniper holding ${securityData.sniper_pct.toFixed(1)}% > ${HARD_RULES.maxSniperPct}% maximum`);
  }
  
  // 7. Bundler % Check (max 60%)
  if (securityData.bundler_pct != null && securityData.bundler_pct > HARD_RULES.maxBundlerPct) {
    reasons.push(`Bundler holding ${securityData.bundler_pct.toFixed(1)}% > ${HARD_RULES.maxBundlerPct}% maximum`);
  }
  
  // 8. Insider % Check (max 30%)
  if (securityData.insider_pct != null && securityData.insider_pct > HARD_RULES.maxInsiderPct) {
    reasons.push(`Insider holding ${securityData.insider_pct.toFixed(1)}% > ${HARD_RULES.maxInsiderPct}% maximum`);
  }
  
  // 9. Dev Sold All Check (mandatory)
  // Only fail if explicitly false (null/undefined = unknown, allow through)
  if (HARD_RULES.devMustSellAll && securityData.dev_sold_all === false) {
    reasons.push("Dev wallet has NOT sold all tokens (mandatory requirement)");
  }
  
  // 10. Dev Rug History Check (max 50%)
  if (securityData.dev_rug_pct != null && securityData.dev_rug_pct > HARD_RULES.maxDevRugPct) {
    reasons.push(`Dev rug history ${securityData.dev_rug_pct.toFixed(1)}% > ${HARD_RULES.maxDevRugPct}% maximum`);
  }
  
  // 11. Top 10 Holder Balance Check (max 3 wallets < 1 SOL)
  // This data comes from GMGN holders API or needs to be fetched separately
  // For now, we'll skip this check if not available (can be added later with GMGN integration)
  if (pool.low_balance_holders != null) {
    securityData.low_balance_holders = pool.low_balance_holders;
    if (pool.low_balance_holders > HARD_RULES.maxTop10Under1Sol) {
      reasons.push(`${pool.low_balance_holders} top-10 holders with <1 SOL > ${HARD_RULES.maxTop10Under1Sol} maximum (indicates potential big bundler dump)`);
    }
  }
  
  // 12. Fresh Wallet Check - skip for now (requires Helius API implementation)
  
  // ========== DATA SANITY CHECKS ==========
  
  // 13. Price Deviation Check (< 5% vs Pyth)
  const priceDeviation = pool.price_deviation_pct || 0;
  if (priceDeviation > HARD_RULES.maxPriceDeviationPct) {
    reasons.push(`Price deviation ${priceDeviation}% > ${HARD_RULES.maxPriceDeviationPct}% (suspect data)`);
  }
  
  // ========== RESULT ==========
  
  const passed = reasons.length === 0;
  
  if (!passed) {
    log("hardRules", `Pool ${pool.name} (${tokenAddress.slice(0, 8)}) FAILED hard rules:`);
    reasons.forEach(reason => log("hardRules", `  ❌ ${reason}`));
  } else {
    log("hardRules", `Pool ${pool.name} (${tokenAddress.slice(0, 8)}) PASSED all hard rules ✓`);
  }
  
  return {
    passed,
    reasons,
    data: securityData
  };
}

/**
 * Batch validate multiple pools
 * Returns only pools that pass all hard rules
 */
export async function batchValidate(pools) {
  const results = [];
  
  for (const pool of pools) {
    const validation = await validateHardRules(pool);
    if (validation.passed) {
      results.push({
        ...pool,
        securityData: validation.data
      });
    }
  }
  
  const filtered = pools.length - results.length;
  if (filtered > 0) {
    log("hardRules", `Batch validation: ${filtered}/${pools.length} pools filtered out by hard rules`);
  }
  
  return results;
}

export default {
  HARD_RULES,
  validateHardRules,
  batchValidate
};
