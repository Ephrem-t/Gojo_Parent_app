import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import PaymentsTab from "../school/payments";
import HistoryTab from "../school/history";
import CalendarTab from "../school/calendar";

const PRIMARY = "#1E90FF";
const BG = "#FFFFFF";
const TEXT = "#0F172A";

const TABS = ["Payments", "History", "Calendar"];

export default function SchoolScreen() {
  const [activeTab, setActiveTab] = useState("Payments");

  const renderTab = () => {
    if (activeTab === "Payments") return <PaymentsTab />;
    if (activeTab === "History") return <HistoryTab />;
    return <CalendarTab />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>School Services</Text>
        <Text style={styles.headerSub}>Parent Dashboard</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const active = activeTab === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setActiveTab(t)}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1 }}>{renderTab()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 14 },
  headerCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: TEXT },
  headerSub: { fontSize: 13, color: "#64748B", marginTop: 4 },

  tabRow: {
    flexDirection: "row",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: PRIMARY },
  tabText: { color: "#334155", fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#fff" },
});