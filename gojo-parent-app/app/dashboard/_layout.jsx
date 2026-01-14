import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter } from "expo-router";
import { ref, onValue, off } from "firebase/database";
import { useEffect, useState, useRef } from "react";
import { ActivityIndicator, Image, Text, TouchableOpacity, View, StyleSheet, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { database } from "../../constants/firebaseConfig";

export default function DashboardLayout() {
  const router = useRouter();
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [parentUserId, setParentUserId] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);

  // Shimmer animation
  const shimmerAnim = new Animated.Value(0);
  
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
  }, []);

  // Keep refs to listeners so we can detach them on cleanup
  const parentListenerRef = useRef(null);
  const userListenerRef = useRef(null);
  const chatsListenerRef = useRef(null);

  useEffect(() => {
    let parentListener;
    let userListener;

    const fetchParentProfileImage = async () => {
      try {
        const parentNodeKey = await AsyncStorage.getItem("parentId");
        if (!parentNodeKey) {
          setLoading(false);
          return;
        }

        // Listen to parent node changes
        parentListener = onValue(ref(database, `Parents/${parentNodeKey}`), (parentSnap) => {
          if (!parentSnap.exists()) return;
          const parentData = parentSnap.val();
          const actualUserId = parentData.userId;
          setParentUserId(actualUserId);

          // Listen to user node changes
          if (userListener) off(ref(database, `Users/${actualUserId}`), "value", userListener);
          userListener = onValue(ref(database, `Users/${actualUserId}`), (userSnap) => {
            if (userSnap.exists()) {
              const user = userSnap.val();
              setProfileImage(
                user.profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png"
              );
            } else {
              setProfileImage("https://cdn-icons-png.flaticon.com/512/847/847969.png");
            }
            setLoading(false);
          });

          // save listener refs so we can clean them later
          parentListenerRef.current = () => off(ref(database, `Parents/${parentNodeKey}`), "value", parentListener);
          userListenerRef.current = () => off(ref(database, `Users/${actualUserId}`), "value", userListener);
        });
      } catch (err) {
        // console.log removed for production
        setProfileImage("https://cdn-icons-png.flaticon.com/512/847/847969.png");
        setLoading(false);
      }
    };

    fetchParentProfileImage();

    // Cleanup listeners on unmount
    return () => {
      if (parentListenerRef.current) parentListenerRef.current();
      if (userListenerRef.current) userListenerRef.current();
      if (chatsListenerRef.current) chatsListenerRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skeleton components
  const ProfileSkeleton = () => (
    <Animated.View 
      style={[
        { width: 40, height: 40, borderRadius: 20 },
        styles.skeleton,
        {
          opacity: shimmerAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 0.7],
          }),
        }
      ]} 
    />
  );

  const MessageIconSkeleton = () => (
    <View style={styles.messageContainer}>
      <Animated.View 
        style={[
          { width: 24, height: 24, borderRadius: 4 },
          styles.skeleton,
          {
            opacity: shimmerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.7],
            }),
          }
        ]} 
      />
    </View>
  );

  // Listen for total unread when we have the parentUserId
  useEffect(() => {
    if (!parentUserId) {
      setTotalUnread(0);
      return;
    }

    const chatsRef = ref(database, "Chats");
    const chatsListener = onValue(chatsRef, (snap) => {
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
    });

    // store cleanup function
    chatsListenerRef.current = () => off(chatsRef, "value", chatsListener);

    // cleanup if parentUserId changes / on unmount
    return () => {
      if (chatsListenerRef.current) chatsListenerRef.current();
    };
  }, [parentUserId]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <StatusBar style="light" backgroundColor="#000" />
      <Tabs
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: "#fff", shadowColor: "transparent", borderBottomWidth: 0 },
          headerTitleAlign: "left",
          tabBarActiveTintColor: "#1e90ff",
          tabBarInactiveTintColor: "gray",
          tabBarStyle: { 
            height: 56, // default Material height
            paddingBottom: 6, // minimal padding
            backgroundColor: "#fff",
          },
          tabBarItemStyle: { flex: 1, justifyContent: "center" },
          tabBarLabelStyle: { display: "none" },
        }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          headerLeft: () => (
            <TouchableOpacity style={{ marginLeft: 15 }} onPress={() => router.push("/profile")}>
              {loading ? <ProfileSkeleton /> : (
                <Image
                  source={{ uri: profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png" }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                />
              )}
            </TouchableOpacity>
          ),
          headerTitle: () => <Text style={styles.instagramTitle}>Gojo Study</Text>,
          headerRight: () => (
            <TouchableOpacity style={{ marginRight: 15 }} onPress={() => router.push("/messages")}>
              {loading ? <MessageIconSkeleton /> : (
                <View style={styles.messageContainer}>
                  <Ionicons name="paper-plane-outline" size={24} color="#000" />
                  {totalUnread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{totalUnread > 99 ? "99+" : totalUnread}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="classMark"
        options={{
          title: "Class Mark",
          tabBarIcon: ({ color, size }) => <Ionicons name="create-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  unreadBadge: {
    position: "absolute",
    right: -2,
    top: -4,
    backgroundColor: "#1e90ff",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  skeleton: {
    backgroundColor: "#e1e1e1",
  },
  instagramTitle: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "System",
    letterSpacing: -0.5,
    marginLeft: 10,
  },
  messageContainer: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
});