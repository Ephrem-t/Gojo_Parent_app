  import React, { useEffect, useMemo, useRef, useState } from "react";
  import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import PaymentsTab from "../school/payments";
import HistoryTab from "../school/history";
import CalendarTab from "../school/calendar";
import { useParentTheme } from "../../hooks/use-parent-theme";

const TABS = ["Payments", "History", "Calendar"];

export default function SchoolScreen() {
  const { colors, isDark } = useParentTheme();
  const palette = useMemo(
    () => ({
      background: colors.background,
      tabsBg: isDark ? colors.cardMuted : "#E8EEF9",
      tabText: colors.mutedAlt,
      tabTextActive: colors.text,
      indicatorBg: colors.primarySoft,
      indicatorBorder: isDark ? colors.borderStrong : "#BFDBFE",
    }),
    [colors, isDark]
  );
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [activeTab, setActiveTab] = useState("Payments");
  const tabAnim = useRef(new Animated.Value(0)).current;
  const [tabWidth, setTabWidth] = useState(0);

  useEffect(() => {
    const target = TABS.indexOf(activeTab);
    Animated.spring(tabAnim, {
      toValue: target,
      useNativeDriver: true,
      stiffness: 140,
      damping: 18,
      mass: 0.6,
    }).start();
  }, [activeTab, tabAnim]);

  const renderTab = () => {
    if (activeTab === "Payments") return <PaymentsTab />;
    if (activeTab === "History") return <HistoryTab />;
    return <CalendarTab />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.stickyWrap}>
        <View style={styles.tabRow} onLayout={(e) => setTabWidth(e.nativeEvent.layout.width)}>
          {tabWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.tabIndicator,
                {
                  width: tabWidth / TABS.length,
                  transform: [
                    {
                      translateX: Animated.multiply(tabAnim, tabWidth / TABS.length),
                    },
                  ],
                },
              ]}
            />
          )}

          {TABS.map((t) => {
            const active = activeTab === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setActiveTab(t)}
                style={styles.tabBtn}
                activeOpacity={0.86}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[
        styles.body,
        activeTab === "Calendar" ? styles.bodyCalendar : styles.bodyPadded,
      ]}>
        {renderTab()}
      </View>
    </View>
  );
}

const createStyles = (palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },

  stickyWrap: {
    backgroundColor: palette.background,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    zIndex: 5,
  },
  body: {
    flex: 1,
  },
  bodyPadded: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 24,
  },
  bodyCalendar: {
    paddingTop: 0,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.tabsBg,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabText: {
    color: palette.tabText,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  tabTextActive: { color: palette.tabTextActive },
  tabIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    backgroundColor: palette.indicatorBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.indicatorBorder,
  },
});