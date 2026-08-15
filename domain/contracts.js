/**
 * Meridian V2 domain contracts.
 *
 * Phase 1 intentionally has no callers in the legacy runtime. These contracts
 * define the stable language between data adapters, screening, strategy,
 * risk, execution, and evaluation layers before those layers are extracted.
 */

export const DATA_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  STALE: "STALE",
  MISSING: "MISSING",
  INVALID: "INVALID",
  CONFLICT: "CONFLICT",
});

export const DECISION_ACTION = Object.freeze({
  SKIP: "SKIP",
  WATCH: "WATCH",
  DEPLOY: "DEPLOY",
  STAY: "STAY",
  CLAIM: "CLAIM",
  REBALANCE: "REBALANCE",
  CLOSE: "CLOSE",
});

export const RISK_STATE = Object.freeze({
  NORMAL: "NORMAL",
  WATCH: "WATCH",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
  EMERGENCY: "EMERGENCY",
  RECOVERY: "RECOVERY",
});

export const STRATEGY_MODE = Object.freeze({
  BID_ASK: "bid_ask",
  SPOT: "spot",
  CURVE: "curve",
  HYBRID: "hybrid",
});

export const DECISION_SOURCE = Object.freeze({
  RULE: "RULE",
  LLM: "LLM",
  SYSTEM: "SYSTEM",
  USER: "USER",
});

export function dataPoint({ value = null, status = DATA_STATUS.AVAILABLE, source = null, observedAt = null, ageMs = null, confidence = null, reason = null } = {}) {
  return { value, status, source, observedAt, ageMs, confidence, reason };
}

export function tokenProfile({ mint, symbol = null, name = null, decimals = null, createdAt = null, dev = null, launchpad = null } = {}) {
  return { mint, symbol, name, decimals, createdAt, dev, launchpad };
}

export function poolProfile({ address, tokenX = null, tokenY = null, binStep = null, activeBin = null, tvl = null, volume24h = null, fees24h = null, feeTvlRatio = null, liquidity = null } = {}) {
  return { address, tokenX, tokenY, binStep, activeBin, tvl, volume24h, fees24h, feeTvlRatio, liquidity };
}

export function marketProfile({ price = null, priceChange = null, volume = null, volatility = null, ath = null, priceVsAthPct = null, momentum = null, structure = null } = {}) {
  return { price, priceChange, volume, volatility, ath, priceVsAthPct, momentum, structure };
}

export function securityProfile({ riskLevel = null, bundlePct = null, sniperPct = null, suspiciousPct = null, top10Pct = null, insidersPct = null, creatorPct = null, botHoldersPct = null, washTrading = null, rugpull = null, smartMoneyBuy = null } = {}) {
  return { riskLevel, bundlePct, sniperPct, suspiciousPct, top10Pct, insidersPct, creatorPct, botHoldersPct, washTrading, rugpull, smartMoneyBuy };
}

export function indicatorProfile({ momentum = null, volatility = null, trend = null, volumeRatio = null, structure = null, orderFlow = null, liquidityScore = null, custom = {} } = {}) {
  return { momentum, volatility, trend, volumeRatio, structure, orderFlow, liquidityScore, custom };
}

export function candidate({
  id,
  token,
  pool,
  market = null,
  security = null,
  indicators = null,
  dataQuality = {},
  source = null,
  discoveredAt = null,
  score = null,
  rejection = null,
  metadata = {},
} = {}) {
  return {
    id: id || pool?.address || token?.mint || null,
    token,
    pool,
    market,
    security,
    indicators,
    dataQuality,
    source,
    discoveredAt,
    score,
    rejection,
    metadata,
  };
}

export function scoreProfile({ total = null, components = {}, version = null, calculatedAt = null, reasons = [] } = {}) {
  return { total, components, version, calculatedAt, reasons };
}

export function strategyDecision({ action = DECISION_ACTION.SKIP, strategy = null, amountSol = null, binsBelow = null, binsAbove = null, rationale = [], source = DECISION_SOURCE.RULE, version = null } = {}) {
  return { action, strategy, amountSol, binsBelow, binsAbove, rationale, source, version };
}

export function riskDecision({ state = RISK_STATE.NORMAL, action = DECISION_ACTION.STAY, score = null, reasons = [], hardStop = false, source = DECISION_SOURCE.RULE, version = null } = {}) {
  return { state, action, score, reasons, hardStop, source, version };
}

export function position({
  address,
  pool,
  strategy = null,
  strategyVersion = null,
  amountSol = null,
  range = null,
  state = "OPEN",
  deployedAt = null,
  initialValue = null,
  currentValue = null,
  pnlPct = null,
  feesClaimed = null,
  unclaimedFees = null,
  peakPnlPct = null,
  metadata = {},
} = {}) {
  return { address, pool, strategy, strategyVersion, amountSol, range, state, deployedAt, initialValue, currentValue, pnlPct, feesClaimed, unclaimedFees, peakPnlPct, metadata };
}

export function executionRequest({ action, positionId = null, pool = null, amountSol = null, strategy = null, dryRun = true, requestId = null } = {}) {
  return { action, positionId, pool, amountSol, strategy, dryRun, requestId };
}

export function executionResult({ success = false, action = null, requestId = null, txSignature = null, error = null, slippage = null, latencyMs = null, dryRun = true, metadata = {} } = {}) {
  return { success, action, requestId, txSignature, error, slippage, latencyMs, dryRun, metadata };
}

export function decisionRecord({
  decisionId,
  timestamp = new Date().toISOString(),
  entityId = null,
  action,
  source = DECISION_SOURCE.RULE,
  strategyVersion = null,
  filterVersion = null,
  scoreVersion = null,
  configVersion = null,
  inputSnapshot = null,
  rationale = [],
  risk = null,
  execution = null,
} = {}) {
  return { decisionId, timestamp, entityId, action, source, strategyVersion, filterVersion, scoreVersion, configVersion, inputSnapshot, rationale, risk, execution };
}

export function validateEnum(value, values, fieldName) {
  if (!Object.values(values).includes(value)) {
    throw new Error(`${fieldName} must be one of: ${Object.values(values).join(", ")}`);
  }
  return true;
}

export function assertCandidate(candidateValue) {
  if (!candidateValue?.id) throw new Error("Candidate.id is required");
  if (!candidateValue?.token?.mint) throw new Error("Candidate.token.mint is required");
  if (!candidateValue?.pool?.address) throw new Error("Candidate.pool.address is required");
  return true;
}

export function assertExecutionResult(result) {
  if (typeof result?.success !== "boolean") throw new Error("ExecutionResult.success must be boolean");
  if (!result?.action) throw new Error("ExecutionResult.action is required");
  return true;
}
