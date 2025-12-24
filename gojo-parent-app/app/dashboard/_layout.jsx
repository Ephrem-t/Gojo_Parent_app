import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter } from "expo-router";
import { get, ref } from "firebase/database";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
} from "react-native";
import { database } from "../../constants/firebaseConfig";

export default function DashboardLayout() {
  const router = useRouter();
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔹 Load profile image
  useEffect(() => {
    const fetchProfileImage = async () => {
      try {
        const userId = await AsyncStorage.getItem("userId");
        if (!userId) return;

        const snapshot = await get(ref(database, `Users/${userId}`));
        if (snapshot.exists()) {
          setProfileImage(snapshot.val().profileImage);
        }
      } catch (error) {
        console.log("Profile load error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileImage();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: "#fff",
          shadowColor: "transparent",
          borderBottomWidth: 0,
        },
        headerTitleAlign: "left",

        // 🔹 Bottom tab styling
        tabBarActiveTintColor: "#1e90ff",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          height: 70,
        },
        tabBarItemStyle: {
          flex: 1, // ✅ fill full width equally
          justifyContent: "center",
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 6,
        },
      }}
    >
      {/* 🏠 HOME */}
      <Tabs.Screen
        name="home"
        options={{
          headerLeft: () => (
            <TouchableOpacity
              style={{ marginLeft: 15 }}
              onPress={() => router.push("/profile")}
            >
              {loading ? (
                <ActivityIndicator size="small" />
              ) : (
                <Image
                  source={{
                    uri:
                      profileImage ||
                      "https://cdn-icons-png.flaticon.com/512/847/847969.png",
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                  }}
                />
              )}
            </TouchableOpacity>
          ),
          headerTitle: () => (
            <Text style={{ fontSize: 22, fontWeight: "bold" }}>
              Gojo Study
            </Text>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={{ marginRight: 15 }}
              onPress={() => router.push("/messages")}
            >
              <Ionicons name="paper-plane-outline" size={24} />
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 👨‍🎓 STUDENTS */}
      <Tabs.Screen
        name="students"
        options={{
          title: "Students",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      {/* ⚙️ SETTINGS */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
