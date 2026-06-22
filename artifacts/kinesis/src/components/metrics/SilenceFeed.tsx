import { motion, AnimatePresence } from 'framer-motion';

interface Agent {
  id: string;
  name: string;
  isSilent: boolean;
  coherence: {
    composite: number;
    threshold: number;
    limitingPlane?: string;
    deficit?: number;
  } | null;
  jurisdiction: string;
}

interface Props {
  topology: { agents: Agent[] } | null;
  events: string[];
}

const PLANE_LABELS: Record<string, string> = {
  protocol: 'Π Protocol — A2A adherence breakdown',
  fidelity: 'Φ Fidelity — commitment–outcome mismatch',
  synergy: 'Σ Synergy — negative interaction ratio',
  knowledge: 'Κ Knowledge — stagnation > 30 days',
  adaptivity: 'Α Adaptivity — behavioral z-score > 3σ',
};

const REMEDIATION: Record<string, string> = {
  protocol: 'Rebuild signature validity, review credential chain',
  fidelity: 'Fulfill pending commitments, improve outcome rate',
  synergy: 'Engage in positive peer interactions',
  knowledge: 'Complete learning milestones, reduce stagnation',
  adaptivity: 'Stabilize behavior, reduce erratic z-score',
};

export function SilenceFeed({ topology, events }: Props) {
  const silentAgents = topology?.agents.filter(a => a.isSilent) ?? [];

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs text-[#ff4d4d] mb-2 font-bold">
          ⚠ Active Silences ({silentAgents.length})
        </div>
        {silentAgents.length === 0 ? (
          <div className="text-xs text-[#6b7280] italic">All agents coherent — lattice healthy</div>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            <AnimatePresence>
              {silentAgents.map(agent => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="border border-[#ff4d4d44] bg-[#ff4d4d0a] rounded p-2 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#ff4d4d] font-bold">{agent.name}</span>
                    <span className="text-[#6b7280]">[{agent.jurisdiction}]</span>
                  </div>
                  {agent.coherence && (
                    <>
                      <div className="text-[#6b7280]">
                        Ξ(a,t) = <span className="text-[#ff4d4d]">{agent.coherence.composite.toFixed(3)}</span>
                        {' '}<span className="text-[#6b7280]">threshold:</span>
                        {' '}<span className="text-[#ffbb28]">{agent.coherence.threshold.toFixed(3)}</span>
                        {' '}<span className="text-[#ff4d4d]">deficit: -{agent.coherence.deficit?.toFixed(3)}</span>
                      </div>
                      {agent.coherence.limitingPlane && (
                        <div className="text-[#ffbb28] mt-1">
                          Limiting: {PLANE_LABELS[agent.coherence.limitingPlane] || agent.coherence.limitingPlane}
                        </div>
                      )}
                      {agent.coherence.limitingPlane && (
                        <div className="text-[#6b7280] mt-1 text-[10px]">
                          ↳ {REMEDIATION[agent.coherence.limitingPlane] || 'Improve behavioral coherence'}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div>
        <div className="text-xs text-[#6b7280] mb-2 font-bold">
          Event Log
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {events.length === 0 ? (
            <div className="text-xs text-[#6b7280] italic">No silence events — all agents operational</div>
          ) : (
            events.map((event, i) => (
              <div key={i} className="text-xs text-[#6b7280] border-l border-[#1e2d3d] pl-2">
                {event}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
