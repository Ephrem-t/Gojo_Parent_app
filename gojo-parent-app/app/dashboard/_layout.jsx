// app/dashboard/_layout.jsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { Text, TouchableOpacity } from "react-native";

export default function DashboardLayout() {
  const router = useRouter(); // 🔹 Hook to navigate

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: "#fff",
          shadowColor: "transparent", // remove bottom shadow
          borderBottomWidth: 0,
        },
        headerTitleAlign: "left",
        tabBarActiveTintColor: "#1e90ff",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: { paddingVertical: 5, height: 60 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          headerTitle: () => (
            <Text style={{ fontSize: 24, fontWeight: "bold" }}>Gojo Study</Text>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={{ marginRight: 15 }}
              onPress={() => router.push("/dashboard/messages")} // 🔹 Navigate to messages
            >
              <Ionicons name="paper-plane-outline" size={24} color="black" />
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: "Students",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
          ),
        }}
      />
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
