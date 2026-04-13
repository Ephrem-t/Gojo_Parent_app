import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get } from "firebase/database";
import { database } from "../../constants/firebaseConfig";
import { PaymentHistoryScreenSkeleton } from "../../components/ui/AppSkeletons";
import { readCachedJsonRecord, writeCachedJson } from "../lib/dataCache";
import { getLinkedChildrenForParent } from "../lib/parentChildren";
import { isInternetReachableNow } from "../lib/networkGuard";
import { useParentTheme } from "../../hooks/use-parent-theme";

const PAYMENT_HISTORY_CACHE_TTL_MS = 30 * 60 * 1000;

const ETH_MONTHS_EN = [
  "Meskerem",
  "Tikimt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yekatit",
  "Megabit",
  "Miazia",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehase",
];

const ETH_MONTHS_AM = [
  "መስከረም",
  "ጥቅምት",
  "ህዳር",
  "ታህሳስ",
  "ጥር",
  "የካቲት",
  "መጋቢት",
  "ሚያዝያ",
  "ግንቦት",
  "ሰኔ",
  "ሐምሌ",
  "ነሐሴ",
];

const ETH_MONTHS_OM = [
  "Fulbaana",
  "Onkololeessa",
  "Sadaasa",
  "Muddee",
  "Amajjii",
  "Guraandhala",
  "Bitootessa",
  "Ebla",
  "Caamsaa",
  "Waxabajjii",
  "Adooleessa",
  "Hagayya",
];

const ETH_MONTHS_SHORT_EN = ["Mes", "Tik", "Hid", "Tah", "Tir", "Yek", "Meg", "Mia", "Gin", "Sen", "Ham", "Neh"];
const ETH_MONTHS_SHORT_AM = ["መስ", "ጥቅ", "ህዳ", "ታህ", "ጥር", "የካ", "መጋ", "ሚያ", "ግን", "ሰኔ", "ሐም", "ነሐ"];
const ETH_MONTHS_SHORT_OM = ["Ful", "Onk", "Sad", "Mud", "Ama", "Gur", "Bit", "Ebl", "Caa", "Wax", "Ado", "Hag"];

function getPaymentHistoryCacheKey(schoolKey, parentId) {
  return `cache:paymentHistory:v4:${String(schoolKey || "root")}:${String(parentId || "unknown")}`;
}

function monthLabel(monthKey, amharic = false, oromo = false) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(String(monthKey))) return String(monthKey || "");
  const [year, month] = String(monthKey).split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  const locale = amharic ? "am-ET" : oromo ? "om-ET" : undefined;
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function getMonthShort(monthKey, amharic = false, oromo = false) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(String(monthKey))) return "--";
  const [year, month] = String(monthKey).split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  const locale = amharic ? "am-ET" : oromo ? "om-ET" : undefined;
  return d.toLocaleDateString(locale, { month: "short" });
}

function sortMonthKeysDesc(keys) {
  return [...keys].sort((a, b) => {
    const [ay, am] = String(a).split("-").map(Number);
    const [by, bm] = String(b).split("-").map(Number);
    return by - ay || bm - am;
  });
}

function getEthMonthName(month, amharic = false, oromo = false) {
  const monthNames = oromo ? ETH_MONTHS_OM : amharic ? ETH_MONTHS_AM : ETH_MONTHS_EN;
  return monthNames[month - 1] || "";
}

function getEthMonthShortName(month, amharic = false, oromo = false) {
  const monthNames = oromo ? ETH_MONTHS_SHORT_OM : amharic ? ETH_MONTHS_SHORT_AM : ETH_MONTHS_SHORT_EN;
  return monthNames[month - 1] || "";
}

function toMonthKeyFromParts(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getSchoolYearStartYear(anchorMonthKey) {
  const [year, month] = String(anchorMonthKey || "").split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const today = new Date();
    return today.getMonth() + 1 >= 9 ? today.getFullYear() : today.getFullYear() - 1;
  }

  return month >= 9 ? year : year - 1;
}

function buildEthiopianSchoolYearMonths(anchorMonthKey) {
  const startYear = getSchoolYearStartYear(anchorMonthKey);
  return [
    { monthKey: toMonthKeyFromParts(startYear, 9), ethiopianMonth: 1 },
    { monthKey: toMonthKeyFromParts(startYear, 10), ethiopianMonth: 2 },
    { monthKey: toMonthKeyFromParts(startYear, 11), ethiopianMonth: 3 },
    { monthKey: toMonthKeyFromParts(startYear, 12), ethiopianMonth: 4 },
    { monthKey: toMonthKeyFromParts(startYear + 1, 1), ethiopianMonth: 5 },
    { monthKey: toMonthKeyFromParts(startYear + 1, 2), ethiopianMonth: 6 },
    { monthKey: toMonthKeyFromParts(startYear + 1, 3), ethiopianMonth: 7 },
    { monthKey: toMonthKeyFromParts(startYear + 1, 4), ethiopianMonth: 8 },
    { monthKey: toMonthKeyFromParts(startYear + 1, 5), ethiopianMonth: 9 },
    { monthKey: toMonthKeyFromParts(startYear + 1, 6), ethiopianMonth: 10 },
    { monthKey: toMonthKeyFromParts(startYear + 1, 7), ethiopianMonth: 11 },
    { monthKey: toMonthKeyFromParts(startYear + 1, 8), ethiopianMonth: 12 },
  ];
}

export default function HistoryTab() {
  const { colors, isDark, amharic, oromo } = useParentTheme();
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
      onPrimary: isDark ? colors.black : colors.white,
      success: colors.success,
      successSoft: colors.successSoft,
      danger: colors.danger,
      dangerSoft: colors.dangerSoft,
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
  const labels = useMemo(
    () => {
      if (oromo) {
        return {
          fallbackChild: "Ijoollee",
          loading: "Seenaa kaffaltii fe'aa jira...",
          heroTitle: "Seenaa kaffaltii",
          heroSub: "Seenaa kaffaltii ijoollee tokkoon tokkoon isaanii ilaali.",
          children: "Ijoollee",
          chooseChild: "Ijoollee filadhu",
          records: "Galmeewwan",
          unpaid: "Hin kaffalamne",
          paid: "Kaffalame",
          pending: "Eegamaa jira",
          latestRecordedMonth: "Ji'a dhumaa galmeeffame",
          noRecords: "Galmeen hin jiru",
          noLinkedChildrenTitle: "Ijoolleen walqabatan hin argamne",
          noLinkedChildrenText: "Akkaawuntiin maatii kun ammaaf ID barataa walqabate hin agarsiisu.",
          noPaymentTitle: "Galmeen kaffaltii hin argamne",
          noPaymentText: "Ijoollee walqabatan argineerra, garuu galmeen kaffaltii hin jiru.",
          id: "ID",
          grade: "Kutaa",
          section: "Kutaa xiqqaa",
          studentId: "ID barataa",
          noChildHistory: "Seenaa kaffaltii ijoollee kanaaf hin argamne.",
        };
      }

      return {
        fallbackChild: amharic ? "ልጅ" : "Child",
        loading: amharic ? "የክፍያ ታሪክ በመጫን ላይ..." : "Loading payment history...",
        heroTitle: amharic ? "የክፍያ ታሪክ" : "Payment History",
        heroSub: amharic ? "የእያንዳንዱን ልጅ የክፍያ ታሪክ ይመልከቱ።" : "See each child’s payment history.",
        children: amharic ? "ልጆች" : "Children",
        chooseChild: amharic ? "ልጅ ይምረጡ" : "Choose Child",
        records: amharic ? "መዝገቦች" : "Records",
        unpaid: amharic ? "ያልተከፈለ" : "Unpaid",
        paid: amharic ? "የተከፈለ" : "Paid",
        pending: amharic ? "በመጠባበቅ ላይ" : "Pending",
        latestRecordedMonth: amharic ? "የቅርብ ጊዜ የተመዘገበ ወር" : "Latest Recorded Month",
        noRecords: amharic ? "ምንም መዝገብ የለም" : "No records",
        noLinkedChildrenTitle: amharic ? "የተገናኙ ልጆች አልተገኙም" : "No linked children found",
        noLinkedChildrenText: amharic ? "ይህ የወላጅ መለያ በአሁኑ ጊዜ የተገናኘ የተማሪ መለያ አያሳይም።" : "This parent account does not currently show any linked student IDs.",
        noPaymentTitle: amharic ? "የክፍያ መዝገቦች አልተገኙም" : "No payment records found",
        noPaymentText: amharic ? "የተገናኙ ልጆችን አግኝተናል፣ ግን እስካሁን ተመሳሳይ የክፍያ መዝገቦች የሉም።" : "We found your linked children, but there are no matching payment records yet in Payments/monthlyPaid.",
        id: amharic ? "መለያ" : "ID",
        grade: amharic ? "ክፍል" : "Grade",
        section: amharic ? "ሴክሽን" : "Section",
        studentId: amharic ? "የተማሪ መለያ" : "Student ID",
        noChildHistory: amharic ? "ለዚህ ልጅ እስካሁን የክፍያ ታሪክ አልተገኘም።" : "No payment history found for this child yet.",
      };
    },
    [amharic, oromo]
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [children, setChildren] = useState([]);
  const [paymentRows, setPaymentRows] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);

  const applyCachedHistory = useCallback((cachedHistory) => {
    if (!cachedHistory || typeof cachedHistory !== "object") return false;

    setChildren(Array.isArray(cachedHistory.children) ? cachedHistory.children : []);
    setPaymentRows(Array.isArray(cachedHistory.paymentRows) ? cachedHistory.paymentRows : []);
    return true;
  }, []);

  const schoolAwarePath = useCallback((subPath, sk) => {
    return sk ? `Platform1/Schools/${sk}/${subPath}` : subPath;
  }, []);

  const loadData = useCallback(
    async ({ silent = false, forceNetwork = false } = {}) => {
      try {
        if (!silent) setLoading(true);

        const [pid, sk] = await Promise.all([
          AsyncStorage.getItem("parentId"),
          AsyncStorage.getItem("schoolKey"),
        ]);

        const cacheKey = getPaymentHistoryCacheKey(sk, pid);
        const cachedHistoryRecord = await readCachedJsonRecord(cacheKey);
        const cachedHistory = cachedHistoryRecord?.value || null;
        const cacheFresh = cachedHistoryRecord
          ? Date.now() - cachedHistoryRecord.savedAt <= PAYMENT_HISTORY_CACHE_TTL_MS
          : false;

        const hasCachedHistory = applyCachedHistory(cachedHistory);
        if (hasCachedHistory) {
          setLoading(false);
          if (!forceNetwork && cacheFresh) {
            return;
          }
        }

        if (!pid) {
          setChildren([]);
          setPaymentRows([]);
          return;
        }

        const onlineNow = await isInternetReachableNow();
        if (!onlineNow) {
          if (!hasCachedHistory) {
            setChildren([]);
            setPaymentRows([]);
          }
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

            rows.push({
              id: `${monthKey}-${child.studentId}`,
              monthKey,
              monthLabel: monthLabel(monthKey, amharic, oromo),
              monthShort: getMonthShort(monthKey, amharic, oromo),
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
        writeCachedJson(cacheKey, {
          children: normalizedChildren,
          paymentRows: rows,
          fetchedAt: Date.now(),
        }).catch(() => {});
      } catch (e) {
        console.warn("Payment history load error:", e);
        setChildren([]);
        setPaymentRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyCachedHistory, schoolAwarePath, amharic, oromo]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData({ silent: true, forceNetwork: true });
  };

  const effectiveSelectedChildId = useMemo(() => {
    if (!children.length) return null;
    return children.some((child) => child.studentId === selectedChildId)
      ? selectedChildId
      : children[0].studentId;
  }, [children, selectedChildId]);

  const selectedPaymentRows = useMemo(() => {
    if (!effectiveSelectedChildId) return [];
    return paymentRows.filter((row) => row.studentId === effectiveSelectedChildId);
  }, [effectiveSelectedChildId, paymentRows]);

  const monthCards = useMemo(() => {
    const latestRecordedMonthKey = selectedPaymentRows.length
      ? sortMonthKeysDesc(selectedPaymentRows.map((row) => row.monthKey))[0]
      : paymentRows.length
        ? sortMonthKeysDesc(paymentRows.map((row) => row.monthKey))[0]
      : toMonthKeyFromParts(new Date().getFullYear(), new Date().getMonth() + 1);

    return buildEthiopianSchoolYearMonths(latestRecordedMonthKey).map(({ monthKey, ethiopianMonth }) => {
      const monthRows = selectedPaymentRows.filter((row) => row.monthKey === monthKey);
      const paid = !!effectiveSelectedChildId
        && monthRows.length > 0
        && monthRows.every((row) => row.paid);

      return {
        monthKey,
        monthLabel: getEthMonthName(ethiopianMonth, amharic, oromo),
        monthShort: getEthMonthShortName(ethiopianMonth, amharic, oromo),
        paid,
      };
    });
  }, [amharic, effectiveSelectedChildId, oromo, paymentRows, selectedPaymentRows]);

  const summary = useMemo(() => {
    const total = monthCards.length;
    const paid = monthCards.filter((card) => card.paid).length;
    const unpaidMonths = monthCards.filter((card) => !card.paid).length;
    const unpaid = unpaidMonths;
    const latestMonthKey = selectedPaymentRows.length ? sortMonthKeysDesc(selectedPaymentRows.map((r) => r.monthKey))[0] : null;
    const latestMonth = latestMonthKey ? monthLabel(latestMonthKey, amharic, oromo) : labels.noRecords;
    return { total, paid, unpaid, unpaidMonths, latestMonth };
  }, [amharic, labels.noRecords, monthCards, oromo, selectedPaymentRows]);

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
          relationship: row.relationship || labels.fallbackChild,
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
  }, [children, labels.fallbackChild, paymentRows]);

  const visibleGroups = useMemo(() => {
    return groupedByStudent.filter((group) => {
      return group.items.length > 0 && (!effectiveSelectedChildId || group.studentId === effectiveSelectedChildId);
    });
  }, [effectiveSelectedChildId, groupedByStudent]);

  if (loading) {
    return <PaymentHistoryScreenSkeleton />;
  }

  return (
    <View style={styles.screen}>
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
            <Text style={styles.heroTitle}>{labels.heroTitle}</Text>
            <Text style={styles.heroSub}>{labels.heroSub}</Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="receipt-outline" size={24} color={palette.primary} />
          </View>
        </View>

        <View style={styles.heroInsightsRow}>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatValue}>{summary.unpaidMonths}</Text>
            <Text style={styles.heroStatLabel}>{labels.unpaid}</Text>
          </View>

          <View style={[styles.heroStatPill, styles.heroStatPillSuccess]}>
            <Text style={[styles.heroStatValue, styles.heroStatValueSuccess]}>{summary.paid}</Text>
            <Text style={styles.heroStatLabel}>{labels.paid}</Text>
          </View>

          <View style={[styles.heroStatPill, styles.heroStatPillWarning]}>
            <Text style={[styles.heroStatValue, styles.heroStatValueWarning]}>{summary.unpaid}</Text>
            <Text style={styles.heroStatLabel}>{labels.pending}</Text>
          </View>
        </View>

        {children.length > 1 ? (
          <View style={styles.childSelectorWrap}>
            <Text style={styles.childSelectorLabel}>{labels.chooseChild}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.childSelectorRow}
            >
              {children.map((child, index) => {
                const active = effectiveSelectedChildId === child.studentId;
                return (
                  <TouchableOpacity
                    key={child.studentId}
                    style={[styles.childChip, active && styles.childChipActive]}
                    onPress={() => setSelectedChildId(child.studentId)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.childChipText, active && styles.childChipTextActive]}>
                      {child.name || `${labels.fallbackChild} ${index + 1}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </LinearGradient>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentScrollInner}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} tintColor={palette.primary} />}
      >
        {children.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={28} color={palette.muted} />
            <Text style={styles.emptyTitle}>{labels.noLinkedChildrenTitle}</Text>
            <Text style={styles.emptyText}>{labels.noLinkedChildrenText}</Text>
          </View>
        ) : (
          <>
          <View style={styles.monthCardsWrap}>
            {monthCards.map((item) => (
              <LinearGradient
                key={item.monthKey}
                colors={item.paid ? [palette.successSoft, palette.card] : [palette.dangerSoft, palette.card]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.monthCard, item.paid ? styles.monthCardPaid : styles.monthCardUnpaid]}
              >
                <View style={[styles.monthCardGlow, item.paid ? styles.monthCardGlowPaid : styles.monthCardGlowUnpaid]} />

                <Text style={styles.monthCardTitle}>{item.monthLabel}</Text>
                <Text style={styles.monthCardMeta}>{item.monthKey}</Text>

                <View style={styles.monthCardFooter}>
                  <View style={[styles.monthCardFooterBar, item.paid ? styles.monthCardFooterBarPaid : styles.monthCardFooterBarUnpaid]} />
                  <Text style={[styles.monthCardStatusText, item.paid ? styles.monthCardStatusPaid : styles.monthCardStatusUnpaid]}>
                    {item.paid ? labels.paid : labels.unpaid}
                  </Text>
                </View>
              </LinearGradient>
            ))}
          </View>

            {visibleGroups.map((group) => {
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
                        {group.relationship} • {labels.id}: {group.studentId}
                      </Text>
                      <Text style={styles.studentSubMeta}>
                        {labels.grade} {group.grade} • {labels.section} {group.section}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.studentStatsRow}>
                    <View style={styles.studentMiniStat}>
                      <Text style={styles.studentMiniStatValue}>{paidCount}</Text>
                      <Text style={styles.studentMiniStatLabel}>{labels.paid}</Text>
                    </View>
                    <View style={styles.studentMiniDivider} />
                    <View style={styles.studentMiniStat}>
                      <Text style={[styles.studentMiniStatValue, { color: pendingCount ? palette.warning : palette.text }]}> 
                        {pendingCount}
                      </Text>
                      <Text style={styles.studentMiniStatLabel}>{labels.pending}</Text>
                    </View>
                  </View>

                  <View style={styles.timelineWrap}>
                    {group.items.map((item, index) => {
                      const statusColor = item.paid ? palette.success : palette.warning;
                      const statusBg = item.paid ? palette.successSoft : palette.warningSoft;
                      const statusBorder = item.paid ? palette.successBorder : palette.warningBorder;
                      const statusText = item.paid ? labels.paid : labels.pending;
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
                            <Text style={styles.historySub}>{labels.studentId}: {item.studentId}</Text>
                          </View>

                          <View style={[styles.statusPill, { backgroundColor: statusBg, borderColor: statusBorder }]}> 
                            <Ionicons name={iconName} size={14} color={statusColor} />
                            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (palette) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollInner: {
    paddingBottom: 28,
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

  childSelectorWrap: {
    marginTop: 14,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 12,
  },
  childSelectorLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.muted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  childSelectorRow: {
    marginTop: 10,
    paddingRight: 4,
    gap: 8,
  },
  childChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: palette.iconBorder,
  },
  childChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primaryDark,
  },
  childChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.primaryDark,
  },
  childChipTextActive: {
    color: palette.onPrimary,
  },

  monthCardsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  monthCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 148,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: palette.softShadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
    overflow: "hidden",
  },
  monthCardPaid: {
    borderColor: palette.success,
  },
  monthCardUnpaid: {
    borderColor: palette.danger,
  },
  monthCardGlow: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 999,
    top: -30,
    right: -18,
    opacity: 0.85,
  },
  monthCardGlowPaid: {
    backgroundColor: palette.successSoft,
  },
  monthCardGlowUnpaid: {
    backgroundColor: palette.dangerSoft,
  },
  monthCardTitle: {
    marginTop: 0,
    fontSize: 17,
    fontWeight: "900",
    color: palette.text,
    lineHeight: 22,
  },
  monthCardMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: palette.muted,
  },
  monthCardFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
    flexDirection: "row",
    alignItems: "center",
  },
  monthCardFooterBar: {
    width: 24,
    height: 4,
    borderRadius: 999,
    marginRight: 8,
  },
  monthCardFooterBarPaid: {
    backgroundColor: palette.success,
  },
  monthCardFooterBarUnpaid: {
    backgroundColor: palette.danger,
  },
  monthCardStatusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  monthCardStatusPaid: {
    color: palette.success,
  },
  monthCardStatusUnpaid: {
    color: palette.danger,
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