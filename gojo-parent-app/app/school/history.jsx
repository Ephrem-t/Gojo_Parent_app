import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get } from "firebase/database";
import { database } from "../../constants/firebaseConfig";
import { getLinkedChildrenForParent } from "../lib/parentChildren";
import { useParentTheme } from "../../hooks/use-parent-theme";

function monthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(String(monthKey))) return String(monthKey || "");
  const [year, month] = String(monthKey).split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function getMonthShort(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(String(monthKey))) return "--";
  const [year, month] = String(monthKey).split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short" });
}

function sortMonthKeysDesc(keys) {
  return [...keys].sort((a, b) => {
    const [ay, am] = String(a).split("-").map(Number);
    const [by, bm] = String(b).split("-").map(Number);
    return by - ay || bm - am;
  });
}

export default function HistoryTab() {
  const { colors, isDark } = useParentTheme();
  const palette = useMemo(
    () => ({
      background: colors.background,
      card: colors.card,
      cardMuted: colors.cardMuted,
      inputBackground: colors.inputBackground,
      text: colors.text,
      muted: colors.muted,
      border: colors.border,
      borderSoft: colors.borderSoft,
      borderStrong: colors.borderStrong,
      line: colors.lineSoft,
      primary: colors.primary,
      primaryDark: colors.primaryDark,
      primarySoft: colors.primarySoftAlt,
      success: colors.success,
      successSoft: colors.successSoft,
      warning: colors.warning,
      warningSoft: colors.warningSoft,
      heroGradientStart: colors.heroSurface,
      heroGradientMid: colors.cardMuted,
      heroGradientEnd: colors.primarySoft,
      heroBorder: isDark ? colors.borderStrong : "#E3EDF9",
      heroShadow: isDark ? "#000000" : "#9FBFE6",
      heroGlowOne: colors.heroOrbPrimary,
      heroGlowTwo: colors.heroOrbSecondary,
      iconBg: colors.primarySoftAlt,
      iconBorder: colors.infoBorder,
      successBorder: isDark ? colors.borderStrong : "#CFEFD9",
      warningBorder: isDark ? colors.borderStrong : "#FED7AA",
      softShadow: isDark ? "#000000" : "#BED3EE",
      monthBadgeShadow: isDark ? "#000000" : "#DCE8F6",
    }),
    [colors, isDark]
  );
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [children, setChildren] = useState([]);
  const [paymentRows, setPaymentRows] = useState([]);

  const schoolAwarePath = useCallback((subPath, sk) => {
    return sk ? `Platform1/Schools/${sk}/${subPath}` : subPath;
  }, []);

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);

        const [pid, sk] = await Promise.all([
          AsyncStorage.getItem("parentId"),
          AsyncStorage.getItem("schoolKey"),
        ]);

        if (!pid) {
          setChildren([]);
          setPaymentRows([]);
          return;
        }

        const prefix = sk ? `Platform1/Schools/${sk}/` : "";

        const [normalizedChildren, paymentsSnap] = await Promise.all([
          getLinkedChildrenForParent(prefix, pid),
          get(ref(database, schoolAwarePath("Payments/monthlyPaid", sk || null))),
        ]);
        const paymentsVal = paymentsSnap.exists() ? paymentsSnap.val() || {} : {};

        setChildren(normalizedChildren);

        const monthKeys = sortMonthKeysDesc(Object.keys(paymentsVal || {}));
        const rows = [];

        monthKeys.forEach((monthKey) => {
          const monthMap = paymentsVal?.[monthKey] || {};

          normalizedChildren.forEach((child) => {
            const paymentValue = monthMap?.[child.studentId];

            if (typeof paymentValue === "undefined") return;

            rows.push({
              id: `${monthKey}-${child.studentId}`,
              monthKey,
              monthLabel: monthLabel(monthKey),
              monthShort: getMonthShort(monthKey),
              studentId: child.studentId,
              studentName: child.name,
              relationship: child.relationship,
              grade: child.grade,
              section: child.section,
              paid: Boolean(paymentValue),
            });
          });
        });

        setPaymentRows(rows);
      } catch (e) {
        console.warn("Payment history load error:", e);
        setChildren([]);
        setPaymentRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [schoolAwarePath]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData({ silent: true });
  };

  const summary = useMemo(() => {
    const total = paymentRows.length;
    const paid = paymentRows.filter((r) => r.paid).length;
    const unpaid = total - paid;
    const latestMonth = paymentRows.length ? paymentRows[0]?.monthLabel : "No records";
    return { total, paid, unpaid, latestMonth };
  }, [paymentRows]);

  const groupedByStudent = useMemo(() => {
    const map = {};

    children.forEach((child) => {
      map[child.studentId] = {
        studentId: child.studentId,
        studentName: child.name,
        relationship: child.relationship,
        grade: child.grade,
        section: child.section,
        items: [],
      };
    });

    paymentRows.forEach((row) => {
      if (!map[row.studentId]) {
        map[row.studentId] = {
          studentId: row.studentId,
          studentName: row.studentName,
          relationship: row.relationship || "Child",
          grade: row.grade,
          section: row.section,
          items: [],
        };
      }
      map[row.studentId].items.push(row);
    });

    Object.values(map).forEach((group) => {
      group.items = sortMonthKeysDesc(group.items.map((i) => i.monthKey)).map((k) =>
        group.items.find((i) => i.monthKey === k)
      );
    });

    return Object.values(map);
  }, [children, paymentRows]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.loadingText}>Loading payment history...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 28 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} tintColor={palette.primary} />}
    >
      <LinearGradient
        colors={[palette.heroGradientStart, palette.heroGradientMid, palette.heroGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Payment History</Text>
            <Text style={styles.heroSub}>See each child’s payment history.</Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="receipt-outline" size={24} color={palette.primary} />
          </View>
        </View>

        <View style={styles.heroInsightsRow}>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatValue}>{children.length}</Text>
            <Text style={styles.heroStatLabel}>Children</Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatValue}>{summary.total}</Text>
            <Text style={styles.heroStatLabel}>Records</Text>
          </View>

          <View style={[styles.heroStatPill, styles.heroStatPillSuccess]}>
            <Text style={[styles.heroStatValue, styles.heroStatValueSuccess]}>{summary.paid}</Text>
            <Text style={styles.heroStatLabel}>Paid</Text>
          </View>

          <View style={[styles.heroStatPill, styles.heroStatPillWarning]}>
            <Text style={[styles.heroStatValue, styles.heroStatValueWarning]}>{summary.unpaid}</Text>
            <Text style={styles.heroStatLabel}>Pending</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.summaryWide}>
        <View style={styles.summaryWideLeft}>
          <Text style={styles.summaryWideLabel}>Latest Recorded Month</Text>
          <Text style={styles.summaryWideValue}>{summary.latestMonth}</Text>
        </View>
        <View style={styles.summaryWideRight}>
          <Ionicons name="calendar-outline" size={20} color={palette.primaryDark} />
        </View>
      </View>

      {children.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={28} color={palette.muted} />
          <Text style={styles.emptyTitle}>No linked children found</Text>
          <Text style={styles.emptyText}>
            This parent account does not currently show any linked student IDs.
          </Text>
        </View>
      ) : paymentRows.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={28} color={palette.muted} />
          <Text style={styles.emptyTitle}>No payment records found</Text>
          <Text style={styles.emptyText}>
            We found your linked children, but there are no matching payment records yet in
            `Payments/monthlyPaid`.
          </Text>
        </View>
      ) : (
        groupedByStudent.map((group) => {
          const paidCount = group.items.filter((i) => i.paid).length;
          const pendingCount = group.items.length - paidCount;

          return (
            <View key={group.studentId} style={styles.studentCard}>
              <View style={styles.studentTop}>
                <View style={styles.studentAvatar}>
                  <Ionicons name="person-outline" size={20} color={palette.primaryDark} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{group.studentName}</Text>
                  <Text style={styles.studentMeta}>
                    {group.relationship} • ID: {group.studentId}
                  </Text>
                  <Text style={styles.studentSubMeta}>
                    Grade {group.grade} • Section {group.section}
                  </Text>
                </View>
              </View>

              <View style={styles.studentStatsRow}>
                <View style={styles.studentMiniStat}>
                  <Text style={styles.studentMiniStatValue}>{paidCount}</Text>
                  <Text style={styles.studentMiniStatLabel}>Paid</Text>
                </View>
                <View style={styles.studentMiniDivider} />
                <View style={styles.studentMiniStat}>
                  <Text style={[styles.studentMiniStatValue, { color: pendingCount ? palette.warning : palette.text }]}>
                    {pendingCount}
                  </Text>
                  <Text style={styles.studentMiniStatLabel}>Pending</Text>
                </View>
              </View>

              {group.items.length > 0 ? (
                <View style={styles.timelineWrap}>
                  {group.items.map((item, index) => {
                    const statusColor = item.paid ? palette.success : palette.warning;
                    const statusBg = item.paid ? palette.successSoft : palette.warningSoft;
                    const statusBorder = item.paid ? palette.successBorder : palette.warningBorder;
                    const statusText = item.paid ? "Paid" : "Pending";
                    const iconName = item.paid ? "checkmark-circle" : "time";

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.historyRow,
                          index === group.items.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 },
                        ]}
                      >
                        <View style={styles.monthBadge}>
                          <Text style={styles.monthBadgeText}>{item.monthShort}</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyMonth}>{item.monthLabel}</Text>
                          <Text style={styles.historySub}>Student ID: {item.studentId}</Text>
                        </View>

                        <View style={[styles.statusPill, { backgroundColor: statusBg, borderColor: statusBorder }]}> 
                          <Ionicons name={iconName} size={14} color={statusColor} />
                          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.childNoHistory}>
                  <Ionicons name="document-text-outline" size={18} color={palette.muted} />
                  <Text style={styles.childNoHistoryText}>No payment history found for this child yet.</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const createStyles = (palette) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.background,
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: palette.muted,
    fontWeight: "600",
  },

  heroCard: {
    borderWidth: 1,
    borderColor: palette.heroBorder,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
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
    top: -72,
    right: -28,
  },
  heroGlowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: palette.heroGlowTwo,
    bottom: -36,
    left: -18,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  heroCopy: {
    flex: 1,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: palette.iconBg,
    borderWidth: 1,
    borderColor: palette.iconBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: palette.text,
    letterSpacing: 0.2,
  },
  heroSub: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: palette.muted,
    fontWeight: "500",
  },
  heroInsightsRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
  },
  heroStatPill: {
    flex: 1,
    minWidth: 0,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  heroStatValue: {
    fontSize: 15,
    fontWeight: "900",
    color: palette.text,
  },
  heroStatLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: palette.muted,
  },
  heroStatPillSuccess: {
    backgroundColor: palette.successSoft,
    borderColor: palette.successBorder,
  },
  heroStatPillWarning: {
    backgroundColor: palette.warningSoft,
    borderColor: palette.warningBorder,
  },
  heroStatValueSuccess: {
    color: palette.success,
  },
  heroStatValueWarning: {
    color: palette.warning,
  },

  summaryWide: {
    backgroundColor: palette.cardMuted,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    padding: 15,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: palette.softShadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
  },
  summaryWideLeft: { flex: 1 },
  summaryWideLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.muted,
  },
  summaryWideValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "800",
    color: palette.text,
  },
  summaryWideRight: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: palette.iconBorder,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  emptyCard: {
    backgroundColor: palette.cardMuted,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.softShadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "800",
    color: palette.text,
    textAlign: "center",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: palette.muted,
    lineHeight: 18,
    textAlign: "center",
  },

  studentCard: {
    backgroundColor: palette.cardMuted,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 22,
    padding: 15,
    marginBottom: 14,
    shadowColor: palette.softShadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  studentTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  studentAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: palette.iconBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.text,
  },
  studentMeta: {
    marginTop: 3,
    fontSize: 12.5,
    color: palette.muted,
    fontWeight: "600",
  },
  studentSubMeta: {
    marginTop: 2,
    fontSize: 12,
    color: palette.muted,
    fontWeight: "600",
  },

  studentStatsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.inputBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 12,
  },
  studentMiniStat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  studentMiniDivider: {
    width: 1,
    height: 24,
    backgroundColor: palette.borderSoft,
  },
  studentMiniStatValue: {
    fontSize: 18,
    fontWeight: "900",
    color: palette.text,
  },
  studentMiniStatLabel: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: "700",
    color: palette.muted,
  },

  timelineWrap: {
    marginTop: 14,
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  monthBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: palette.monthBadgeShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  monthBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: palette.primaryDark,
  },
  historyMonth: {
    fontSize: 14,
    fontWeight: "800",
    color: palette.text,
  },
  historySub: {
    marginTop: 3,
    fontSize: 12,
    color: palette.muted,
    fontWeight: "600",
  },
  statusPill: {
    marginLeft: 12,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  statusText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "800",
  },

  childNoHistory: {
    marginTop: 14,
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  childNoHistoryText: {
    marginLeft: 8,
    color: palette.muted,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
});