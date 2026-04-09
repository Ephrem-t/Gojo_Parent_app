import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useParentTheme } from "../../hooks/use-parent-theme";

export default function PaymentsTab() {
  const { colors, isDark, amharic, oromo } = useParentTheme();
  const palette = useMemo(
    () => ({
      primary: colors.primary,
      text: colors.text,
      muted: colors.muted,
      card: colors.card,
      border: colors.border,
      heroGradientStart: colors.heroSurface,
      heroGradientMid: colors.cardMuted,
      heroGradientEnd: colors.primarySoft,
      heroBorder: isDark ? colors.borderStrong : "#E3EDF9",
      heroShadow: isDark ? "#000000" : "#9FBFE6",
      heroGlowOne: colors.heroOrbPrimary,
      heroGlowTwo: colors.heroOrbSecondary,
      statusCardBg: colors.inputBackground,
      statusCardBorder: colors.infoBorder,
      warningText: colors.warning,
      warningBg: colors.warningSoft,
      featureChipBg: colors.primarySoftAlt,
      featureChipBorder: colors.infoBorder,
      buttonBorder: colors.primaryDark,
      white: colors.white,
    }),
    [colors, isDark]
  );
  const styles = useMemo(() => createStyles(palette), [palette]);
  const labels = useMemo(
    () => {
      if (oromo) {
        return {
          heroTitle: "Kaffaltii raawwadhu",
          heroSub: "Kaffaltii mana barumsaa nagaadhaan kaffaluun dhihoo keessatti ni qophaa'a.",
          status: "Haala",
          gatewayPending: "Qophiin karaa kaffaltii eeggamaa jira",
          comingSoon: "Dhihootti",
          card: "Kaardii",
          wallet: "Waleetii",
          bank: "Baankii",
          payNowDisabled: "Amma kaffali (cufaa)",
          supportedTitle: "Kan deggaraman",
          bulletOne: "• Kaffaltii barnootaa / fee",
          bulletTwo: "• Filannoo mobile wallet / card / bank",
          bulletThree: "• Ragaa kaffaltii saffisaa",
        };
      }

      return {
        heroTitle: amharic ? "ክፍያ ፈጽም" : "Make Payment",
        heroSub: amharic ? "የትምህርት ቤት ክፍያን በደህንነት ለመክፈል በቅርቡ ይዘጋጃል።" : "Secure school fee payment, coming soon.",
        status: amharic ? "ሁኔታ" : "Status",
        gatewayPending: amharic ? "የክፍያ መስመር በዝግጅት ላይ ነው" : "Gateway setup pending",
        comingSoon: amharic ? "በቅርቡ" : "Coming Soon",
        card: amharic ? "ካርድ" : "Card",
        wallet: amharic ? "ዋሌት" : "Wallet",
        bank: amharic ? "ባንክ" : "Bank",
        payNowDisabled: amharic ? "አሁን ይክፈሉ (ዝግ)" : "Pay Now (Disabled)",
        supportedTitle: amharic ? "የሚደገፉ አገልግሎቶች" : "What will be supported",
        bulletOne: amharic ? "• የትምህርት ክፍያ / ፊ ክፍያ" : "• Tuition / Fee payment",
        bulletTwo: amharic ? "• የሞባይል ዋሌት / ካርድ / ባንክ አማራጮች" : "• Mobile wallet / Card / Bank options",
        bulletThree: amharic ? "• ፈጣን የክፍያ ማረጋገጫ ደረሰኝ" : "• Instant confirmation receipt",
      };
    },
    [amharic, oromo]
  );

  return (
    <View>
      <LinearGradient
        colors={[palette.heroGradientStart, palette.heroGradientMid, palette.heroGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <Text style={styles.heroTitle}>{labels.heroTitle}</Text>
        <Text style={styles.heroSub}>{labels.heroSub}</Text>

        <View style={styles.heroStatusCard}>
          <View>
            <Text style={styles.heroStatusLabel}>{labels.status}</Text>
            <Text style={styles.heroStatusValue}>{labels.gatewayPending}</Text>
          </View>
          <Text style={styles.heroStatusBadge}>{labels.comingSoon}</Text>
        </View>

        <View style={styles.heroFeatureRow}>
          <View style={styles.heroFeatureChip}>
            <Ionicons name="card-outline" size={13} color={palette.primary} />
            <Text style={styles.heroFeatureText}>{labels.card}</Text>
          </View>
          <View style={styles.heroFeatureChip}>
            <Ionicons name="phone-portrait-outline" size={13} color={palette.primary} />
            <Text style={styles.heroFeatureText}>{labels.wallet}</Text>
          </View>
          <View style={styles.heroFeatureChip}>
            <Ionicons name="business-outline" size={13} color={palette.primary} />
            <Text style={styles.heroFeatureText}>{labels.bank}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.heroPrimaryBtn} disabled activeOpacity={0.9}>
          <Ionicons name="lock-closed-outline" size={16} color={palette.white} style={styles.heroPrimaryBtnIcon} />
          <Text style={styles.heroPrimaryBtnText}>{labels.payNowDisabled}</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{labels.supportedTitle}</Text>
        <Text style={styles.bullet}>{labels.bulletOne}</Text>
        <Text style={styles.bullet}>{labels.bulletTwo}</Text>
        <Text style={styles.bullet}>{labels.bulletThree}</Text>
      </View>
    </View>
  );
}

const createStyles = (palette) => StyleSheet.create({
  heroCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.heroBorder,
    shadowColor: palette.heroShadow,
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
    backgroundColor: palette.heroGlowOne,
    top: -70,
    right: -30,
  },
  heroGlowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: palette.heroGlowTwo,
    bottom: -38,
    left: -18,
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: palette.text,
    letterSpacing: 0.2,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 20,
    color: palette.muted,
    marginTop: 8,
  },
  heroStatusCard: {
    marginTop: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: palette.statusCardBg,
    borderWidth: 1,
    borderColor: palette.statusCardBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heroStatusLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroStatusValue: {
    marginTop: 4,
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    maxWidth: 200,
  },
  heroStatusBadge: {
    color: palette.warningText,
    backgroundColor: palette.warningBg,
    borderWidth: 1,
    borderColor: palette.statusCardBorder,
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
    backgroundColor: palette.featureChipBg,
    borderWidth: 1,
    borderColor: palette.featureChipBorder,
  },
  heroFeatureText: {
    color: palette.text,
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
    backgroundColor: palette.primary,
    borderWidth: 1,
    borderColor: palette.buttonBorder,
    opacity: 0.72,
  },
  heroPrimaryBtnIcon: {
    marginRight: 8,
  },
  heroPrimaryBtnText: {
    color: palette.white,
    fontWeight: "800",
    fontSize: 14,
  },
  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: palette.text },
  cardSub: { fontSize: 13, color: palette.muted, marginTop: 4, marginBottom: 10 },

  bullet: { fontSize: 13, color: palette.text, marginBottom: 6 },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    alignItems: "center",
  },
  infoLabel: { fontSize: 13, color: palette.muted },
  badgePending: {
    fontSize: 12,
    color: palette.warningText,
    backgroundColor: palette.warningBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: "700",
  },

  primaryBtn: {
    marginTop: 4,
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primaryBtnText: { color: palette.white, fontWeight: "700", fontSize: 14 },
});