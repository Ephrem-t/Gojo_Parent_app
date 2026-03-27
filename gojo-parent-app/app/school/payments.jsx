import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY = "#1E90FF";
const TEXT = "#0F172A";
const MUTED = "#64748B";

export default function PaymentsTab() {
  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Make Payment</Text>
        <Text style={styles.cardSub}>
          Pay school fees securely. Payment provider integration will be enabled soon.
        </Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={styles.badgePending}>Coming Soon</Text>
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { opacity: 0.65 }]} disabled>
          <Ionicons name="card-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.primaryBtnText}>Pay Now (Disabled)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What will be supported</Text>
        <Text style={styles.bullet}>• Tuition / Fee payment</Text>
        <Text style={styles.bullet}>• Mobile wallet / Card / Bank options</Text>
        <Text style={styles.bullet}>• Instant confirmation receipt</Text>
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
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: TEXT },
  cardSub: { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 10 },

  bullet: { fontSize: 13, color: TEXT, marginBottom: 6 },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    alignItems: "center",
  },
  infoLabel: { fontSize: 13, color: MUTED },
  badgePending: {
    fontSize: 12,
    color: "#9A3412",
    backgroundColor: "#FFEDD5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: "700",
  },

  primaryBtn: {
    marginTop: 4,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});