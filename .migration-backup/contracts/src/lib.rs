use wit_bindgen::generate;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

generate!({
    world: "kinesis-lattice-world",
    path: "wit",
});

use exports::kinesis::lattice::lattice_engine::{
    Guest, CoherenceSnapshot, DelegationVc, SilenceRecord, LatticeState, Plane,
    DelegationResult, Did,
};

// === CONSTANTS ===
const COHERENCE_MIN: f64 = 0.0;
const COHERENCE_MAX: f64 = 1.0;
const THRESHOLD_MIN: f64 = 0.55;
const THRESHOLD_MAX: f64 = 0.92;
const DEFAULT_THRESHOLD: f64 = 0.70;
const HHI_LIMIT: f64 = 2500.0;
const MAX_OUT_DEGREE: usize = 7;
const MIN_JURISDICTIONS: usize = 3;

// Five-plane coherence weights (TRION-derived)
const W_PROTOCOL: f64 = 0.30;
const W_FIDELITY: f64 = 0.25;
const W_SYNERGY: f64 = 0.20;
const W_KNOWLEDGE: f64 = 0.15;
const W_ADAPTIVITY: f64 = 0.10;

// Moat weights
const MOAT_DEPTH_WEIGHT: f64 = 0.25;
const MOAT_QUALITY_WEIGHT: f64 = 0.20;
const MOAT_RESILIENCE_WEIGHT: f64 = 0.20;
const MOAT_NOVELTY_WEIGHT: f64 = 0.15;
const MOAT_FEDERATION_WEIGHT: f64 = 0.20;

// === INTERNAL STATE ===
#[derive(Serialize, Deserialize, Clone, Debug)]
struct AgentProfile {
    did: Did,
    registered_at: u64,
    coherence_history: Vec<CoherenceSnapshot>,
    current_coherence: Option<CoherenceSnapshot>,
    delegation_out: Vec<Did>,
    delegation_in: Vec<Did>,
    jurisdiction: String,
    is_silent: bool,
    silence_record: Option<SilenceRecord>,
    total_actions: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct LatticeData {
    agents: HashMap<String, AgentProfile>,
    delegations: Vec<(Did, Did)>,
    silence_registry: Vec<SilenceRecord>,
    moat_history: Vec<f64>,
    admin: Option<Did>,
    initialized: bool,
}

static mut LATTICE: Option<LatticeData> = None;

fn lattice() -> &'static mut LatticeData {
    unsafe {
        LATTICE.get_or_insert_with(|| LatticeData {
            agents: HashMap::new(),
            delegations: Vec::new(),
            silence_registry: Vec::new(),
            moat_history: Vec::new(),
            admin: None,
            initialized: false,
        })
    }
}

fn did_key(did: &Did) -> String {
    format!("{}:{}", did.method, did.identifier)
}

fn now() -> u64 {
    // Production: use host interface for cluster-pinned timestamp
    1748965722
}

// === COHERENCE COMPUTATION (TRION-DERIVED) ===
fn compute_protocol_score(actions: u32, violations: u32) -> f64 {
    if actions == 0 { return 0.5; }
    let ratio = (actions.saturating_sub(violations)) as f64 / actions as f64;
    ratio.clamp(COHERENCE_MIN, COHERENCE_MAX)
}

fn compute_fidelity_score(commits: u32, fulfilled: u32) -> f64 {
    if commits == 0 { return 0.5; }
    (fulfilled as f64 / commits as f64).clamp(COHERENCE_MIN, COHERENCE_MAX)
}

fn compute_synergy_score(interactions: u32, positive: u32) -> f64 {
    if interactions == 0 { return 0.5; }
    (positive as f64 / interactions as f64).clamp(COHERENCE_MIN, COHERENCE_MAX)
}

fn compute_knowledge_score(milestones: u32, stagnation_days: u32) -> f64 {
    if stagnation_days > 30 { return 0.0; } // Hard-zero: stagnation
    let base = (milestones as f64 * 0.1).min(1.0);
    let decay = (stagnation_days as f64 / 30.0).min(1.0);
    (base * (1.0 - decay * 0.5)).clamp(COHERENCE_MIN, COHERENCE_MAX)
}

fn compute_adaptivity_score(shifts: u32, zscore: f64) -> f64 {
    if zscore.abs() > 3.0 { return 0.0; } // Hard-zero: erratic behavior
    let base = (shifts as f64 * 0.05).min(1.0);
    let penalty = (zscore.abs() / 3.0).min(1.0);
    (base * (1.0 - penalty * 0.3)).clamp(COHERENCE_MIN, COHERENCE_MAX)
}

fn compute_composite_coherence(p: f64, f: f64, s: f64, k: f64, a: f64) -> f64 {
    let composite = W_PROTOCOL * p + W_FIDELITY * f + W_SYNERGY * s
        + W_KNOWLEDGE * k + W_ADAPTIVITY * a;
    composite.clamp(COHERENCE_MIN, COHERENCE_MAX)
}

fn compute_dynamic_threshold(volatility: f64) -> f64 {
    let v = volatility.clamp(0.0, 1.0);
    THRESHOLD_MIN + (THRESHOLD_MAX - THRESHOLD_MIN) * v
}

/// Ξ(a,t) — full behavioral coherence field
fn compute_lattice_moat(lattice: &LatticeData) -> f64 {
    let depth = lattice.agents.values()
        .map(|a| (a.total_actions as f64).ln_1p())
        .sum::<f64>();

    let quality = if lattice.moat_history.len() >= 2 {
        let recent = lattice.moat_history.last().unwrap_or(&0.0);
        let prev = lattice.moat_history
            .get(lattice.moat_history.len().saturating_sub(2))
            .unwrap_or(&0.0);
        if *prev > 0.0 { (recent / prev).min(2.0) } else { 1.0 }
    } else { 1.0 };

    let active = lattice.agents.values().filter(|a| !a.is_silent).count() as f64;
    let total = lattice.agents.len().max(1) as f64;
    let resilience = active / total;

    let novelty = (lattice.agents.len() as f64).ln_1p() / 10.0;
    let federation = (lattice.delegations.len() as f64).ln_1p() / 5.0;

    let moat = MOAT_DEPTH_WEIGHT * depth
        + MOAT_QUALITY_WEIGHT * quality
        + MOAT_RESILIENCE_WEIGHT * resilience
        + MOAT_NOVELTY_WEIGHT * novelty
        + MOAT_FEDERATION_WEIGHT * federation;

    moat.max(0.0)
}

fn detect_limiting_plane(p: f64, f: f64, s: f64, k: f64, a: f64) -> Option<String> {
    let scores = vec![
        ("protocol", p),
        ("fidelity", f),
        ("synergy", s),
        ("knowledge", k),
        ("adaptivity", a),
    ];
    let min = scores.iter().min_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
    min.and_then(|(name, score)| {
        if *score < 0.3 { Some(name.to_string()) } else { None }
    })
}

fn check_graph_invariants(
    lattice: &LatticeData,
    new_delegation: Option<(&Did, &Did)>,
) -> Result<(), String> {
    // Check max out-degree
    let mut out_degrees: HashMap<String, usize> = HashMap::new();
    for (from, _) in &lattice.delegations {
        *out_degrees.entry(did_key(from)).or_insert(0) += 1;
    }
    if let Some((from, _)) = new_delegation {
        let key = did_key(from);
        let current = out_degrees.get(&key).unwrap_or(&0);
        if *current >= MAX_OUT_DEGREE {
            return Err(format!("Max out-degree ({}) exceeded for {}", MAX_OUT_DEGREE, key));
        }
    }

    // Check HHI (Herfindahl-Hirschman Index < 2500 — prevents concentration)
    let total = lattice.agents.len() as f64;
    if total > 0.0 {
        let mut stake: HashMap<String, f64> = HashMap::new();
        for (from, to) in &lattice.delegations {
            *stake.entry(did_key(from)).or_insert(0.0) += 1.0;
            *stake.entry(did_key(to)).or_insert(0.0) += 0.5;
        }
        let hhi = stake.values()
            .map(|s| (*s / total).powi(2))
            .sum::<f64>() * 10000.0;
        if hhi > HHI_LIMIT {
            return Err(format!("HHI limit exceeded: {:.1} > {}", hhi, HHI_LIMIT));
        }
    }

    // Geographic diversity: agents must span >= 3 jurisdictions
    let jurisdictions: std::collections::HashSet<String> = lattice.agents
        .values()
        .map(|a| a.jurisdiction.clone())
        .collect();
    if lattice.agents.len() >= 5 && jurisdictions.len() < MIN_JURISDICTIONS {
        return Err(format!(
            "Insufficient jurisdictions: {} < {}",
            jurisdictions.len(), MIN_JURISDICTIONS
        ));
    }

    Ok(())
}

// === GUEST IMPLEMENTATION ===
struct LatticeEngine;

impl Guest for LatticeEngine {
    fn init_lattice(admin: Did) -> Result<LatticeState, String> {
        let lat = lattice();
        if lat.initialized {
            return Err("Lattice already initialized".to_string());
        }
        lat.admin = Some(admin);
        lat.initialized = true;
        Ok(LatticeState {
            agent_count: 0,
            total_delegations: 0,
            active_silences: 0,
            lattice_moat: 0.0,
            volatility_index: 0.0,
            last_update: now(),
        })
    }

    fn register_agent(agent: Did, initial_claims: Vec<String>) -> Result<CoherenceSnapshot, String> {
        let lat = lattice();
        let key = did_key(&agent);
        if lat.agents.contains_key(&key) {
            return Err("Agent already registered".to_string());
        }
        let jurisdiction = initial_claims.first().cloned().unwrap_or_else(|| "unknown".to_string());
        let profile = AgentProfile {
            did: agent.clone(),
            registered_at: now(),
            coherence_history: Vec::new(),
            current_coherence: None,
            delegation_out: Vec::new(),
            delegation_in: Vec::new(),
            jurisdiction,
            is_silent: false,
            silence_record: None,
            total_actions: 0,
        };
        lat.agents.insert(key.clone(), profile);

        let snapshot = CoherenceSnapshot {
            agent,
            timestamp: now(),
            protocol_score: 0.5,
            fidelity_score: 0.5,
            synergy_score: 0.5,
            knowledge_score: 0.5,
            adaptivity_score: 0.5,
            composite_score: 0.5,
            threshold: DEFAULT_THRESHOLD,
            is_silent: false,
            limiting_plane: None,
            deficit: None,
        };
        lat.agents.get_mut(&key).unwrap().current_coherence = Some(snapshot.clone());
        Ok(snapshot)
    }

    fn compute_coherence(
        agent: Did,
        protocol_actions: u32,
        protocol_violations: u32,
        fidelity_commits: u32,
        fidelity_fulfilled: u32,
        synergy_interactions: u32,
        synergy_positive: u32,
        knowledge_milestones: u32,
        knowledge_stagnation_days: u32,
        adaptivity_shifts: u32,
        adaptivity_zscore: f64,
    ) -> Result<CoherenceSnapshot, String> {
        let lat = lattice();
        let key = did_key(&agent);

        let profile = lat.agents.get_mut(&key).ok_or("Agent not registered")?;
        if profile.is_silent {
            return Err("Agent is in structured silence".to_string());
        }

        let protocol = compute_protocol_score(protocol_actions, protocol_violations);
        let fidelity = compute_fidelity_score(fidelity_commits, fidelity_fulfilled);
        let synergy = compute_synergy_score(synergy_interactions, synergy_positive);
        let knowledge = compute_knowledge_score(knowledge_milestones, knowledge_stagnation_days);
        let adaptivity = compute_adaptivity_score(adaptivity_shifts, adaptivity_zscore);

        let composite = compute_composite_coherence(protocol, fidelity, synergy, knowledge, adaptivity);
        let volatility = lat.moat_history.last().cloned().unwrap_or(0.5);
        let threshold = compute_dynamic_threshold(volatility);
        let is_silent = composite < threshold;
        let limiting_plane = detect_limiting_plane(protocol, fidelity, synergy, knowledge, adaptivity);
        let deficit = if is_silent { Some(threshold - composite) } else { None };

        let snapshot = CoherenceSnapshot {
            agent: agent.clone(),
            timestamp: now(),
            protocol_score: protocol,
            fidelity_score: fidelity,
            synergy_score: synergy,
            knowledge_score: knowledge,
            adaptivity_score: adaptivity,
            composite_score: composite,
            threshold,
            is_silent,
            limiting_plane: limiting_plane.clone(),
            deficit,
        };

        let profile = lat.agents.get_mut(&key).unwrap();
        profile.current_coherence = Some(snapshot.clone());
        profile.coherence_history.push(snapshot.clone());
        profile.total_actions += protocol_actions as u64;

        if is_silent {
            profile.is_silent = true;
            let silence = SilenceRecord {
                agent: agent.clone(),
                silenced_at: now(),
                reason: "Behavioral coherence below dynamic threshold".to_string(),
                limiting_plane: limiting_plane.clone().unwrap_or_else(|| "composite".to_string()),
                deficit: deficit.unwrap_or(0.0),
                estimated_recovery: now() + 86400,
                remediation_actions: vec![
                    "Increase protocol adherence".to_string(),
                    "Fulfill all pending commitments".to_string(),
                    "Engage in positive inter-agent interactions".to_string(),
                ],
            };
            profile.silence_record = Some(silence.clone());
            lat.silence_registry.push(silence);
        }

        let moat = compute_lattice_moat(lat);
        lat.moat_history.push(moat);

        Ok(snapshot)
    }

    fn evaluate_delegation(delegator: Did, delegatee: Did) -> Result<DelegationResult, String> {
        let lat = lattice();
        let dk = did_key(&delegator);
        let dk2 = did_key(&delegatee);

        let delegator_profile = lat.agents.get(&dk).ok_or("Delegator not registered")?;
        let delegatee_profile = lat.agents.get(&dk2).ok_or("Delegatee not registered")?;

        if delegator_profile.is_silent {
            return Ok(DelegationResult::Rejected("Delegator is in structured silence".to_string()));
        }
        if delegatee_profile.is_silent {
            return Ok(DelegationResult::Rejected("Delegatee is in structured silence".to_string()));
        }

        let d_coh = delegator_profile.current_coherence.as_ref()
            .ok_or("Delegator has no coherence record")?;
        let t_coh = delegatee_profile.current_coherence.as_ref()
            .ok_or("Delegatee has no coherence record")?;

        if d_coh.composite_score < d_coh.threshold {
            return Ok(DelegationResult::Rejected("Delegator coherence below threshold".to_string()));
        }
        if t_coh.composite_score < t_coh.threshold {
            return Ok(DelegationResult::Rejected("Delegatee coherence below threshold".to_string()));
        }

        check_graph_invariants(lat, Some((&delegator, &delegatee)))?;

        let vc = DelegationVc {
            issuer: delegator.clone(),
            holder: delegatee.clone(),
            issued_at: now(),
            expires_at: now() + 604800, // 7 days
            coherence_proof: Vec::new(), // Production: BBS+ selective disclosure proof
            delegation_rights: vec![
                "sub-delegate".to_string(),
                "act-on-behalf".to_string(),
                "read-lattice-state".to_string(),
            ],
            max_sub_delegations: 3,
        };

        lat.delegations.push((delegator.clone(), delegatee.clone()));
        if let Some(p) = lat.agents.get_mut(&dk) { p.delegation_out.push(delegatee.clone()); }
        if let Some(p) = lat.agents.get_mut(&dk2) { p.delegation_in.push(delegator.clone()); }

        Ok(DelegationResult::Approved(vc))
    }

    fn revoke_delegation(delegator: Did, delegatee: Did, _reason: String) -> Result<bool, String> {
        let lat = lattice();
        lat.delegations.retain(|(d, del)| {
            !(did_key(d) == did_key(&delegator) && did_key(del) == did_key(&delegatee))
        });
        let dk = did_key(&delegator);
        let dk2 = did_key(&delegatee);
        if let Some(p) = lat.agents.get_mut(&dk) {
            p.delegation_out.retain(|d| did_key(d) != dk2);
        }
        if let Some(p) = lat.agents.get_mut(&dk2) {
            p.delegation_in.retain(|d| did_key(d) != dk);
        }
        Ok(true)
    }

    fn enter_silence(
        agent: Did,
        reason: String,
        limiting_plane: Plane,
        deficit: f64,
        estimated_recovery: u64,
    ) -> Result<SilenceRecord, String> {
        let lat = lattice();
        let key = did_key(&agent);
        let profile = lat.agents.get_mut(&key).ok_or("Agent not registered")?;
        profile.is_silent = true;

        let plane_str = match limiting_plane {
            Plane::Protocol => "protocol",
            Plane::Fidelity => "fidelity",
            Plane::Synergy => "synergy",
            Plane::Knowledge => "knowledge",
            Plane::Adaptivity => "adaptivity",
        }.to_string();

        let remediation = match limiting_plane {
            Plane::Protocol => vec!["Review protocol compliance".to_string(), "Rebuild signature validity".to_string()],
            Plane::Fidelity => vec!["Fulfill pending commitments".to_string(), "Improve action-outcome alignment".to_string()],
            Plane::Synergy => vec!["Engage in cooperative interactions".to_string(), "Resolve conflicts with peers".to_string()],
            Plane::Knowledge => vec!["Complete learning milestones".to_string(), "Update domain expertise".to_string()],
            Plane::Adaptivity => vec!["Stabilize behavioral patterns".to_string(), "Reduce erratic z-score".to_string()],
        };

        let record = SilenceRecord {
            agent: agent.clone(),
            silenced_at: now(),
            reason,
            limiting_plane: plane_str,
            deficit,
            estimated_recovery,
            remediation_actions: remediation,
        };
        profile.silence_record = Some(record.clone());
        lat.silence_registry.push(record.clone());
        Ok(record)
    }

    fn exit_silence(agent: Did) -> Result<CoherenceSnapshot, String> {
        let lat = lattice();
        let key = did_key(&agent);
        let profile = lat.agents.get_mut(&key).ok_or("Agent not registered")?;
        profile.is_silent = false;
        profile.silence_record = None;
        // Recovery starts fresh — return current coherence if available
        profile.current_coherence.clone().ok_or("No coherence record".to_string())
    }

    fn get_lattice_state() -> Result<LatticeState, String> {
        let lat = lattice();
        let moat = compute_lattice_moat(lat);
        let active_silences = lat.agents.values().filter(|a| a.is_silent).count() as u32;
        Ok(LatticeState {
            agent_count: lat.agents.len() as u32,
            total_delegations: lat.delegations.len() as u32,
            active_silences,
            lattice_moat: moat,
            volatility_index: 0.5,
            last_update: now(),
        })
    }

    fn get_agent_coherence(agent: Did) -> Result<CoherenceSnapshot, String> {
        let lat = lattice();
        let key = did_key(&agent);
        let profile = lat.agents.get(&key).ok_or("Agent not registered")?;
        profile.current_coherence.clone().ok_or("No coherence record".to_string())
    }

    fn get_silence_registry() -> Result<Vec<SilenceRecord>, String> {
        let lat = lattice();
        Ok(lat.silence_registry.clone())
    }

    fn verify_graph_invariants() -> Result<bool, String> {
        let lat = lattice();
        check_graph_invariants(lat, None).map(|()| true)
    }

    fn compute_lattice_moat() -> Result<f64, String> {
        let lat = lattice();
        Ok(compute_lattice_moat(lat))
    }
}

export!(LatticeEngine);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_score_perfect() {
        assert_eq!(compute_protocol_score(100, 0), 1.0);
    }

    #[test]
    fn test_protocol_score_zero_violations() {
        let score = compute_protocol_score(100, 100);
        assert_eq!(score, 0.0);
    }

    #[test]
    fn test_knowledge_hard_zero() {
        assert_eq!(compute_knowledge_score(10, 31), 0.0);
    }

    #[test]
    fn test_adaptivity_hard_zero() {
        assert_eq!(compute_adaptivity_score(10, 3.5), 0.0);
    }

    #[test]
    fn test_composite_weights_sum_to_one() {
        let sum = W_PROTOCOL + W_FIDELITY + W_SYNERGY + W_KNOWLEDGE + W_ADAPTIVITY;
        assert!((sum - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_moat_weights_sum_to_one() {
        let sum = MOAT_DEPTH_WEIGHT + MOAT_QUALITY_WEIGHT + MOAT_RESILIENCE_WEIGHT
            + MOAT_NOVELTY_WEIGHT + MOAT_FEDERATION_WEIGHT;
        assert!((sum - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_composite_perfect_behavior() {
        let score = compute_composite_coherence(1.0, 1.0, 1.0, 1.0, 1.0);
        assert_eq!(score, 1.0);
    }

    #[test]
    fn test_dynamic_threshold_range() {
        let low = compute_dynamic_threshold(0.0);
        let high = compute_dynamic_threshold(1.0);
        assert!((low - THRESHOLD_MIN).abs() < 1e-10);
        assert!((high - THRESHOLD_MAX).abs() < 1e-10);
    }
}
