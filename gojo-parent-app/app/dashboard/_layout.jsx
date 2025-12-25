// app/dashboard/layout.jsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter } from "expo-router";
import { ref, onValue } from "firebase/database";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, TouchableOpacity } from "react-native";
import { database } from "../../constants/firebaseConfig";

export default function DashboardLayout() {
  const router = useRouter();
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let parentListener;
    let userListener;

    const fetchParentProfileImage = async () => {
      try {
        const parentNodeKey = await AsyncStorage.getItem("parentId");
        if (!parentNodeKey) return;

        // Listen to parent node changes
        parentListener = onValue(ref(database, `Parents/${parentNodeKey}`), (parentSnap) => {
          if (!parentSnap.exists()) return;
          const parentData = parentSnap.val();
          const actualUserId = parentData.userId;

          // Listen to user node changes
          if (userListener) userListener(); // remove previous listener
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
        });
      } catch (err) {
        console.log("Profile load error:", err);
        setProfileImage("https://cdn-icons-png.flaticon.com/512/847/847969.png");
        setLoading(false);
      }
    };

    fetchParentProfileImage();

    // Cleanup listeners on unmount
    return () => {
      if (parentListener) parentListener();
      if (userListener) userListener();
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#fff", shadowColor: "transparent", borderBottomWidth: 0 },
        headerTitleAlign: "left",
        tabBarActiveTintColor: "#1e90ff",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: { height: 70 },
        tabBarItemStyle: { flex: 1, justifyContent: "center" },
        tabBarLabelStyle: { fontSize: 12, marginBottom: 6 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          headerLeft: () => (
            <TouchableOpacity style={{ marginLeft: 15 }} onPress={() => router.push("/profile")}>
              {loading ? (
                <ActivityIndicator size="small" />
              ) : (
                <Image
                  source={{ uri: profileImage || "https://cdn-icons-png.flaticon.com/512/847/847969.png" }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                />
              )}
            </TouchableOpacity>
          ),
          headerTitle: () => <Text style={{ fontSize: 22, fontWeight: "bold" }}>Gojo Study</Text>,
          headerRight: () => (
            <TouchableOpacity style={{ marginRight: 15 }} onPress={() => router.push("/messages")}>
              <Ionicons name="paper-plane-outline" size={24} />
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="students"
        options={{
          title: "Students",
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
