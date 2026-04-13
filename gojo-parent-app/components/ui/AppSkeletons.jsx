import React, { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useParentTheme } from "../../hooks/use-parent-theme";

const SkeletonContext = createContext(null);

function withAlpha(color, alpha) {
  const fallback = `rgba(255,255,255,${alpha})`;
  if (!color || typeof color !== "string") return fallback;

  if (color.startsWith("rgba(")) {
    const parts = color
      .slice(5, -1)
      .split(",")
      .map((part) => part.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
    return fallback;
  }

  if (color.startsWith("rgb(")) {
    const parts = color
      .slice(4, -1)
      .split(",")
      .map((part) => part.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
    return fallback;
  }

  if (!color.startsWith("#")) {
    return fallback;
  }

  let hex = color.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((value) => value + value)
      .join("");
  }
  if (hex.length === 8) {
    hex = hex.slice(0, 6);
  }
  if (hex.length !== 6) {
    return fallback;
  }

  const numeric = Number.parseInt(hex, 16);
  if (Number.isNaN(numeric)) {
    return fallback;
  }

  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildSkeletonPalette(colors, isDark) {
  return {
    background: colors.background,
    surface: colors.card,
    surfaceMuted: isDark ? colors.cardMuted : colors.backgroundAlt,
    border: isDark ? colors.borderStrong : colors.border,
    block: isDark ? colors.surfaceMuted : "#E7EEF7",
    blockSoft: isDark ? colors.cardMuted : "#EFF4FB",
    shimmerEdge: withAlpha(colors.white, 0),
    shimmerCenter: isDark ? withAlpha(colors.white, 0.16) : withAlpha(colors.white, 0.82),
    shadow: isDark ? "#000000" : "#C7D5E6",
  };
}

function SkeletonProvider({ children }) {
  const { colors, isDark } = useParentTheme();
  const { width } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1450,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();

    return () => {
      animation.stop();
    };
  }, [progress]);

  const value = useMemo(
    () => ({
      palette: buildSkeletonPalette(colors, isDark),
      progress,
      travel: Math.max(width, 360) + 260,
    }),
    [colors, isDark, progress, width]
  );

  return <SkeletonContext.Provider value={value}>{children}</SkeletonContext.Provider>;
}

function useSkeleton() {
  const context = useContext(SkeletonContext);
  if (!context) {
    throw new Error("Skeleton components must be rendered inside SkeletonProvider.");
  }
  return context;
}

function SkeletonViewport({ children, contentContainerStyle, scroll = true, safeArea = false, edges = ["left", "right"] }) {
  const { palette } = useSkeleton();

  if (safeArea) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={edges}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={contentContainerStyle}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={contentContainerStyle}>{children}</View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentContainerStyle}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={contentContainerStyle}>{children}</View>
      )}
    </View>
  );
}

function SkeletonCard({ children, style }) {
  const { palette } = useSkeleton();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          shadowColor: palette.shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function SkeletonBlock({ style, radius = 16 }) {
  const { palette, progress, travel } = useSkeleton();
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-travel, travel],
  });

  return (
    <View style={[styles.block, { backgroundColor: palette.block, borderRadius: radius }, style]}>
      <Animated.View pointerEvents="none" style={[styles.shimmerWrap, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={[palette.shimmerEdge, palette.shimmerCenter, palette.shimmerEdge]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shimmerBand}
        />
      </Animated.View>
    </View>
  );
}

function SkeletonCircle({ size, style }) {
  return <SkeletonBlock style={[{ width: size, height: size, borderRadius: size / 2 }, style]} radius={size / 2} />;
}

function SkeletonLine({ width = "60%", height = 12, style }) {
  return <SkeletonBlock style={[{ width, height, borderRadius: 999 }, style]} radius={999} />;
}

function FeedCardSkeleton() {
  return (
    <SkeletonCard style={styles.feedCard}>
      <View style={styles.feedHeaderRow}>
        <SkeletonCircle size={44} />
        <View style={styles.flexOne}>
          <SkeletonLine width="46%" height={14} />
          <SkeletonLine width="28%" height={10} style={styles.mt8} />
        </View>
        <SkeletonCircle size={30} />
      </View>

      <SkeletonLine width="92%" height={12} style={styles.mt18} />
      <SkeletonLine width="74%" height={12} style={styles.mt10} />
      <SkeletonBlock style={styles.feedImage} radius={24} />

      <View style={styles.feedFooterRow}>
        <SkeletonLine width={72} height={12} />
        <SkeletonLine width={64} height={12} />
        <SkeletonLine width={84} height={12} />
      </View>
    </SkeletonCard>
  );
}

function TopActionRow({ count = 2 }) {
  return (
    <View style={styles.topActionRow}>
      <SkeletonCircle size={38} />
      <View style={styles.topActionGroup}>
        {Array.from({ length: count }).map((_, index) => (
          <SkeletonCircle key={index} size={36} />
        ))}
      </View>
    </View>
  );
}

function ProfileHeroSkeleton() {
  return (
    <SkeletonCard style={styles.profileHeroCard}>
      <SkeletonBlock style={styles.profileHeroBanner} radius={28} />

      <View style={styles.profileAvatarSlot}>
        <SkeletonCircle size={106} />
      </View>

      <View style={styles.profileHeroContent}>
        <SkeletonLine width="58%" height={24} />
        <SkeletonLine width="32%" height={12} style={styles.mt10} />

        <View style={styles.profilePillRow}>
          <SkeletonLine width={96} height={12} />
          <SkeletonLine width={124} height={12} />
        </View>

        <View style={styles.profileStatsRow}>
          {Array.from({ length: 3 }).map((_, index) => (
            <View key={index} style={styles.profileStatCard}>
              <SkeletonLine width="58%" height={10} />
              <SkeletonLine width="46%" height={18} style={styles.mt12} />
            </View>
          ))}
        </View>
      </View>
    </SkeletonCard>
  );
}

function ProfileInfoCardSkeleton({ rows = 4 }) {
  return (
    <SkeletonCard style={styles.infoCard}>
      <SkeletonLine width="34%" height={12} />
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.infoRow}>
          <SkeletonLine width="26%" height={10} />
          <SkeletonLine width={index % 2 === 0 ? "86%" : "64%"} height={15} style={styles.mt8} />
        </View>
      ))}
    </SkeletonCard>
  );
}

function QuickStatPairSkeleton() {
  return (
    <View style={styles.quickStatRow}>
      {Array.from({ length: 2 }).map((_, index) => (
        <SkeletonCard key={index} style={styles.quickStatCard}>
          <SkeletonLine width="38%" height={10} />
          <SkeletonLine width="62%" height={18} style={styles.mt12} />
        </SkeletonCard>
      ))}
    </View>
  );
}

function EditFieldSkeleton() {
  const { palette } = useSkeleton();

  return (
    <View style={styles.editFieldWrap}>
      <SkeletonLine width="28%" height={10} />
      <View style={[styles.editFieldInput, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
        <SkeletonLine width="72%" height={14} />
      </View>
    </View>
  );
}

function StudentHeroSkeleton() {
  const { palette } = useSkeleton();

  return (
    <View style={[styles.studentHeroShell, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
      <View style={styles.studentHeroTop}>
        <SkeletonCircle size={72} />
        <View style={styles.flexOne}>
          <SkeletonLine width="56%" height={20} />
          <SkeletonLine width="42%" height={12} style={styles.mt10} />
          <SkeletonLine width="30%" height={12} style={styles.mt10} />
        </View>
        <SkeletonCircle size={34} />
      </View>

      <View style={styles.studentMetricRow}>
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={index} style={[styles.studentMetricCard, { backgroundColor: palette.blockSoft }]}> 
            <SkeletonLine width="54%" height={10} />
            <SkeletonLine width="48%" height={18} style={styles.mt12} />
          </View>
        ))}
      </View>
    </View>
  );
}

function FilterBarSkeleton({ count = 3 }) {
  const { palette } = useSkeleton();

  return (
    <View style={[styles.filterBar, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}> 
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBlock key={index} style={styles.filterPill} radius={14} />
      ))}
    </View>
  );
}

function StudentCardSkeleton() {
  return (
    <SkeletonCard style={styles.studentDetailCard}>
      <View style={styles.detailCardHeader}>
        <SkeletonLine width="42%" height={14} />
        <SkeletonLine width={56} height={12} />
      </View>

      <SkeletonLine width="74%" height={12} style={styles.mt14} />

      <View style={styles.detailCardStats}>
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={index} style={styles.detailCardStatItem}>
            <SkeletonLine width="56%" height={10} />
            <SkeletonLine width="44%" height={16} style={styles.mt10} />
          </View>
        ))}
      </View>
    </SkeletonCard>
  );
}

function HistoryEntrySkeleton() {
  const { palette } = useSkeleton();

  return (
    <SkeletonCard style={styles.historyEntryCard}>
      <View style={styles.detailCardHeader}>
        <View style={styles.flexOne}>
          <SkeletonLine width="44%" height={14} />
          <SkeletonLine width="30%" height={10} style={styles.mt8} />
        </View>
        <View style={[styles.statusPillPlaceholder, { backgroundColor: palette.blockSoft }]}>
          <SkeletonLine width={56} height={10} />
        </View>
      </View>

      <View style={styles.historyMetaGrid}>
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={index} style={styles.historyMetaItem}>
            <SkeletonLine width="42%" height={9} />
            <SkeletonLine width="68%" height={14} style={styles.mt8} />
          </View>
        ))}
      </View>
    </SkeletonCard>
  );
}

function MessageRowSkeleton() {
  return (
    <SkeletonCard style={styles.messageRowCard}>
      <View style={styles.messageRowInner}>
        <SkeletonCircle size={54} />
        <View style={styles.flexOne}>
          <View style={styles.detailCardHeader}>
            <SkeletonLine width="42%" height={14} />
            <SkeletonLine width={52} height={10} />
          </View>
          <SkeletonLine width="22%" height={10} style={styles.mt8} />
          <SkeletonLine width="78%" height={12} style={styles.mt12} />
        </View>
      </View>
    </SkeletonCard>
  );
}

function ChatBubbleSkeleton({ align = "left", width = "72%", image = false }) {
  return (
    <View style={[styles.chatBubbleRow, align === "right" ? styles.chatBubbleRight : null]}>
      <View style={[styles.chatBubbleShell, align === "right" ? styles.chatBubbleShellRight : null]}>
        {image ? <SkeletonBlock style={styles.chatImageBubble} radius={18} /> : null}
        <SkeletonLine width={width} height={12} />
        <SkeletonLine width={typeof width === "string" ? "58%" : Math.max(width - 38, 80)} height={12} style={styles.mt8} />
      </View>
    </View>
  );
}

function CalendarGridSkeleton() {
  return (
    <View style={styles.calendarGridWrap}>
      <View style={styles.calendarWeekRow}>
        {Array.from({ length: 7 }).map((_, index) => (
          <SkeletonLine key={index} width={28} height={10} />
        ))}
      </View>

      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <View key={rowIndex} style={styles.calendarCellsRow}>
          {Array.from({ length: 7 }).map((_, cellIndex) => (
            <SkeletonBlock key={cellIndex} style={styles.calendarCell} radius={18} />
          ))}
        </View>
      ))}
    </View>
  );
}

function PostCardSkeleton() {
  return (
    <SkeletonCard style={styles.postCard}>
      <View style={styles.feedHeaderRow}>
        <SkeletonCircle size={46} />
        <View style={styles.flexOne}>
          <SkeletonLine width="44%" height={15} />
          <SkeletonLine width="24%" height={10} style={styles.mt8} />
        </View>
      </View>

      <SkeletonLine width="90%" height={13} style={styles.mt18} />
      <SkeletonLine width="72%" height={13} style={styles.mt10} />
      <SkeletonBlock style={styles.postImage} radius={20} />
      <SkeletonLine width="22%" height={12} style={styles.mt18} />
    </SkeletonCard>
  );
}

function ProfileSkeletonBody({ actionCount }) {
  const insets = useSafeAreaInsets();

  return (
    <SkeletonViewport
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 32,
      }}
    >
      <TopActionRow count={actionCount} />
      <ProfileHeroSkeleton />
      <QuickStatPairSkeleton />
      <ProfileInfoCardSkeleton rows={4} />
      <ProfileInfoCardSkeleton rows={3} />
    </SkeletonViewport>
  );
}

function StudentScreenSkeletonBody({ sectionCards = 4 }) {
  return (
    <SkeletonViewport
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 88,
      }}
    >
      <StudentHeroSkeleton />
      <FilterBarSkeleton />
      {Array.from({ length: sectionCards }).map((_, index) => (
        <StudentCardSkeleton key={index} />
      ))}
    </SkeletonViewport>
  );
}

export function HomeFeedSkeleton() {
  return (
    <SkeletonProvider>
      <SkeletonViewport
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 96,
        }}
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <FeedCardSkeleton key={index} />
        ))}
      </SkeletonViewport>
    </SkeletonProvider>
  );
}

export function ProfileScreenSkeleton() {
  return (
    <SkeletonProvider>
      <ProfileSkeletonBody actionCount={2} />
    </SkeletonProvider>
  );
}

export function UserProfileScreenSkeleton() {
  return (
    <SkeletonProvider>
      <ProfileSkeletonBody actionCount={1} />
    </SkeletonProvider>
  );
}

export function EditProfileScreenSkeleton() {
  const Body = () => {
    const insets = useSafeAreaInsets();

    return (
      <SkeletonViewport
        contentContainerStyle={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 16,
          paddingBottom: 32,
        }}
      >
        <View style={styles.topActionRow}>
          <SkeletonCircle size={38} />
          <SkeletonBlock style={styles.savePill} radius={18} />
        </View>

        <SkeletonCard style={styles.editHeroCard}>
          <View style={styles.editHeroContent}>
            <SkeletonCircle size={58} />
            <View style={styles.flexOne}>
              <SkeletonLine width="46%" height={18} />
              <SkeletonLine width="78%" height={12} style={styles.mt10} />
              <SkeletonLine width={116} height={12} style={styles.mt12} />
            </View>
          </View>
        </SkeletonCard>

        <SkeletonCard style={styles.infoCard}>
          {Array.from({ length: 6 }).map((_, index) => (
            <EditFieldSkeleton key={index} />
          ))}
        </SkeletonCard>
      </SkeletonViewport>
    );
  };

  return (
    <SkeletonProvider>
      <Body />
    </SkeletonProvider>
  );
}

export function PaymentHistoryScreenSkeleton() {
  return (
    <SkeletonProvider>
      <SkeletonViewport
        contentContainerStyle={{
          paddingTop: 6,
          paddingBottom: 28,
        }}
      >
        <SkeletonCard style={styles.historyHeroCard}>
          <SkeletonLine width="36%" height={22} />
          <SkeletonLine width="62%" height={12} style={styles.mt12} />

          <View style={styles.profileStatsRow}>
            {Array.from({ length: 3 }).map((_, index) => (
              <View key={index} style={styles.profileStatCard}>
                <SkeletonLine width="54%" height={10} />
                <SkeletonLine width="42%" height={18} style={styles.mt12} />
              </View>
            ))}
          </View>

          <View style={styles.profilePillRow}>
            <SkeletonLine width={104} height={12} />
            <SkeletonLine width={88} height={12} />
          </View>
        </SkeletonCard>

        {Array.from({ length: 4 }).map((_, index) => (
          <HistoryEntrySkeleton key={index} />
        ))}
      </SkeletonViewport>
    </SkeletonProvider>
  );
}

export function AttendanceScreenSkeleton() {
  return (
    <SkeletonProvider>
      <StudentScreenSkeletonBody sectionCards={4} />
    </SkeletonProvider>
  );
}

export function ClassMarkScreenSkeleton() {
  return (
    <SkeletonProvider>
      <StudentScreenSkeletonBody sectionCards={4} />
    </SkeletonProvider>
  );
}

export function CalendarScreenSkeleton() {
  return (
    <SkeletonProvider>
      <SkeletonViewport
        safeArea
        edges={["left", "right"]}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 40,
        }}
      >
        <View style={styles.calendarHeaderRow}>
          <View style={styles.flexOne}>
            <SkeletonLine width="34%" height={18} />
            <SkeletonLine width="48%" height={12} style={styles.mt10} />
          </View>
          <SkeletonBlock style={styles.calendarActionPill} radius={18} />
        </View>

        <SkeletonCard style={styles.calendarCard}>
          <View style={styles.calendarMonthRow}>
            <SkeletonCircle size={34} />
            <SkeletonLine width="42%" height={20} />
            <SkeletonCircle size={34} />
          </View>
          <CalendarGridSkeleton />
        </SkeletonCard>

        <SkeletonCard style={styles.infoCard}>
          <SkeletonLine width="26%" height={14} />
          <SkeletonLine width="78%" height={12} style={styles.mt18} />
          <SkeletonLine width="58%" height={12} style={styles.mt10} />
        </SkeletonCard>

        <SkeletonCard style={styles.infoCard}>
          <SkeletonLine width="30%" height={14} />
          {Array.from({ length: 3 }).map((_, index) => (
            <View key={index} style={styles.historyMetaItem}>
              <SkeletonLine width="68%" height={12} style={index === 0 ? styles.mt18 : styles.mt14} />
              <SkeletonLine width="42%" height={10} style={styles.mt8} />
            </View>
          ))}
        </SkeletonCard>
      </SkeletonViewport>
    </SkeletonProvider>
  );
}

export function MessagesListSkeleton() {
  return (
    <SkeletonProvider>
      <SkeletonViewport
        scroll={false}
        contentContainerStyle={{
          paddingTop: 6,
          paddingBottom: 12,
        }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <MessageRowSkeleton key={index} />
        ))}
      </SkeletonViewport>
    </SkeletonProvider>
  );
}

export function ChatThreadSkeleton() {
  return (
    <SkeletonProvider>
      <SkeletonViewport
        scroll={false}
        contentContainerStyle={{
          flex: 1,
        }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingVertical: 18,
            paddingHorizontal: 14,
          }}
        >
          <ChatBubbleSkeleton width="64%" />
          <ChatBubbleSkeleton align="right" width="74%" />
          <ChatBubbleSkeleton width="54%" />
          <ChatBubbleSkeleton align="right" image width="62%" />
          <ChatBubbleSkeleton width="70%" />
        </ScrollView>
      </SkeletonViewport>
    </SkeletonProvider>
  );
}

export function PostDetailScreenSkeleton() {
  const Body = () => {
    const insets = useSafeAreaInsets();

    return (
      <SkeletonViewport
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 28,
        }}
      >
        <SkeletonBlock style={styles.postBackPill} radius={20} />
        <PostCardSkeleton />
      </SkeletonViewport>
    );
  };

  return (
    <SkeletonProvider>
      <Body />
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  block: {
    overflow: "hidden",
  },
  shimmerWrap: {
    position: "absolute",
    top: -2,
    bottom: -2,
    left: -140,
    width: "62%",
  },
  shimmerBand: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  mt8: {
    marginTop: 8,
  },
  mt10: {
    marginTop: 10,
  },
  mt12: {
    marginTop: 12,
  },
  mt14: {
    marginTop: 14,
  },
  mt18: {
    marginTop: 18,
  },
  feedCard: {
    paddingBottom: 20,
  },
  feedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  feedImage: {
    width: "100%",
    height: 214,
    marginTop: 18,
  },
  feedFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 18,
  },
  topActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  topActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileHeroCard: {
    padding: 0,
    overflow: "hidden",
  },
  profileHeroBanner: {
    height: 166,
    margin: 0,
  },
  profileAvatarSlot: {
    alignItems: "center",
    marginTop: -53,
  },
  profileHeroContent: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  profilePillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  profileStatsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginTop: 18,
    width: "100%",
  },
  profileStatCard: {
    flex: 1,
  },
  infoCard: {
    paddingTop: 18,
  },
  infoRow: {
    marginTop: 18,
  },
  quickStatRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  quickStatCard: {
    flex: 1,
    marginBottom: 0,
  },
  savePill: {
    width: 108,
    height: 36,
  },
  editHeroCard: {
    marginBottom: 16,
  },
  editHeroContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  editFieldWrap: {
    marginTop: 18,
  },
  editFieldInput: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 10,
  },
  historyHeroCard: {
    paddingTop: 20,
  },
  historyEntryCard: {
    marginBottom: 14,
  },
  statusPillPlaceholder: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  historyMetaGrid: {
    gap: 12,
    marginTop: 18,
  },
  historyMetaItem: {
    gap: 0,
  },
  studentHeroShell: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
  },
  studentHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  studentMetricRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  studentMetricCard: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  filterBar: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    flex: 1,
    height: 34,
  },
  studentDetailCard: {
    marginBottom: 14,
  },
  detailCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  detailCardStats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  detailCardStatItem: {
    flex: 1,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  calendarActionPill: {
    width: 104,
    height: 36,
  },
  calendarCard: {
    paddingTop: 20,
  },
  calendarMonthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  calendarGridWrap: {
    gap: 10,
  },
  calendarWeekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  calendarCellsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  calendarCell: {
    flex: 1,
    height: 42,
  },
  messageRowCard: {
    paddingVertical: 14,
    marginBottom: 12,
    borderRadius: 22,
  },
  messageRowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  chatBubbleRow: {
    alignItems: "flex-start",
    marginBottom: 12,
  },
  chatBubbleRight: {
    alignItems: "flex-end",
  },
  chatBubbleShell: {
    width: "82%",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: "transparent",
  },
  chatBubbleShellRight: {
    alignItems: "flex-end",
  },
  chatImageBubble: {
    width: 162,
    height: 132,
    marginBottom: 10,
  },
  postBackPill: {
    width: 96,
    height: 38,
    marginBottom: 16,
  },
  postCard: {
    paddingTop: 18,
  },
  postImage: {
    width: "100%",
    height: 260,
    marginTop: 20,
  },
});