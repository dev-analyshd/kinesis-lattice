import React from "react";
import {
  FlatList,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

import { useLattice, Agent } from "@/context/LatticeContext";
import { useColors } from "@/hooks/useColors";

const PLANE_LABELS: Record<string, string> = {
  protocol: "Π Protocol — A2A adherence breakdown",
  fidelity: "Φ Fidelity — commitment–outcome mismatch",
  synergy: "Σ Synergy — negative interaction ratio",
  knowledge: "Κ Knowledge — stagnation > 30 days",
  adaptivity: "Α Adaptivity — behavioral z-score > 3σ",
};

const REMEDIATION: Record<string, string> = {
  protocol: "Rebuild signature validity, review credential chain",
  fidelity: "Fulfill pending commitments, improve outcome rate",
  synergy: "Engage in positive peer interactions",
  knowledge: "Complete learning milestones, reduce stagnation",
  adaptivity: "Stabilize behavior, reduce erratic z-score",
};

function SilentAgentCard({ agent }: { agent: Agent }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.silentCard,
        {
          backgroundColor: colors.red + "0a",
          borderColor: colors.red + "33",
        },
      ]}
    >
      <View style={styles.silentCardHeader}>
        <View style={styles.silentNameRow}>
          <MaterialCommunityIcons name="bell-off" size={14} color={colors.red} />
          <Text style={[styles.silentAgentName, { color: colors.red }]}>{agent.name}</Text>
        </View>
        <Text style={[styles.jurisdictionText, { color: colors.mutedForeground }]}>
          [{agent.jurisdiction}]
        </Text>
      </View>

      {agent.coherence && (
        <View style={styles.coherenceDetails}>
          <View style={styles.coherenceRow}>
            <Text style={[styles.coherenceLabel, { color: colors.mutedForeground }]}>Ξ(a,t) =</Text>
            <Text style={[styles.coherenceValue, { color: colors.red }]}>
              {agent.coherence.composite.toFixed(3)}
            </Text>
            <Text style={[styles.coherenceLabel, { color: colors.mutedForeground }]}> threshold:</Text>
            <Text style={[styles.coherenceThreshold, { color: colors.yellow }]}>
              {agent.coherence.threshold.toFixed(3)}
            </Text>
          </View>
          {agent.coherence.deficit != null && (
            <Text style={[styles.deficitText, { color: colors.red }]}>
              deficit: -{agent.coherence.deficit.toFixed(3)}
            </Text>
          )}
          {agent.coherence.limitingPlane && (
            <>
              <Text style={[styles.limitingLabel, { color: colors.yellow }]}>
                {PLANE_LABELS[agent.coherence.limitingPlane] ?? agent.coherence.limitingPlane}
              </Text>
              <Text style={[styles.remediationText, { color: colors.mutedForeground }]}>
                ↳ {REMEDIATION[agent.coherence.limitingPlane] ?? "Improve behavioral coherence"}
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function EventLogItem({ event }: { event: string }) {
  const colors = useColors();
  return (
    <View style={[styles.eventItem, { borderLeftColor: colors.border }]}>
      <Text style={[styles.eventText, { color: colors.mutedForeground }]}>{event}</Text>
    </View>
  );
}

export default function SilencesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topology, silenceEvents } = useLattice();
  const silentAgents = topology?.agents.filter((a) => a.isSilent) ?? [];

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;

  const sections = [
    {
      key: "silences",
      title: `Active Silences (${silentAgents.length})`,
      titleColor: silentAgents.length > 0 ? colors.red : colors.green,
      data: silentAgents.length > 0 ? silentAgents : (["healthy"] as (Agent | string)[]),
      isHealthy: silentAgents.length === 0,
    },
    {
      key: "log",
      title: "Event Log",
      titleColor: colors.mutedForeground,
      data: silenceEvents.length > 0 ? silenceEvents : (["noevents"] as (Agent | string)[]),
      isLog: true,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Silences</Text>
        {silentAgents.length > 0 && (
          <View style={[styles.alertBadge, { backgroundColor: colors.red + "22", borderColor: colors.red + "44" }]}>
            <MaterialCommunityIcons name="bell-off" size={12} color={colors.red} />
            <Text style={[styles.alertBadgeText, { color: colors.red }]}>
              {silentAgents.length} SILENT
            </Text>
          </View>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => String(index)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: Platform.OS === "web" ? 34 : 100,
          paddingTop: 8,
        }}
        renderSectionHeader={({ section }) => (
          <Text
            style={[
              styles.sectionHeader,
              { color: (section as typeof sections[0]).titleColor },
            ]}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item, section }) => {
          const sec = section as typeof sections[0];
          if (sec.isHealthy || item === "healthy") {
            return (
              <View style={styles.healthyState}>
                <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                <Text style={[styles.healthyText, { color: colors.mutedForeground }]}>
                  All agents coherent — lattice healthy
                </Text>
              </View>
            );
          }
          if (sec.isLog) {
            if (item === "noevents") {
              return (
                <View style={styles.healthyState}>
                  <Ionicons name="document-text-outline" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.healthyText, { color: colors.mutedForeground }]}>
                    No silence events recorded
                  </Text>
                </View>
              );
            }
            return <EventLogItem event={item as string} />;
          }
          return <SilentAgentCard agent={item as Agent} />;
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              All clear
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              No silence events to report
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
  alertBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  alertBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
  silentCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  silentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  silentNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  silentAgentName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  jurisdictionText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  coherenceDetails: {
    gap: 3,
  },
  coherenceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 2,
  },
  coherenceLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  coherenceValue: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  coherenceThreshold: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  deficitText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  limitingLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  remediationText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    lineHeight: 14,
  },
  eventItem: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  eventText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  healthyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  healthyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
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
