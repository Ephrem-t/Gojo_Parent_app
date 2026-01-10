// app/profile.jsx
import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get, update } from "firebase/database";
import { database, storage } from "../constants/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

const { width } = Dimensions.get("window");
const HEADER_MAX_HEIGHT = 250;
const HEADER_MIN_HEIGHT = 60;
const AVATAR_SIZE = 120;
const CAMERA_SIZE = 40;

export default function ParentProfile() {
  const router = useRouter();
  const [parentUser, setParentUser] = useState(null);
  const [children, setChildren] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showFullProfileImage, setShowFullProfileImage] = useState(true); // Start with full image
  const scrollY = useRef(new Animated.Value(0)).current;

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

        const parentNode = parentsData[parentId];
        if (!parentNode) return;

        const user = usersData[parentNode.userId] || {};
        setParentUser({
          ...user,
          status: parentNode.status,
          createdAt: parentNode.createdAt,
        });

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

  // Handle scroll-based profile image toggle
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      // When any scroll happens (even 1px), show circular image
      if (value > 0 && showFullProfileImage) {
        setShowFullProfileImage(false);
      }
      // When back to top (0 scroll), show full background image
      else if (value === 0 && !showFullProfileImage) {
        setShowFullProfileImage(true);
      }
    });

    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [showFullProfileImage]);

  const handleChildPress = (child) => {
    router.push(`/userProfile?recordId=${child.studentId}`);
  };

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const uploadProfileImage = async (imageUri) => {
    try {
      console.log("Starting image upload for URI:", imageUri);
      
      const parentId = await AsyncStorage.getItem("parentId");
      if (!parentId) {
        console.log("No parentId found");
        Alert.alert("Error", "User not found");
        return;
      }
      console.log("ParentId found:", parentId);

      console.log("Fetching image blob...");
      const response = await fetch(imageUri);
      const blob = await response.blob();
      console.log("Blob created, size:", blob.size);
      
      console.log("Creating storage reference...");
      const imageRef = storageRef(storage, `profileImages/${parentId}`);
      console.log("Storage ref created:", imageRef.fullPath);
      
      console.log("Uploading to storage...");
      await uploadBytes(imageRef, blob);
      console.log("Upload successful");
      
      console.log("Getting download URL...");
      const downloadURL = await getDownloadURL(imageRef);
      console.log("Download URL obtained:", downloadURL);
      
      console.log("Updating database...");
      await update(ref(database, `Users/${parentUser.userId}`), {
        profileImage: downloadURL
      });
      console.log("Database updated");

      setParentUser(prev => ({
        ...prev,
        profileImage: downloadURL
      }));

      Alert.alert("Success", "Profile picture updated successfully");
    } catch (error) {
      console.log("Detailed error uploading image:", error);
      console.log("Error code:", error.code);
      console.log("Error message:", error.message);
      Alert.alert("Error", `Failed to upload image: ${error.message}`);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("parentId");
          router.replace("/");
        },
      },
    ]);
  };

  const handleEditInfo = () => {
    setShowMenu(false);
    router.push("/editMyInfo");
  };

  const handleSetProfilePhoto = () => {
    setShowMenu(false);
    handleImagePicker();
  };

  const handleSaveProfilePhoto = async () => {
    setShowMenu(false);
    
    console.log("Starting save profile photo...");
    console.log("Profile image URL:", parentUser?.profileImage);
    console.log("Default profile:", defaultProfile);
    
    if (!parentUser?.profileImage || parentUser.profileImage === defaultProfile) {
      Alert.alert("Error", "No profile photo to save");
      return;
    }

    try {
      console.log("Requesting media library permissions...");
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      console.log("Permission status:", status);
      
      if (status === 'denied') {
        Alert.alert("Permission Required", "Please allow access to save photos to your gallery in Settings");
        return;
      }
      
      if (status !== 'granted') {
        // Try requesting again for undetermined status
        const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
        console.log("Second permission request status:", newStatus);
        
        if (newStatus !== 'granted') {
          Alert.alert("Permission Required", "Please allow access to save photos to your gallery");
          return;
        }
      }

      console.log("Creating download...");
      // Download image using new API
      const fileName = `profile_photo_${Date.now()}.jpg`;
      console.log("Filename:", fileName);
      
      const fileUri = FileSystem.cacheDirectory + fileName;
      console.log("Download path:", fileUri);
      
      const downloadObject = FileSystem.downloadAsync(parentUser.profileImage, fileUri);
      console.log("Download started:", downloadObject);
      
      const { uri } = await downloadObject;
      console.log("Downloaded to:", uri);
      
      console.log("Creating asset...");
      // Save to device gallery
      const asset = await MediaLibrary.createAssetAsync(uri);
      console.log("Asset created:", asset);
      
      console.log("Creating album...");
      await MediaLibrary.createAlbumAsync('Gojo Parent App', asset, false);
      console.log("Album created");
      
      Alert.alert("Success", "Profile photo saved to your phone's gallery!");
    } catch (error) {
      console.log("Error saving photo:", error);
      console.log("Error details:", JSON.stringify(error, null, 2));
      Alert.alert("Error", `Failed to save profile photo: ${error.message || error}`);
    }
  };

  if (!parentUser) {
    return (
      <View style={styles.loading}>
        <Text>Loading...</Text>
      </View>
    );
  }

  // Header height animation
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: "clamp",
  });

  // Avatar + Name animation (move & shrink together)
  const headerContentTranslate = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [0, -60],
    extrapolate: "clamp",
  });
  const headerContentScale = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [1, 0.6],
    extrapolate: "clamp",
  });
  const headerContentOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT - 20],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // Camera icon animation
  const cameraTranslate = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [0, -60],
    extrapolate: "clamp",
  });
  const cameraOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT - 20],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // Small name in top bar appear
  const smallNameOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT - 20, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Fixed Top Bar with Back & 3-dot */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topIcon}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <Animated.Text style={[styles.smallName, { opacity: smallNameOpacity }]}>
          {parentUser.name}
        </Animated.Text>

        <TouchableOpacity style={styles.topIcon} onPress={() => setShowMenu(!showMenu)}>
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Telegram Style Dropdown Menu */}
      {showMenu && (
        <>
          <TouchableOpacity 
            style={styles.menuOverlay} 
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          />
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEditInfo}>
              <Text style={styles.menuText}>Edit Info</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSetProfilePhoto}>
              <Text style={styles.menuText}>Set Profile Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSaveProfilePhoto}>
              <Text style={styles.menuText}>Save to Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Scrollable content */}
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        contentContainerStyle={{ paddingTop: HEADER_MAX_HEIGHT + CAMERA_SIZE / 2 }}
      >
        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{parentUser.name}</Text>
          </View>
          {parentUser.username && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>{parentUser.username}</Text>
            </View>
          )}
          {parentUser.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{parentUser.phone}</Text>
            </View>
          )}
          {parentUser.email && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{parentUser.email}</Text>
            </View>
          )}
        </View>

        {/* Children Section */}
        {children.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Children</Text>
            {children.map((child) => (
              <TouchableOpacity 
                key={child.studentId} 
                style={styles.childCard}
                onPress={() => handleChildPress(child)}
              >
                <Image source={{ uri: child.profileImage }} style={styles.childImage} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.childName}>{child.name}</Text>
                  <Text style={styles.childDetails}>
                    Grade {child.grade} - Section {child.section}
                  </Text>
                  <Text style={styles.childDetails}>
                    Relation: {child.relationship}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Account Section */}
        <View style={styles.section}>
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
          <TouchableOpacity style={styles.accountItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#dc2626" />
            <Text style={[styles.accountText, { color: "#dc2626" }]}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>

      {/* Animated Header (Avatar + Name move & shrink together) */}
      <Animated.View
        style={[
          styles.header,
          { height: headerHeight }
        ]}
      >
        {/* Background Profile Image - Shows at top (0 scroll) */}
        <Image
          source={{ uri: parentUser.profileImage || defaultProfile }}
          style={[
            styles.bgProfileImage,
            {
              opacity: showFullProfileImage ? 1 : 0,
            }
          ]}
        />
        
        <Animated.View
          style={{
            transform: [
              { translateY: headerContentTranslate },
              { scale: headerContentScale },
            ],
            opacity: showFullProfileImage ? 0 : headerContentOpacity,
            alignItems: "center",
          }}
        >
          {showFullProfileImage ? null : (
            <>
              <Image
                source={{ uri: parentUser.profileImage || defaultProfile }}
                style={styles.avatar}
              />
              <Text style={styles.nameOverlay}>{parentUser.name}</Text>
              <Text style={styles.usernameOverlay}>@{parentUser.username}</Text>
            </>
          )}
        </Animated.View>
      </Animated.View>

      {/* Camera Icon */}
      <TouchableOpacity 
        style={[
          {
            position: "absolute",
            top: HEADER_MAX_HEIGHT - CAMERA_SIZE / 2,
            right: 20,
            width: CAMERA_SIZE,
            height: CAMERA_SIZE,
            zIndex: 20,
          }
        ]}
        onPress={handleImagePicker}
      >
        <Animated.View
          style={[
            {
              width: CAMERA_SIZE,
              height: CAMERA_SIZE,
              borderRadius: CAMERA_SIZE / 2,
              backgroundColor: "#2AABEE",
              justifyContent: "center",
              alignItems: "center",
              transform: [{ translateY: cameraTranslate }],
              opacity: cameraOpacity,
            },
          ]}
        >
          <Ionicons name="camera" size={24} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EFEFF4" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  topBar: {
    position: "absolute",
    top: 20,
    left: 12,
    right: 12,
    height: 40,
    zIndex: 100,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  smallName: { color: "#fff", fontSize: 18, fontWeight: "600" },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#2AABEE",
    alignItems: "center",
    zIndex: 10,
    overflow: "hidden",
  },
  bgProfileImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: "#fff",
    marginTop: HEADER_MAX_HEIGHT / 2 - AVATAR_SIZE / 2,
  },
  nameOverlay: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 8 },
  usernameOverlay: { color: "#EAF4FF", fontSize: 14 },

  cameraIcon: {
    position: "absolute",
    top: HEADER_MAX_HEIGHT - CAMERA_SIZE / 2,
    right: 20,
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: CAMERA_SIZE / 2,
    backgroundColor: "#2AABEE",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },

  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },

  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  infoLabel: { color: "#888", fontSize: 14 },
  infoValue: { color: "#111", fontSize: 14 },

  childCard: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    padding: 12,
    backgroundColor: "#F7F7F7",
    borderRadius: 10,
  },
  childImage: { width: 50, height: 50, borderRadius: 25 },
  childName: { fontSize: 16, fontWeight: "600", color: "#111" },
  childDetails: { fontSize: 14, color: "#555" },

  accountItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  accountText: { fontSize: 16, marginLeft: 12, flex: 1 },

  // Telegram Style Dropdown Menu
  dropdownMenu: {
    position: "absolute",
    top: 28,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    minWidth: 180,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 999,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  menuText: {
    fontSize: 16,
    color: "#000",
    fontWeight: "400",
  },
  logoutText: {
    color: "#ff3b30",
    fontWeight: "500",
  },
});
