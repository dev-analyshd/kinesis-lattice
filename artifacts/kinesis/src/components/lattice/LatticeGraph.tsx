import { useEffect, useRef, useMemo } from 'react';

interface Agent {
  id: string;
  name: string;
  did: string;
  coherence: { composite: number; isSilent: boolean } | null;
  isSilent: boolean;
  jurisdiction: string;
}

interface Edge {
  from: string;
  to: string;
  weight: number;
}

interface Props {
  topology: { agents: Agent[]; edges: Edge[]; moat: number } | null;
}

function coherenceColor(agent: Agent): string {
  if (agent.isSilent) return '#ff4d4d';
  const c = agent.coherence?.composite ?? 0.5;
  if (c >= 0.75) return '#00f5c4';
  if (c >= 0.60) return '#ffbb28';
  return '#f97316';
}

export function LatticeGraph({ topology }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const { positions, agents, edges } = useMemo(() => {
    if (!topology || topology.agents.length === 0) {
      return { positions: new Map<string, { x: number; y: number }>(), agents: [], edges: [] };
    }

    const agents = topology.agents;
    const positions = new Map<string, { x: number; y: number }>();

    const cx = 350, cy = 200, r = 140;
    agents.forEach((agent, i) => {
      const angle = (2 * Math.PI * i) / agents.length - Math.PI / 2;
      positions.set(agent.id, {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      });
    });

    return { positions, agents, edges: topology.edges };
  }, [topology]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#1e2d3d33';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      if (agents.length === 0) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for lattice agents...', canvas.width / 2, canvas.height / 2);
        return;
      }

      for (const edge of edges) {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) continue;

        const alpha = 0.3 + edge.weight * 0.5;
        ctx.strokeStyle = `rgba(0, 245, 196, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);

        const mx = (from.x + to.x) / 2 - (to.y - from.y) * 0.1;
        const my = (from.y + to.y) / 2 + (to.x - from.x) * 0.1;
        ctx.quadraticCurveTo(mx, my, to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);

        const angle = Math.atan2(to.y - my, to.x - mx);
        ctx.fillStyle = `rgba(0, 245, 196, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - 8 * Math.cos(angle - 0.4), to.y - 8 * Math.sin(angle - 0.4));
        ctx.lineTo(to.x - 8 * Math.cos(angle + 0.4), to.y - 8 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
      }

      for (const agent of agents) {
        const pos = positions.get(agent.id);
        if (!pos) continue;

        const color = coherenceColor(agent);
        const radius = 14 + (agent.coherence?.composite ?? 0.5) * 8;
        const pulse = agent.isSilent
          ? 0
          : Math.sin(frame * 0.03 + agents.indexOf(agent)) * 2;

        const grd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius + 12 + pulse);
        grd.addColorStop(0, color + '40');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius + 12 + pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color + '22';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(agent.name.length > 12 ? agent.name.slice(0, 12) : agent.name, pos.x, pos.y + radius + 16);

        const cVal = agent.coherence?.composite.toFixed(2) ?? 'N/A';
        ctx.fillStyle = color;
        ctx.font = '9px monospace';
        ctx.fillText(`Ξ=${cVal}`, pos.x, pos.y + radius + 26);

        if (agent.isSilent) {
          ctx.fillStyle = '#ff4d4d';
          ctx.font = '9px monospace';
          ctx.fillText('SILENT', pos.x, pos.y + radius + 36);
        }

        ctx.fillStyle = '#6b7280';
        ctx.font = '8px monospace';
        ctx.fillText(agent.jurisdiction, pos.x, pos.y - radius - 8);
      }

      frame++;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [agents, edges, positions]);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={400}
      className="w-full rounded"
      style={{ background: 'transparent' }}
    />
  );
}
