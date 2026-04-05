import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";
import { ref, onValue, off, get } from "firebase/database";
import { useEffect, useState, useRef, useCallback } from "react";
import { Image, Text, TouchableOpacity, View, StyleSheet, Animated, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { database } from "../../constants/firebaseConfig";

const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/847/847969.png";
const TAB_COLORS = {
  text: "#11181C",
  background: "#F6F8FC",
  border: "#E4EAF5",
  muted: "#6B7894",
  primary: "#007AFB",
  soft: "#EEF5FF",
  tabBar: "#FFFFFF",
  tabInactive: "#6B7280",
  danger: "#F87171",
  tabGlass: "rgba(255,255,255,0.9)",
  tabGlassBorder: "rgba(221,228,240,0.95)",
  tabGlassHighlight: "rgba(255,255,255,0.72)",
  tabGlassActive: "rgba(0,122,251,0.08)",
  white: "#FFFFFF",
};

export default function DashboardLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [schoolName, setSchoolName] = useState("");
  const [schoolKey, setSchoolKey] = useState(null);

  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [parentUserId, setParentUserId] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);

  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const parentRefRef = useRef(null);
  const parentCallbackRef = useRef(null);

  const userRefRef = useRef(null);
  const userCallbackRef = useRef(null);

  const chatsRefRef = useRef(null);
  const chatsCallbackRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    (async () => {
      try {
        await NavigationBar.setPositionAsync("absolute");
        await NavigationBar.setBackgroundColorAsync("#00000000");
        await NavigationBar.setBorderColorAsync("#00000000");
        await NavigationBar.setButtonStyleAsync("dark");
      } catch (error) {
        console.warn("Navigation bar style error:", error);
      }
    })();

    return () => {
      (async () => {
        try {
          await NavigationBar.setBackgroundColorAsync(TAB_COLORS.tabBar);
          await NavigationBar.setBorderColorAsync(TAB_COLORS.border);
          await NavigationBar.setPositionAsync("relative");
          await NavigationBar.setButtonStyleAsync("dark");
        } catch {}
      })();
    };
  }, []);

  const schoolAwarePath = useCallback(
    (subPath, key = schoolKey) => {
      if (key) return `Platform1/Schools/${key}/${subPath}`;
      return subPath;
    },
    [schoolKey]
  );

  const cleanupParentListener = useCallback(() => {
    if (parentRefRef.current && parentCallbackRef.current) {
      try {
        off(parentRefRef.current, "value", parentCallbackRef.current);
      } catch {}
    }
    parentRefRef.current = null;
    parentCallbackRef.current = null;
  }, []);

  const cleanupUserListener = useCallback(() => {
    if (userRefRef.current && userCallbackRef.current) {
      try {
        off(userRefRef.current, "value", userCallbackRef.current);
      } catch {}
    }
    userRefRef.current = null;
    userCallbackRef.current = null;
  }, []);

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
            setSchoolName(info.name || "School");
          } else {
            setSchoolName("School");
          }
        } else {
          setSchoolName("School");
        }
      } catch {
        if (mounted) setSchoolName("School");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

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
        const parentDbRef = ref(database, parentRefPath);

        cleanupParentListener();
        cleanupUserListener();

        const parentCallback = (parentSnap) => {
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
            cleanupUserListener();
            return;
          }

          const userRefPath = schoolAwarePath(`Users/${actualUserId}`);
          const userDbRef = ref(database, userRefPath);

          cleanupUserListener();

          const userCallback = (userSnap) => {
            if (!mounted) return;

            if (userSnap.exists()) {
              const user = userSnap.val() || {};
              setProfileImage(user.profileImage || DEFAULT_AVATAR);
            } else {
              setProfileImage(DEFAULT_AVATAR);
            }

            setLoading(false);
          };

          userRefRef.current = userDbRef;
          userCallbackRef.current = userCallback;
          onValue(userDbRef, userCallback);
        };

        parentRefRef.current = parentDbRef;
        parentCallbackRef.current = parentCallback;
        onValue(parentDbRef, parentCallback);
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
      cleanupParentListener();
      cleanupUserListener();
    };
  }, [schoolKey, schoolAwarePath, cleanupParentListener, cleanupUserListener]);

  useEffect(() => {
    if (!parentUserId) {
      setTotalUnread(0);
      cleanupChatsListener();
      return;
    }

    const chatsRefPath = schoolAwarePath("Chats");
    const chatsDbRef = ref(database, chatsRefPath);

    cleanupChatsListener();

    const chatsCallback = (snap) => {
      if (!snap.exists()) {
        setTotalUnread(0);
        return;
      }

      let total = 0;
      snap.forEach((chatSnap) => {
        const unreadNode = chatSnap.child("unread");
        if (unreadNode.exists()) {
          const val = unreadNode.child(parentUserId).val();
          if (typeof val === "number") total += val;
        }
      });

      setTotalUnread(total);
    };

    chatsRefRef.current = chatsDbRef;
    chatsCallbackRef.current = chatsCallback;
    onValue(chatsDbRef, chatsCallback);

    return () => {
      cleanupChatsListener();
    };
  }, [parentUserId, schoolAwarePath, cleanupChatsListener]);

  useEffect(() => {
    return () => {
      cleanupParentListener();
      cleanupUserListener();
      cleanupChatsListener();
    };
  }, [cleanupParentListener, cleanupUserListener, cleanupChatsListener]);

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
      <Text style={styles.titleAccent}>Study</Text>
    </View>
  );

  const HomeHeaderControls = () => (
    <View style={styles.headerRightRow}>
      <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/messages")}>
        {loading ? (
          <MessageIconSkeleton />
        ) : (
          <View style={styles.chatIconWrap}>
            <Ionicons name="paper-plane-outline" size={19} color={TAB_COLORS.text} />
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

  const HomeHeaderSpacer = () => <View style={styles.headerLeftSpacer} />;

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
        <Image
          source={{ uri: imageUri }}
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
          const color = focused ? TAB_COLORS.primary : TAB_COLORS.tabInactive;
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
      <StatusBar style="dark" backgroundColor={TAB_COLORS.tabBar} translucent={false} />
      <Tabs
        initialRouteName="home"
        tabBar={(props) => <DashboardTabBar {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: TAB_COLORS.tabBar },
          headerShadowVisible: false,
          headerTitleAlign: "left",
          headerTintColor: TAB_COLORS.text,
          sceneStyle: { backgroundColor: TAB_COLORS.background },
        }}
      >
        <Tabs.Screen
          name="classMark"
          options={{
            title: "Class Mark",
            tabBarLabel: "Class Mark",
            headerTitle: "Class Mark",
            headerRight: () => null,
            tabBarIcon: ({ color, size }) => <ClassMarkTabIcon color={color} size={size} />,
          }}
        />

        <Tabs.Screen
          name="attendance"
          options={{
            title: "Attendance",
            tabBarLabel: "Attendance",
            headerTitle: "Attendance",
            headerRight: () => null,
            tabBarIcon: ({ color, size }) => <AttendanceTabIcon color={color} size={size} />,
          }}
        />

        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            headerLeft: () => <HomeHeaderSpacer />,
            headerTitle: () => <HomeHeaderTitle />,
            headerRight: () => <HomeHeaderControls />,
            tabBarIcon: ({ color, focused }) => <HomeTabIcon color={color} focused={focused} />,
          }}
        />

        <Tabs.Screen
          name="school"
          options={{
            href: null,
            title: "Services Center",
            tabBarLabel: "Services",
            headerTitle: () => (
              <Text style={styles.schoolTitle} numberOfLines={1} ellipsizeMode="tail">
                Services Center
              </Text>
            ),
            tabBarIcon: ({ color, size }) => <SchoolTabIcon color={color} size={size} />,
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
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

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginLeft: 8,
  },

  titleText: {
    fontSize: 22,
    color: TAB_COLORS.text,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  titleAccent: {
    fontSize: 22,
    color: TAB_COLORS.primary,
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
    backgroundColor: TAB_COLORS.tabGlass,
    borderWidth: 1,
    borderColor: TAB_COLORS.tabGlassBorder,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.045,
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
    backgroundColor: TAB_COLORS.tabGlassHighlight,
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
    backgroundColor: TAB_COLORS.tabGlassActive,
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

  headerLeftSpacer: {
    width: 46,
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
    backgroundColor: TAB_COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: TAB_COLORS.tabBar,
    zIndex: 20,
    elevation: 20,
  },
  unreadText: {
    color: TAB_COLORS.white,
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
    color: TAB_COLORS.text,
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
    backgroundColor: TAB_COLORS.soft,
  },
});