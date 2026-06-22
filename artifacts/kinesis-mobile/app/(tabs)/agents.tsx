import React from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useLattice, Agent } from "@/context/LatticeContext";
import { useColors } from "@/hooks/useColors";

const PLANE_COLORS = ["green", "blue", "purple", "yellow", "orange"] as const;
const PLANE_KEYS = ["protocol", "fidelity", "synergy", "knowledge", "adaptivity"] as const;
const PLANE_LABELS: Record<string, string> = {
  protocol: "Π",
  fidelity: "Φ",
  synergy: "Σ",
  knowledge: "Κ",
  adaptivity: "Α",
};

function CoherenceBar({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.barRow}>
      <Text style={[styles.planeLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.barTrack, { backgroundColor: colors.secondary }]}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.round(value * 100)}%` as `${number}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={[styles.barValue, { color }]}>{(value * 100).toFixed(0)}%</Text>
    </View>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const colors = useColors();

  const coherenceColor =
    agent.isSilent
      ? colors.red
      : (agent.coherence?.composite ?? 0) >= 0.75
      ? colors.green
      : (agent.coherence?.composite ?? 0) >= 0.6
      ? colors.yellow
      : colors.orange;

  return (
    <View
      style={[
        styles.agentCard,
        {
          backgroundColor: colors.card,
          borderColor: agent.isSilent ? colors.red + "44" : colors.border,
          borderWidth: 1,
        },
      ]}
    >
      <View style={styles.agentHeader}>
        <View style={styles.agentNameRow}>
          <View style={[styles.agentDot, { backgroundColor: coherenceColor }]} />
          <Text style={[styles.agentName, { color: colors.foreground }]} numberOfLines={1}>
            {agent.name}
          </Text>
          {agent.isSilent && (
            <View style={[styles.silentBadge, { backgroundColor: colors.red + "22", borderColor: colors.red + "44" }]}>
              <Text style={[styles.silentBadgeText, { color: colors.red }]}>SILENT</Text>
            </View>
          )}
        </View>
        <Text style={[styles.coherenceScore, { color: coherenceColor }]}>
          Ξ={agent.coherence?.composite.toFixed(3) ?? "N/A"}
        </Text>
      </View>

      <Text style={[styles.agentJurisdiction, { color: colors.mutedForeground }]}>
        {agent.jurisdiction}
      </Text>

      {agent.coherence?.planes && (
        <View style={styles.planesContainer}>
          {PLANE_KEYS.map((key, i) => (
            <CoherenceBar
              key={key}
              label={PLANE_LABELS[key]}
              value={agent.coherence!.planes[key]}
              // @ts-ignore
              color={colors[PLANE_COLORS[i]]}
            />
          ))}
        </View>
      )}

      {agent.coherence?.limitingPlane && agent.isSilent && (
        <Text style={[styles.limitingPlane, { color: colors.yellow }]}>
          Limiting: {PLANE_LABELS[agent.coherence.limitingPlane] ?? agent.coherence.limitingPlane}{" "}
          {agent.coherence.limitingPlane}
        </Text>
      )}

      <Text style={[styles.actionsText, { color: colors.mutedForeground }]}>
        {agent.totalActions} actions
      </Text>
    </View>
  );
}

export default function AgentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topology, connected } = useLattice();
  const agents = topology?.agents ?? [];

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Agents</Text>
        <View style={styles.countBadge}>
          <View
            style={[
              styles.countDot,
              { backgroundColor: connected ? colors.primary : colors.red },
            ]}
          />
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>
            {agents.length} total
          </Text>
        </View>
      </View>

      <FlatList
        data={agents}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <AgentCard agent={item} />}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: Platform.OS === "web" ? 34 : 100,
          paddingTop: 8,
        }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!agents.length}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No agents yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Spawn agents from the Overview tab
            </Text>
          </View>
        }
      />
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
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  countDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  countText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  agentCard: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  agentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  agentNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  agentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  agentName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  silentBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  silentBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  coherenceScore: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
  },
  agentJurisdiction: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  planesContainer: {
    gap: 5,
    marginBottom: 8,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  planeLabel: {
    width: 16,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  barTrack: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2.5,
  },
  barValue: {
    width: 32,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
  },
  limitingPlane: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  actionsText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
