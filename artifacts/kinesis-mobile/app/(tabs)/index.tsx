import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useLattice } from "@/context/LatticeContext";
import { useColors } from "@/hooks/useColors";

function PulsingDot({ active }: { active: boolean }) {
  const colors = useColors();
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    if (active) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 700 }),
          withTiming(1, { duration: 700 })
        ),
        -1,
        false
      );
    } else {
      opacity.value = 1;
    }
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: active ? colors.primary : colors.red,
        },
      ]}
    />
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  color: string;
}

function MetricCard({ label, value, unit, color }: MetricCardProps) {
  const colors = useColors();
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
        {unit ? <Text style={[styles.metricUnit, { color: colors.mutedForeground }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

export default function OverviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topology, connected, lastUpdate, spawnAgent, moatHistory } = useLattice();

  const agents = topology?.agents ?? [];
  const edges = topology?.edges ?? [];
  const silences = topology?.activeSilences ?? 0;
  const moat = topology?.moat ?? 0;
  const volatility = topology?.volatility ?? 0;
  const activeAgents = agents.filter((a) => !a.isSilent).length;
  const avgCoherence =
    agents.length > 0
      ? agents.reduce((s, a) => s + (a.coherence?.composite ?? 0.5), 0) / agents.length
      : 0;

  const healthLabel =
    silences === 0 ? "OPTIMAL" : silences <= 1 ? "DEGRADED" : "CRITICAL";
  const healthColor =
    silences === 0 ? colors.green : silences <= 1 ? colors.yellow : colors.red;

  const handleSpawn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await spawnAgent();
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.logoText, { color: colors.primary }]}>⬡ KINESIS</Text>
          <Text style={[styles.subText, { color: colors.mutedForeground }]}>
            Living Delegation Lattice
          </Text>
        </View>
        <View style={styles.statusRow}>
          <PulsingDot active={connected} />
          <Text style={[styles.statusText, { color: connected ? colors.primary : colors.red }]}>
            {connected ? "LIVE" : "OFFLINE"}
          </Text>
        </View>
      </View>

      {lastUpdate && (
        <Text style={[styles.updateText, { color: colors.mutedForeground }]}>
          Updated {lastUpdate.toLocaleTimeString()}
        </Text>
      )}

      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>LATTICE STATUS</Text>
        <View style={styles.metricsGrid}>
          <MetricCard label="AGENTS" value={String(agents.length)} color={colors.primary} />
          <MetricCard label="ACTIVE" value={String(activeAgents)} color={colors.blue} />
          <MetricCard label="DELEGATIONS" value={String(edges.length)} color={colors.purple} />
          <MetricCard
            label="SILENCES"
            value={String(silences)}
            color={silences > 0 ? colors.red : colors.mutedForeground}
          />
        </View>
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>COHERENCE & TRUST</Text>
        <View style={styles.metricsGrid}>
          <MetricCard label="AVG Ξ(a,t)" value={avgCoherence.toFixed(3)} color={colors.primary} />
          <MetricCard label="MOAT Λ(t)" value={moat.toFixed(3)} color={colors.yellow} />
          <MetricCard
            label="VOLATILITY V(t)"
            value={(volatility * 100).toFixed(1)}
            unit="%"
            color={colors.orange}
          />
          <MetricCard label="HEALTH" value={healthLabel} color={healthColor} />
        </View>
      </View>

      {moatHistory.length > 1 && (
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>MOAT TREND</Text>
          <View style={[styles.sparklineContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MoatSparkline history={moatHistory} color={colors.yellow} />
          </View>
        </View>
      )}

      <Pressable
        onPress={handleSpawn}
        style={({ pressed }) => [
          styles.spawnButton,
          {
            borderColor: colors.primary,
            backgroundColor: pressed ? colors.primary + "22" : "transparent",
          },
        ]}
        testID="spawn-agent-button"
      >
        <Text style={[styles.spawnButtonText, { color: colors.primary }]}>+ SPAWN AGENT</Text>
      </Pressable>

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        KINESIS v0.1.0 · Trust is earned, not given.
      </Text>
    </ScrollView>
  );
}

function MoatSparkline({
  history,
  color,
}: {
  history: { time: number; moat: number }[];
  color: string;
}) {
  const colors = useColors();
  if (history.length < 2) return null;

  const values = history.map((h) => h.moat);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 280;
  const H = 60;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  });

  return (
    <View style={{ height: H + 16, paddingHorizontal: 8 }}>
      <Text style={{ color: color, fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4 }}>
        Λ(t) = {values[values.length - 1].toFixed(4)}
      </Text>
      <View style={{ height: H, width: "100%" }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 9, position: "absolute", bottom: 0, left: 0 }}>
          {min.toFixed(3)}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 9, position: "absolute", top: 0, left: 0 }}>
          {max.toFixed(3)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  logoText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  subText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
  },
  updateText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 20,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: "44%",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  metricLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  metricValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  metricUnit: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  sparklineContainer: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  spawnButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: "center",
  },
  spawnButtonText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
  },
  footer: {
    textAlign: "center",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    paddingHorizontal: 20,
    letterSpacing: 0.5,
  },
});
