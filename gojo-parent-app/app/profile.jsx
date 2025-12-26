// app/profile.jsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get } from "firebase/database";
import { database } from "../constants/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const { width: screenWidth } = Dimensions.get("window");

export default function ParentProfile() {
  const router = useRouter();
  const [parentUser, setParentUser] = useState(null);
  const [children, setChildren] = useState([]);
  const [fetchedData, setFetchedData] = useState({});
  const defaultProfile =
    "https://cdn-icons-png.flaticon.com/512/847/847969.png";

  useEffect(() => {
    const loadParentData = async () => {
      const parentId = await AsyncStorage.getItem("parentId");
      if (!parentId) return;

      try {
        const [usersSnap, parentsSnap, studentsSnap] = await Promise.all([
          get(ref(database, "Users")),
          get(ref(database, "Parents")),
          get(ref(database, "Students")),
        ]);

        const usersData = usersSnap.val() || {};
        const parentsData = parentsSnap.val() || {};
        const studentsData = studentsSnap.val() || {};

        setFetchedData({ usersData, parentsData, studentsData });

        const parentNode = parentsData[parentId];
        if (!parentNode) return;

        const user = usersData[parentNode.userId] || {};
        setParentUser({ ...user, status: parentNode.status, createdAt: parentNode.createdAt });

        const childrenArray = parentNode.children
          ? Object.values(parentNode.children).map((childLink) => {
              const student = studentsData[childLink.studentId];
              const studentUser = usersData[student?.userId] || {};
              return {
                ...childLink,
                name: studentUser.name || "Student Name",
                profileImage: studentUser.profileImage || defaultProfile,
                grade: student?.grade || "--",
                section: student?.section || "--",
              };
            })
          : [];

        setChildren(childrenArray);
      } catch (error) {
        console.log("Error fetching parent profile:", error);
      }
    };

    loadParentData();
  }, []);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => {
        await AsyncStorage.removeItem("parentId");
        router.replace("/"); // navigate to login screen
      } },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back-outline" size={24} color="#2563eb" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Image
          source={{ uri: parentUser?.profileImage || defaultProfile }}
          style={styles.profileImage}
        />
        <Text style={styles.name}>{parentUser?.name || "Parent Name"}</Text>
        <Text style={styles.username}>@{parentUser?.username || "username"}</Text>
        <Text style={styles.status}>
          {parentUser?.status?.toUpperCase() || "--"}
        </Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => Alert.alert("Edit Profile", "Edit feature coming soon")}
        >
          <Ionicons name="pencil-outline" size={20} color="#2563eb" />
          <Text style={styles.editText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Children Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Children</Text>
        <FlatList
          data={children}
          keyExtractor={(item) => item.studentId}
          renderItem={({ item }) => (
            <View style={styles.childCard}>
              <Image
                source={{ uri: item.profileImage }}
                style={styles.childImage}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.childName}>{item.name}</Text>
                <Text style={styles.childDetails}>
                  Grade {item.grade} - Section {item.section}
                </Text>
                <Text style={styles.childDetails}>Relation: {item.relationship}</Text>
              </View>
            </View>
          )}
        />
      </View>

      {/* Account Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.accountItem}>
          <Ionicons name="key-outline" size={20} color="#2563eb" />
          <Text style={styles.accountText}>Change Password</Text>
          <Ionicons name="chevron-forward-outline" size={20} color="#999" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.accountItem}>
          <Ionicons name="mail-outline" size={20} color="#2563eb" />
          <Text style={styles.accountText}>Update Email / Phone</Text>
          <Ionicons name="chevron-forward-outline" size={20} color="#999" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.accountItem}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          <Text style={[styles.accountText, { color: "#dc2626" }]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },

  backButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginTop: 20, 
    marginLeft: 16, 
    marginBottom: 10 
  },
  backText: { fontSize: 16, color: "#2563eb", marginLeft: 6 },

  header: {
    backgroundColor: "#fff",
    paddingVertical: 30,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    marginBottom: 20,
  },
  profileImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 10 },
  name: { fontSize: 22, fontWeight: "700", color: "#111" },
  username: { fontSize: 16, color: "#555", marginBottom: 4 },
  status: { fontSize: 14, color: "#888", marginBottom: 10 },
  editButton: { flexDirection: "row", alignItems: "center" },
  editText: { marginLeft: 6, fontSize: 16, color: "#2563eb" },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },

  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },

  childCard: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  childImage: { width: 50, height: 50, borderRadius: 25 },
  childName: { fontSize: 16, fontWeight: "600", color: "#111" },
  childDetails: { fontSize: 14, color: "#555" },

  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  accountText: { fontSize: 16, marginLeft: 12, flex: 1 },
});
