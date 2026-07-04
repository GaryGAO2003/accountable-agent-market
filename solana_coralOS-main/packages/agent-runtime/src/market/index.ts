// Market protocol - the marketplace wire format (pure, network-free).

export {
  formatWant, parseWant, formatBid, parseBid, formatAward, parseAward,
  formatEscrowRequired, parseEscrowRequired, formatDeposited, parseDeposited,
  formatDelivered, parseDelivered, formatVerified, parseVerified,
  formatArbiterReview, parseArbiterReview, formatArbiterDecision, parseArbiterDecision,
  formatChallengeReview, parseChallengeReview,
  formatBondPosted, parseBondPosted, formatChallengeOpened, parseChallengeOpened,
  formatChallengeDecision, parseChallengeDecision, formatSlash, parseSlash,
  formatEgressAudit, parseEgressAudit, formatEgressDenied, parseEgressDenied,
  selectBids, pickCheapest, verb, messageRound,
} from './protocol.js'
export type {
  Want, Bid, EscrowTerms, Deposited, Delivered, Verification,
  ArbiterReview, ArbiterDecision, BondPosted, ChallengeReview, ChallengeOpened,
  ChallengeDecision, Slash, EgressAudit,
} from './protocol.js'
export { verifyDelivery } from './verify.js'
export type { DeliveryWant, VerificationResult, VerifyOptions } from './verify.js'

// Egress PEP - the pre-action policy fence + audit trail for every outbound agent action.
export { checkEgress, commitEgress, newEgressState, AuditLog } from './egress.js'
export type {
  ReasonCode, EgressAction, EgressPolicy, EgressState, EgressDecision, AuditEntry,
} from './egress.js'

// Reputation ledger (L3) - the market's cross-round memory + its frozen wire line.
export { ReputationLedger, REP_WEIGHTS, formatReputation, parseReputation } from './reputation.js'
export type { RepOutcome, RepTier, RepThresholds, RepEntry } from './reputation.js'
