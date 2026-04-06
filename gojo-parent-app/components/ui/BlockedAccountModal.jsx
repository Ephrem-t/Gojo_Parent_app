import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY = "#0F6FFF";

export default function BlockedAccountModal({
  visible,
  title = "Access blocked",
  message,
  caption = "",
  primaryLabel = "Contact School",
  secondaryLabel = "OK",
  onPrimaryPress,
  onSecondaryPress,
  primaryDisabled = false,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSecondaryPress}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={22} color="#C2410C" />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}

          {onPrimaryPress ? (
            <TouchableOpacity
              activeOpacity={0.88}
              disabled={primaryDisabled}
              onPress={onPrimaryPress}
              style={[styles.primaryButton, primaryDisabled && styles.primaryButtonDisabled]}
            >
              <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity activeOpacity={0.82} onPress={onSecondaryPress} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: "#111827",
  },
  message: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
  },
  caption: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280",
  },
  primaryButton: {
    marginTop: 18,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    marginTop: 10,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D9E6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: "#1F2937",
    fontSize: 15,
    fontWeight: "700",
  },
});