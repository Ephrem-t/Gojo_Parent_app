import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const PRIMARY = "#1E90FF";
const TEXT = "#0F172A";
const MUTED = "#64748B";

export default function PaymentsTab() {
  return (
    <View>
      <LinearGradient
        colors={["#FFFFFF", "#F9FBFF", "#F1F7FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <Text style={styles.heroTitle}>Make Payment</Text>
        <Text style={styles.heroSub}>Secure school fee payment, coming soon.</Text>

        <View style={styles.heroStatusCard}>
          <View>
            <Text style={styles.heroStatusLabel}>Status</Text>
            <Text style={styles.heroStatusValue}>Gateway setup pending</Text>
          </View>
          <Text style={styles.heroStatusBadge}>Coming Soon</Text>
        </View>

        <View style={styles.heroFeatureRow}>
          <View style={styles.heroFeatureChip}>
            <Ionicons name="card-outline" size={13} color={PRIMARY} />
            <Text style={styles.heroFeatureText}>Card</Text>
          </View>
          <View style={styles.heroFeatureChip}>
            <Ionicons name="phone-portrait-outline" size={13} color={PRIMARY} />
            <Text style={styles.heroFeatureText}>Wallet</Text>
          </View>
          <View style={styles.heroFeatureChip}>
            <Ionicons name="business-outline" size={13} color={PRIMARY} />
            <Text style={styles.heroFeatureText}>Bank</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.heroPrimaryBtn} disabled activeOpacity={0.9}>
          <Ionicons name="lock-closed-outline" size={16} color="#FFFFFF" style={styles.heroPrimaryBtnIcon} />
          <Text style={styles.heroPrimaryBtnText}>Pay Now (Disabled)</Text>
        </TouchableOpacity>
      </LinearGradient>

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
  heroCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E3EDF9",
    shadowColor: "#9FBFE6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(30,144,255,0.08)",
    top: -70,
    right: -30,
  },
  heroGlowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.06)",
    bottom: -38,
    left: -18,
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: TEXT,
    letterSpacing: 0.2,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 20,
    color: MUTED,
    marginTop: 8,
  },
  heroStatusCard: {
    marginTop: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "#F7FAFF",
    borderWidth: 1,
    borderColor: "#DCE9FA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heroStatusLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroStatusValue: {
    marginTop: 4,
    color: TEXT,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    maxWidth: 200,
  },
  heroStatusBadge: {
    color: "#FFF7ED",
    backgroundColor: "rgba(249,115,22,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,214,170,0.28)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "800",
  },
  heroFeatureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  heroFeatureChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3F8FF",
    borderWidth: 1,
    borderColor: "#D9E8FB",
  },
  heroFeatureText: {
    color: TEXT,
    fontSize: 12,
    fontWeight: "700",
  },
  heroPrimaryBtn: {
    marginTop: 2,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    backgroundColor: PRIMARY,
    borderWidth: 1,
    borderColor: "#1978DA",
    opacity: 0.72,
  },
  heroPrimaryBtnIcon: {
    marginRight: 8,
  },
  heroPrimaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
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