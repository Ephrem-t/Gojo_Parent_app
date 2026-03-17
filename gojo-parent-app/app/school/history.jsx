import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const TEXT = "#0F172A";
const MUTED = "#64748B";

export default function HistoryTab() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Payment History</Text>
      <Text style={styles.cardSub}>
        We’ll show all completed payments for your child here.
      </Text>
      <View style={styles.emptyWrap}>
        <Ionicons name="receipt-outline" size={26} color={MUTED} />
        <Text style={styles.emptyText}>
          Waiting for payment history database structure.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: TEXT },
  cardSub: { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 10 },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 26 },
  emptyText: { color: MUTED, marginTop: 8, textAlign: "center", fontSize: 13 },
});