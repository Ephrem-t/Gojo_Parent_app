import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";
import { ref, onValue, off, get } from "firebase/database";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Text, TouchableOpacity, View, StyleSheet, Animated, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { database } from "../../constants/firebaseConfig";
import AppImage from "../../components/ui/AppImage";
import { useParentTheme } from "../../hooks/use-parent-theme";

const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/847/847969.png";

export default function DashboardLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, expoStatusBarStyle, navigationBarButtonStyle, isDark, amharic, oromo } = useParentTheme();

  const tabColors = useMemo(
    () => ({
      text: colors.textStrong,
      background: colors.backgroundAlt,
      border: colors.border,
      borderSoft: colors.borderSoft,
      muted: colors.mutedAlt,
      primary: colors.primary,
      soft: colors.primarySoft,
      tabBar: colors.tabBar,
      tabInactive: colors.tabInactive,
      danger: colors.danger,
      tabGlass: colors.tabBar,
      tabGlassBorder: colors.border,
      tabGlassHighlight: colors.borderSoft,
      tabGlassActive: colors.primarySoft,
      systemNavBar: isDark ? "#1A4E778F" : "#C6E7FF8F",
      white: colors.white,
    }),
    [colors, isDark]
  );
  const styles = useMemo(() => createStyles(tabColors), [tabColors]);
  const labels = useMemo(
    () => ({
      classMark: oromo ? "Qormaata" : amharic ? "ውጤት" : "Class Mark",
      attendance: oromo ? "Argama" : amharic ? "መገኘት" : "Attendance",
      home: oromo ? "Mana" : amharic ? "መነሻ" : "Home",
      services: oromo ? "Tajaajiloota" : amharic ? "አገልግሎቶች" : "Services",
      servicesCenter: oromo ? "Giddugala Tajaajilaa" : amharic ? "የአገልግሎት ማዕከል" : "Services Center",
      profile: oromo ? "Profaayilii" : amharic ? "መገለጫ" : "Profile",
      school: oromo ? "Mana Barumsaa" : amharic ? "ትምህርት ቤት" : "School",
    }),
    [amharic, oromo]
  );

  const [, setSchoolName] = useState("");
  const [schoolKey, setSchoolKey] = useState(null);

  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [parentUserId, setParentUserId] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);

  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const chatsRefRef = useRef(null);
  const chatsCallbackRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    (async () => {
      try {
        await NavigationBar.setPositionAsync("absolute");
        await NavigationBar.setBackgroundColorAsync(tabColors.systemNavBar);
        await NavigationBar.setBorderColorAsync("#00000000");
        await NavigationBar.setButtonStyleAsync(navigationBarButtonStyle);
      } catch (error) {
        console.warn("Navigation bar style error:", error);
      }
    })();

    return () => {
      (async () => {
        try {
          await NavigationBar.setBackgroundColorAsync(tabColors.tabBar);
          await NavigationBar.setBorderColorAsync(tabColors.border);
          await NavigationBar.setPositionAsync("relative");
          await NavigationBar.setButtonStyleAsync(navigationBarButtonStyle);
        } catch {}
      })();
    };
  }, [navigationBarButtonStyle, tabColors.border, tabColors.systemNavBar, tabColors.tabBar]);

  const schoolAwarePath = useCallback(
    (subPath, key = schoolKey) => {
      if (key) return `Platform1/Schools/${key}/${subPath}`;
      return subPath;
    },
    [schoolKey]
  );

  const cleanupChatsListener = useCallback(() => {
    if (chatsRefRef.current && chatsCallbackRef.current) {
      try {
        off(chatsRefRef.current, "value", chatsCallbackRef.current);
      } catch {}
    }
    chatsRefRef.current = null;
    chatsCallbackRef.current = null;
  }, []);

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const sk = await AsyncStorage.getItem("schoolKey");
        if (!mounted) return;

        setSchoolKey(sk || null);

        if (sk) {
          const schoolSnap = await get(ref(database, `Platform1/Schools/${sk}/schoolInfo`));
          if (!mounted) return;

          if (schoolSnap.exists()) {
            const info = schoolSnap.val() || {};
              setSchoolName(info.name || labels.school);
          } else {
              setSchoolName(labels.school);
          }
        } else {
            setSchoolName(labels.school);
        }
      } catch {
        if (mounted) setSchoolName(labels.school);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [labels.school]);

  useEffect(() => {
    let mounted = true;

    const fetchParentProfileImage = async () => {
      try {
        const parentNodeKey = await AsyncStorage.getItem("parentId");

        if (!parentNodeKey) {
          if (mounted) {
            setProfileImage(DEFAULT_AVATAR);
            setLoading(false);
          }
          return;
        }

        const parentRefPath = schoolAwarePath(`Parents/${parentNodeKey}`);
        const parentSnap = await get(ref(database, parentRefPath));
        if (!mounted) return;

        if (!parentSnap.exists()) {
          setProfileImage(DEFAULT_AVATAR);
          setLoading(false);
          return;
        }

        const parentData = parentSnap.val() || {};
        const actualUserId = parentData.userId || null;
        setParentUserId(actualUserId);

        if (!actualUserId) {
          setProfileImage(DEFAULT_AVATAR);
          setLoading(false);
          return;
        }

        const userRefPath = schoolAwarePath(`Users/${actualUserId}`);
        const userSnap = await get(ref(database, userRefPath));
        if (!mounted) return;

        if (userSnap.exists()) {
          const user = userSnap.val() || {};
          setProfileImage(user.profileImage || DEFAULT_AVATAR);
        } else {
          setProfileImage(DEFAULT_AVATAR);
        }

        setLoading(false);
      } catch {
        if (mounted) {
          setProfileImage(DEFAULT_AVATAR);
          setLoading(false);
        }
      }
    };

    if (schoolKey !== undefined) {
      fetchParentProfileImage();
    }

    return () => {
      mounted = false;
    };
  }, [schoolKey, schoolAwarePath]);

  useEffect(() => {
    if (!parentUserId) {
      setTotalUnread(0);
      cleanupChatsListener();
      return;
    }

    const chatSummaryRefPath = schoolAwarePath(`ChatSummaries/${parentUserId}`);
    const summaryDbRef = ref(database, chatSummaryRefPath);

    cleanupChatsListener();

    const chatsCallback = (snap) => {
      if (snap.exists()) {
        let total = 0;
        snap.forEach((chatSnap) => {
          const value = chatSnap.val() || {};
          total += Number(value.unread || 0);
        });
        setTotalUnread(total);
        return;
      }

      const legacyChatsRefPath = schoolAwarePath("Chats");
      const legacyChatsDbRef = ref(database, legacyChatsRefPath);
      const legacyCallback = (legacySnap) => {
        if (!legacySnap.exists()) {
          setTotalUnread(0);
          return;
        }

        let total = 0;
        legacySnap.forEach((chatSnap) => {
          const unreadNode = chatSnap.child("unread");
          if (unreadNode.exists()) {
            const val = unreadNode.child(parentUserId).val();
            if (typeof val === "number") total += val;
          }
        });

        setTotalUnread(total);
      };

      cleanupChatsListener();
      chatsRefRef.current = legacyChatsDbRef;
      chatsCallbackRef.current = legacyCallback;
      onValue(legacyChatsDbRef, legacyCallback);
    };

    chatsRefRef.current = summaryDbRef;
    chatsCallbackRef.current = chatsCallback;
    onValue(summaryDbRef, chatsCallback);

    return () => {
      cleanupChatsListener();
    };
  }, [parentUserId, schoolAwarePath, cleanupChatsListener]);

  useEffect(() => {
    return () => {
      cleanupChatsListener();
    };
  }, [cleanupChatsListener]);

  const skeletonOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const MessageIconSkeleton = () => (
    <View style={styles.chatIconWrap}>
      <Animated.View
        style={[
          styles.skeleton,
          styles.messageSkeleton,
          {
            opacity: skeletonOpacity,
          },
        ]}
      />
    </View>
  );

  const HomeHeaderTitle = () => (
    <View style={styles.titleRow}>
      <Text style={styles.titleText}>Gojo</Text>
      <Text style={styles.titleAccent}>Parent</Text>
    </View>
  );

  const HomeHeaderControls = () => (
    <View style={styles.headerRightRow}>
      <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/messages")}>
        {loading ? (
          <MessageIconSkeleton />
        ) : (
          <View style={styles.chatIconWrap}>
            <Ionicons name="paper-plane-outline" size={19} color={tabColors.text} />
            {totalUnread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{totalUnread > 99 ? "99+" : totalUnread}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const ClassMarkTabIcon = ({ color, size }) => (
    <View style={[styles.tabIconShell, styles.classMarkTabIconWrap]}>
      <Ionicons name="stats-chart-outline" size={size - 1} color={color} />
    </View>
  );

  const AttendanceTabIcon = ({ color, size }) => (
    <View style={[styles.tabIconShell, styles.attendanceTabIconWrap]}>
      <Ionicons name="calendar-outline" size={size - 1} color={color} />
    </View>
  );

  const HomeTabIcon = ({ color, focused }) => (
    <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
  );

  const SchoolTabIcon = ({ color, size }) => (
    <View style={[styles.tabIconShell, styles.schoolTabIconWrap]}>
      <Ionicons name="briefcase-outline" size={size - 2} color={color} />
    </View>
  );

  const ProfileTabIcon = ({ color, size, focused }) => {
    const imageUri = profileImage || DEFAULT_AVATAR;

    if (imageUri) {
      return (
        <AppImage
          uri={imageUri}
          fallbackSource={require("../../assets/images/avatar_placeholder.png")}
          style={[
            styles.tabProfileImage,
            focused && { borderColor: color, transform: [{ scale: 1.06 }] },
          ]}
        />
      );
    }

    return <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size + 2} color={color} />;
  };

  const DashboardTabBar = ({ state, descriptors, navigation }) => (
    <View pointerEvents="box-none" style={styles.telegramTabBarRoot}>
      <View
        style={[
          styles.telegramBarSurface,
          { bottom: Math.max(insets.bottom, 6) },
        ]}
      >
        <View pointerEvents="none" style={styles.telegramBarTopEdge} />
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const options = descriptor.options || {};

          if (options.href === null) return null;

          const focused = state.index === index;
          const color = focused ? tabColors.primary : tabColors.tabInactive;
          const label = typeof options.tabBarLabel === "string"
            ? options.tabBarLabel
            : typeof options.title === "string"
              ? options.title
              : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              activeOpacity={0.88}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[
                styles.telegramTabItem,
                focused && styles.telegramTabItemActive,
                route.name === "home" && styles.telegramHomeTabItem,
              ]}
            >
              <View style={styles.telegramTabIconWrap}>
                {typeof options.tabBarIcon === "function"
                  ? options.tabBarIcon({ focused, color, size: 24 })
                  : null}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.telegramTabLabel,
                  { color },
                  focused && styles.telegramTabLabelActive,
                  route.name === "home" && styles.telegramHomeTabLabel,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <>
      <StatusBar style={expoStatusBarStyle} backgroundColor={tabColors.tabBar} translucent={false} />
      <Tabs
        initialRouteName="home"
        tabBar={(props) => <DashboardTabBar {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: tabColors.tabBar },
          headerShadowVisible: false,
          headerTitleAlign: "left",
          headerTintColor: tabColors.text,
          sceneStyle: { backgroundColor: tabColors.background },
        }}
      >
        <Tabs.Screen
          name="classMark"
          options={{
            title: labels.classMark,
            tabBarLabel: labels.classMark,
            headerTitle: labels.classMark,
            headerRight: () => null,
            tabBarIcon: ({ color, size }) => <ClassMarkTabIcon color={color} size={size} />,
          }}
        />

        <Tabs.Screen
          name="attendance"
          options={{
            title: labels.attendance,
            tabBarLabel: labels.attendance,
            headerTitle: labels.attendance,
            headerRight: () => null,
            tabBarIcon: ({ color, size }) => <AttendanceTabIcon color={color} size={size} />,
          }}
        />

        <Tabs.Screen
          name="home"
          options={{
            title: labels.home,
            headerTitle: () => <HomeHeaderTitle />,
            headerRight: () => <HomeHeaderControls />,
            tabBarIcon: ({ color, focused }) => <HomeTabIcon color={color} focused={focused} />,
          }}
        />

        <Tabs.Screen
          name="school"
          options={{
            href: null,
            title: labels.servicesCenter,
            tabBarLabel: labels.services,
            headerTitle: () => (
              <Text style={styles.schoolTitle} numberOfLines={1} ellipsizeMode="tail">
                {labels.servicesCenter}
              </Text>
            ),
            tabBarIcon: ({ color, size }) => <SchoolTabIcon color={color} size={size} />,
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: labels.profile,
            headerShown: false,
            tabBarIcon: ({ color, size, focused }) => <ProfileTabIcon color={color} size={size} focused={focused} />,
          }}
        />

        <Tabs.Screen name="school/payments" options={{ href: null }} />
        <Tabs.Screen name="school/history" options={{ href: null }} />
        <Tabs.Screen name="school/calendar" options={{ href: null }} />
      </Tabs>
    </>
  );
}

const createStyles = (tabColors) => StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginLeft: 8,
  },

  titleText: {
    fontSize: 22,
    color: tabColors.text,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  titleAccent: {
    fontSize: 22,
    color: tabColors.primary,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginLeft: 4,
  },

  telegramTabBarRoot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },

  telegramBarSurface: {
    position: "absolute",
    left: 10,
    right: 10,
    height: 58,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    backgroundColor: tabColors.tabGlass,
    borderWidth: 1,
    borderColor: tabColors.tabGlassBorder,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },

  telegramBarTopEdge: {
    position: "absolute",
    left: 1,
    right: 1,
    top: 1,
    height: 1,
    borderRadius: 999,
    backgroundColor: tabColors.tabGlassHighlight,
  },

  telegramTabItem: {
    flex: 1,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    paddingBottom: 4,
  },

  telegramHomeTabItem: {
    marginHorizontal: 2,
  },

  telegramTabItemActive: {
    backgroundColor: tabColors.tabGlassActive,
  },

  telegramTabIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 26,
  },

  telegramTabLabel: {
    marginTop: 1,
    fontSize: 10.5,
    fontWeight: "600",
    lineHeight: 12,
  },

  telegramHomeTabLabel: {
    fontWeight: "700",
  },

  telegramTabLabelActive: {
    fontWeight: "800",
  },

  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },

  tabIconShell: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  classMarkTabIconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  attendanceTabIconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  schoolTabIconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  unreadBadge: {
    position: "absolute",
    right: -10,
    top: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: tabColors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: tabColors.tabBar,
    zIndex: 20,
    elevation: 20,
  },
  unreadText: {
    color: tabColors.white,
    fontSize: 10,
    fontWeight: "700",
  },

  skeleton: {
    backgroundColor: "#E1E6EF",
  },
  messageSkeleton: {
    width: 20,
    height: 20,
    borderRadius: 8,
  },

  schoolTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: tabColors.text,
    marginLeft: 8,
  },

  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  chatIconWrap: {
    width: 22,
    height: 22,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },

  tabProfileImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: tabColors.soft,
  },
});