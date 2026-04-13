import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useParentTheme } from "../../hooks/use-parent-theme";

function makePalette(colors, isDark) {
  return {
    gradientTop: isDark ? "#0D1B2E" : "#EEF5FF",
    gradientMid: isDark ? "#123053" : "#DCEAFE",
    gradientBottom: isDark ? "#1D5EA8" : "#9BC7FF",
    orbPrimary: isDark ? "rgba(86,176,255,0.22)" : "rgba(34,150,243,0.24)",
    orbSecondary: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
    badgeBg: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.72)",
    badgeBorder: isDark ? "rgba(255,255,255,0.12)" : "rgba(34,150,243,0.12)",
    badgeText: isDark ? colors.white : colors.textStrong,
    badgeIcon: colors.primary,
    title: colors.white,
    subtitle: isDark ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.92)",
    panelBg: isDark ? "rgba(10,22,39,0.56)" : "rgba(15,23,42,0.22)",
    panelBorder: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.2)",
    iconBg: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.16)",
    iconColor: colors.white,
    markPlateBg: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)",
    markPlateBorder: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.42)",
    markCardBg: isDark ? "rgba(7,17,31,0.34)" : "rgba(255,255,255,0.76)",
    markCardBorder: isDark ? "rgba(255,255,255,0.12)" : "rgba(34,150,243,0.16)",
    lineSoft: isDark ? "rgba(255,255,255,0.16)" : "rgba(34,150,243,0.16)",
    outline: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.46)",
  };
}

function getLabels(oromo, amharic) {
  if (oromo) {
    return {
      badge: "Beeksisa mana barumsaa",
      title: "Postii Mana Barumsaa",
      subtitle: "Bifa qulqulluu fi ammayyaa qabuun mul'ata postii durtii.",
    };
  }

  if (amharic) {
    return {
      badge: "የትምህርት ቤት ዝመና",
      title: "የትምህርት ቤት ፖስት",
      subtitle: "ለፖስቶች የተሻለ የነባሪ ሽፋን እይታ።",
    };
  }

  return {
    badge: "School update",
    title: "School Post",
    subtitle: "A polished default cover for posts and announcements.",
  };
}

export default function DefaultPostImage({ style }) {
  const { colors, isDark, amharic, oromo } = useParentTheme();
  const palette = useMemo(() => makePalette(colors, isDark), [colors, isDark]);
  const labels = useMemo(() => getLabels(oromo, amharic), [amharic, oromo]);

  return (
    <View style={[styles.shell, style]}>
      <LinearGradient
        colors={[palette.gradientTop, palette.gradientMid, palette.gradientBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.orb, styles.orbPrimary, { backgroundColor: palette.orbPrimary }]} />
      <View style={[styles.orb, styles.orbSecondary, { backgroundColor: palette.orbSecondary }]} />
      <View style={[styles.outlineRing, { borderColor: palette.outline }]} />

      <View style={[styles.badge, { backgroundColor: palette.badgeBg, borderColor: palette.badgeBorder }]}>
        <Ionicons name="sparkles-outline" size={13} color={palette.badgeIcon} />
        <Text style={[styles.badgeText, { color: palette.badgeText }]} numberOfLines={1}>
          {labels.badge}
        </Text>
      </View>

      <View style={styles.centerWrap}>
        <View style={[styles.markPlate, { backgroundColor: palette.markPlateBg, borderColor: palette.markPlateBorder }]}>
          <View style={[styles.markCardBack, { backgroundColor: palette.markCardBg, borderColor: palette.markCardBorder }]} />
          <View style={[styles.markCardFront, { backgroundColor: palette.markCardBg, borderColor: palette.markCardBorder }]}>
            <View style={[styles.markIconCircle, { backgroundColor: palette.iconBg }]}>
              <Ionicons name="image-outline" size={20} color={palette.badgeIcon} />
            </View>
            <View style={[styles.markLine, styles.markLineWide, { backgroundColor: palette.lineSoft }]} />
            <View style={[styles.markLine, styles.markLineMid, { backgroundColor: palette.lineSoft }]} />
            <View style={[styles.markLine, styles.markLineShort, { backgroundColor: palette.lineSoft }]} />
          </View>
        </View>
      </View>

      <View style={[styles.footerPanel, { backgroundColor: palette.panelBg, borderColor: palette.panelBorder }]}>
        <View style={styles.copyWrap}>
          <Text style={[styles.title, { color: palette.title }]} numberOfLines={1}>
            {labels.title}
          </Text>
          <Text style={[styles.subtitle, { color: palette.subtitle }]} numberOfLines={2}>
            {labels.subtitle}
          </Text>
        </View>

        <View style={[styles.iconWrap, { backgroundColor: palette.iconBg }]}>
          <Ionicons name="image-outline" size={18} color={palette.iconColor} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    minHeight: 180,
    justifyContent: "space-between",
    padding: 16,
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
  },
  orbPrimary: {
    width: 180,
    height: 180,
    top: -42,
    right: -36,
  },
  orbSecondary: {
    width: 140,
    height: 140,
    bottom: -44,
    left: -18,
  },
  outlineRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    borderWidth: 1,
    bottom: -120,
    right: -70,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  centerWrap: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  markPlate: {
    width: 112,
    height: 112,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  markCardBack: {
    position: "absolute",
    width: 58,
    height: 74,
    borderRadius: 18,
    borderWidth: 1,
    transform: [{ rotate: "-10deg" }, { translateX: -16 }, { translateY: -8 }],
  },
  markCardFront: {
    width: 64,
    height: 80,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 10,
  },
  markIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  markLine: {
    width: "100%",
    borderRadius: 999,
    marginTop: 7,
  },
  markLineWide: {
    height: 7,
  },
  markLineMid: {
    width: "78%",
    height: 6,
  },
  markLineShort: {
    width: "54%",
    height: 6,
  },
  footerPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  copyWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});