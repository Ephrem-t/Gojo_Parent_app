import { useEffect, useState, useRef, useCallback } from "react";
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  Alert,
  TextInput,
  Modal,
  Linking,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get, update } from "firebase/database";
import { database, storage } from "../constants/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getLinkedChildrenForParent } from "./lib/parentChildren";

const { width } = Dimensions.get("window");

const HEADER_MAX_HEIGHT = Math.max(220, Math.min(280, width * 0.68));
const HEADER_MIN_HEIGHT = 58;
const PALETTE = {
  background: "#ffffff",
  card: "#FFFFFF",
  accent: "#2296F3",
  accentDark: "#0B72C7",
  accentSoft: "#EAF5FF",
  text: "#0F172A",
  subtext: "#475569",
  muted: "#64748B",
  border: "#E5EDF5",
  white: "#FFFFFF",
  danger: "#E53935",
  success: "#10B981",
  offline: "#94A3B8",
};

const TERMS_URL = "https://example.com/terms";

export default function ParentProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [schoolKey, setSchoolKey] = useState(null);
  const [parentNodeId, setParentNodeId] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [parentUser, setParentUser] = useState(null);
  const [children, setChildren] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [online, setOnline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileSectionTab, setProfileSectionTab] = useState("main");

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const scrollY = useRef(new Animated.Value(0)).current;

  const defaultProfile = "https://cdn-icons-png.flaticon.com/512/847/847969.png";

  const schoolAwarePath = useCallback(
    (subPath) => (schoolKey ? `Platform1/Schools/${schoolKey}/${subPath}` : subPath),
    [schoolKey]
  );

  useEffect(() => {
    (async () => {
      const [pid, sk] = await Promise.all([
        AsyncStorage.getItem("parentId"),
        AsyncStorage.getItem("schoolKey"),
      ]);
      setParentNodeId(pid || null);
      setSchoolKey(sk || null);
      setBootstrapped(true);
    })();
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!parentNodeId) {
      setLoading(false);
      return;
    }

    const loadParentData = async () => {
      setLoading(true);
      try {
        const prefix = schoolKey ? `Platform1/Schools/${schoolKey}/` : "";
        const parentSnap = await get(ref(database, `${prefix}Parents/${parentNodeId}`));
        if (!parentSnap.exists()) {
          setParentUser(null);
          setChildren([]);
          return;
        }

        const parentNode = parentSnap.val() || {};

        const [userSnap, linkedChildren] = await Promise.all([
          parentNode.userId
            ? get(ref(database, `${prefix}Users/${parentNode.userId}`))
            : Promise.resolve(null),
          getLinkedChildrenForParent(prefix, parentNodeId),
        ]);

        const userData = userSnap?.exists() ? userSnap.val() || {} : {};
        setParentUser({
          ...userData,
          userId: parentNode.userId,
          status: parentNode.status,
          createdAt: parentNode.createdAt,
        });

        setChildren(
          (linkedChildren || []).map((child) => ({
            ...child,
            profileImage: child.profileImage || defaultProfile,
          }))
        );
      } catch (error) {
        console.log("Error fetching parent profile:", error);
      } finally {
        setLoading(false);
      }
    };

    loadParentData();
  }, [bootstrapped, defaultProfile, parentNodeId, schoolKey]);

  useEffect(() => {
    let listener;
    (async () => {
      const state = await getNetworkStateAsync();
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      listener = addNetworkStateListener((s) => {
        setOnline(Boolean(s.isConnected && s.isInternetReachable !== false));
      });
    })();
    return () => {
      if (listener?.remove) listener.remove();
    };
  }, []);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/dashboard/home");
  }, [router]);

  const handleChildPress = (child) => {
    router.push(`/userProfile?recordId=${child.studentId}`);
  };

  const handleLogout = async () => {
    setShowMenu(false);
    await AsyncStorage.clear();
    router.replace("/");
  };

  const handleTerms = useCallback(async () => {
    setShowMenu(false);
    try {
      const supported = await Linking.canOpenURL(TERMS_URL);
      if (supported) Linking.openURL(TERMS_URL);
      else Alert.alert("Unable to open", "Please view our Terms & Privacy on the website.");
    } catch {
      Alert.alert("Unable to open", "Please view our Terms & Privacy on the website.");
    }
  }, []);

  const handleEditInfo = () => {
    setShowMenu(false);
    router.push("/editMyInfo");
  };

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const uploadProfileImage = async (imageUri) => {
    try {
      if (!parentUser?.userId) return Alert.alert("Error", "User not found");

      const blob = await (await fetch(imageUri)).blob();
      const imageRef = storageRef(storage, `profileImages/${parentUser.userId}`);
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);

      await update(ref(database, schoolAwarePath(`Users/${parentUser.userId}`)), {
        profileImage: downloadURL,
      });

      setParentUser((prev) => ({ ...prev, profileImage: downloadURL }));
      Alert.alert("Success", "Profile picture updated successfully");
    } catch (error) {
      Alert.alert("Error", `Failed to upload image: ${error.message}`);
    }
  };

  const handleSaveProfilePhoto = async () => {
    setShowMenu(false);
    if (!parentUser?.profileImage || parentUser.profileImage === defaultProfile) {
      return Alert.alert("Error", "No profile photo to save");
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        return Alert.alert("Permission Required", "Please allow access to save photos to your gallery");
      }

      const fileName = `profile_photo_${Date.now()}.jpg`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      const { uri } = await FileSystem.downloadAsync(parentUser.profileImage, fileUri);

      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync("Gojo Parent App", asset, false);
      Alert.alert("Success", "Profile photo saved to gallery!");
    } catch (error) {
      Alert.alert("Error", `Failed to save profile photo: ${error.message || error}`);
    }
  };

  const validateCurrentPassword = async () => {
    if (!currentPassword) {
      setCurrentPasswordError("Current password is required");
      return false;
    }
    try {
      const userRef = ref(database, schoolAwarePath(`Users/${parentUser.userId}`));
      const snapshot = await get(userRef);
      const userData = snapshot.val();
      if (userData?.password !== currentPassword) {
        setCurrentPasswordError("Current password is incorrect");
        return false;
      }
      setCurrentPasswordError("");
      return true;
    } catch {
      setCurrentPasswordError("Error validating current password");
      return false;
    }
  };

  const validateNewPassword = () => {
    if (!newPassword) {
      setNewPasswordError("New password is required");
      return false;
    }
    if (newPassword.length < 6) {
      setNewPasswordError("New password must be at least 6 characters long");
      return false;
    }
    setNewPasswordError("");
    return true;
  };

  const validateConfirmPassword = () => {
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your new password");
      return false;
    }
    if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      return false;
    }
    setConfirmPasswordError("");
    return true;
  };

  const handleChangePassword = async () => {
    setCurrentPasswordError("");
    setNewPasswordError("");
    setConfirmPasswordError("");

    const isCurrentValid = await validateCurrentPassword();
    const isNewValid = validateNewPassword();
    const isConfirmValid = validateConfirmPassword();

    if (!isCurrentValid || !isNewValid || !isConfirmValid) return;

    setIsChangingPassword(true);
    try {
      await update(ref(database, schoolAwarePath(`Users/${parentUser.userId}`)), {
        password: newPassword,
      });
      Alert.alert("Success", "Password updated successfully");
      handleClosePasswordModal();
    } catch (error) {
      Alert.alert("Error", `Failed to change password: ${error.message}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setCurrentPasswordError("");
    setNewPasswordError("");
    setConfirmPasswordError("");
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={PALETTE.accent} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!parentUser) {
    return (
      <View style={styles.loadingWrap}>
        <Ionicons name="person-circle-outline" size={56} color={PALETTE.offline} />
        <Text style={styles.loadingTitle}>Profile unavailable</Text>
        <Text style={styles.loadingText}>We could not load this parent profile.</Text>
        <TouchableOpacity style={styles.emptyBackBtn} onPress={handleBack} activeOpacity={0.88}>
          <Text style={styles.emptyBackText}>Back to dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOnline = online !== null ? online : String(parentUser.status || "").toLowerCase() === "online";
  const usernameHandle = parentUser.username
    ? String(parentUser.username).startsWith("@")
      ? String(parentUser.username)
      : `@${parentUser.username}`
    : "@parent";

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {showMenu && (
        <>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)} />
          <View style={[styles.dropdownMenu, { top: insets.top + 52 }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEditInfo}>
              <Text style={styles.menuText}>Edit Info</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleImagePicker}>
              <Text style={styles.menuText}>Set Profile Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSaveProfilePhoto}>
              <Text style={styles.menuText}>Save to Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleTerms}>
              <Text style={styles.menuText}>Terms & Privacy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemNoBorder]} onPress={handleLogout}>
              <Text style={[styles.menuText, { color: PALETTE.danger, fontWeight: "700" }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(28, insets.bottom + 16),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          <View style={styles.heroCard}>
            <View style={[styles.heroBanner, { height: 110 + insets.top }]}> 
              <View style={styles.heroBannerFallback}>
                <View style={styles.heroBannerOrbPrimary} />
                <View style={styles.heroBannerOrbSecondary} />
              </View>
              <View style={styles.heroBannerOverlay} />

              <View style={[styles.heroTopBar, { top: insets.top + 6 }]}> 
                <TouchableOpacity style={styles.heroTopIconBtn} onPress={handleBack}>
                  <Ionicons name="chevron-back" size={20} color={PALETTE.white} />
                </TouchableOpacity>

                <View style={styles.heroTopActions}>
                  <View style={styles.heroQuickStats}>
                    <MiniPill
                      icon="people-outline"
                      text={`${children.length} ${children.length === 1 ? "Child" : "Children"}`}
                    />
                  </View>

                  <TouchableOpacity style={styles.heroTopIconBtn} onPress={() => setShowMenu((v) => !v)}>
                    <Ionicons name="ellipsis-horizontal" size={18} color={PALETTE.white} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.heroAvatarSlot}>
              <View style={styles.avatarWrap}>
                <View style={styles.photoCard}>
                  <View style={styles.photoCardImageClip}>
                    <Image source={{ uri: parentUser.profileImage || defaultProfile }} style={styles.photoCardImage} />
                  </View>
                  <TouchableOpacity style={styles.photoCardCamera} onPress={handleImagePicker} activeOpacity={0.9}>
                    <Ionicons name="camera" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.heroIdentityBlock}>
              <View style={styles.identityTopRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {parentUser.name || "Parent"}
                </Text>
              </View>

              <View style={styles.subRow}>
                <Text style={styles.subText}>{usernameHandle}</Text>
                <MiniPill icon="person-outline" text="Parent" compact />
                <MiniPill
                  icon={isOnline ? "wifi-outline" : "cloud-offline-outline"}
                  text={isOnline ? "Online" : "Offline"}
                  compact
                />
              </View>

              <TouchableOpacity style={styles.editProfileBtn} onPress={handleEditInfo} activeOpacity={0.88}>
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </TouchableOpacity>

              <View style={styles.profileFilterRow}>
                <TouchableOpacity
                  style={[
                    styles.profileFilterBtn,
                    profileSectionTab === "main" && styles.profileFilterBtnActive,
                  ]}
                  onPress={() => setProfileSectionTab("main")}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.profileFilterText,
                      profileSectionTab === "main" && styles.profileFilterTextActive,
                    ]}
                  >
                    Main
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.profileFilterBtn,
                    profileSectionTab === "info" && styles.profileFilterBtnActive,
                  ]}
                  onPress={() => setProfileSectionTab("info")}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.profileFilterText,
                      profileSectionTab === "info" && styles.profileFilterTextActive,
                    ]}
                  >
                    Info
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {profileSectionTab === "main" ? (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Children</Text>
                {children.length ? (
                  children.map((child) => (
                    <TouchableOpacity
                      key={child.studentId}
                      style={styles.childCard}
                      onPress={() => handleChildPress(child)}
                      activeOpacity={0.88}
                    >
                      <Image source={{ uri: child.profileImage }} style={styles.childImage} />
                      <View style={styles.childBody}>
                        <Text style={styles.childName}>{child.name}</Text>
                        <Text style={styles.childMeta}>
                          Grade {child.grade} • Section {child.section}
                        </Text>
                        <Text style={styles.childMeta}>Relation: {child.relationship}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#8EA1B5" />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.noteStateCard}>
                    <Ionicons name="people-outline" size={18} color={PALETTE.muted} />
                    <Text style={styles.noteStateText}>No linked children found yet.</Text>
                  </View>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Account</Text>
                <ActionRow
                  icon="shield-checkmark-outline"
                  title="Terms & Privacy"
                  subtitle="Read the current privacy and usage policy"
                  onPress={handleTerms}
                />
                <ActionRow
                  icon="key-outline"
                  title="Change password"
                  subtitle="Update your account password"
                  onPress={() => setShowPasswordModal(true)}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Profile info</Text>
                <InfoRow label="Name" value={parentUser.name} />
                <InfoRow label="Username" value={parentUser.username ? usernameHandle : null} />
                <InfoRow label="Role" value="Parent" />
                <InfoRow label="Status" value={isOnline ? "Online" : "Offline"} />
                <InfoRow label="Children" value={`${children.length}`} />
                <InfoRow label="Phone" value={parentUser.phone} />
                <InfoRow label="Email" value={parentUser.email} />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Support</Text>
                <ActionRow
                  icon="paper-plane-outline"
                  title="Telegram"
                  subtitle="Chat with the Gojo team on Telegram"
                  onPress={() => Linking.openURL("https://t.me/gojo_edu")}
                />
                <ActionRow
                  icon="mail-outline"
                  title="Email"
                  subtitle="Send us a message by email"
                  onPress={() => Linking.openURL("mailto:gojo.education1@gmail.com")}
                />
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showPasswordModal} transparent animationType="slide" onRequestClose={handleClosePasswordModal}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Password</Text>
                <TouchableOpacity onPress={handleClosePasswordModal}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                <Field
                  label="Current Password"
                  value={currentPassword}
                  onChangeText={(text) => {
                    setCurrentPassword(text);
                    setCurrentPasswordError("");
                  }}
                  secureTextEntry
                  placeholder="Enter current password"
                  error={currentPasswordError}
                />

                <Field
                  label="New Password"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    setNewPasswordError("");
                    if (confirmPassword && text !== confirmPassword) {
                      setConfirmPasswordError("Passwords do not match");
                    } else {
                      setConfirmPasswordError("");
                    }
                  }}
                  secureTextEntry
                  placeholder="Enter new password (min 6 characters)"
                  error={newPasswordError}
                />

                <Field
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (newPassword && text !== newPassword) {
                      setConfirmPasswordError("Passwords do not match");
                    } else {
                      setConfirmPasswordError("");
                    }
                  }}
                  secureTextEntry
                  placeholder="Confirm new password"
                  error={confirmPasswordError}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={handleClosePasswordModal}
                  disabled={isChangingPassword}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleChangePassword}
                  disabled={isChangingPassword}
                >
                  <Text style={styles.confirmButtonText}>{isChangingPassword ? "Saving..." : "Save"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function SectionHeader({ title, icon }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={16} color={PALETTE.accentDark} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.quickActionItem} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={18} color={PALETTE.accentDark} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function MiniPill({ icon, text, compact = false }) {
  return (
    <View style={[styles.miniPill, compact && styles.miniPillCompact]}>
      <Ionicons name={icon} size={compact ? 10 : 13} color={compact ? PALETTE.accent : "#F8FAFC"} />
      <Text style={[styles.miniPillText, compact && styles.miniPillTextCompact]}>{text}</Text>
    </View>
  );
}

function ActionRow({ icon, title, subtitle, onPress, destructive = false }) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.8}>
      <View
        style={[
          styles.iconWrap,
          destructive ? styles.iconWrapDanger : null,
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={destructive ? PALETTE.danger : PALETTE.accent}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionTitle, destructive ? styles.actionTitleDanger : null]}>{title}</Text>
        <Text numberOfLines={1} style={styles.actionSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={PALETTE.muted} />
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry, error }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.textInput, error ? styles.errorInput : null]}
        secureTextEntry={secureTextEntry}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#93A4B7"
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.background },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: PALETTE.background,
  },
  loadingText: {
    marginTop: 10,
    color: PALETTE.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  loadingTitle: {
    marginTop: 12,
    color: PALETTE.text,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyBackBtn: {
    marginTop: 18,
    backgroundColor: PALETTE.accent,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
  },
  emptyBackText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: "700",
  },

  heroCard: {
    marginHorizontal: -14,
    backgroundColor: PALETTE.card,
    marginBottom: 4,
    overflow: "hidden",
  },
  heroBanner: {
    backgroundColor: PALETTE.white,
    position: "relative",
    overflow: "hidden",
  },
  heroBannerFallback: {
    flex: 1,
    backgroundColor: PALETTE.white,
    overflow: "hidden",
  },
  heroBannerOrbPrimary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(34,150,243,0.08)",
    top: -40,
    right: -20,
  },
  heroBannerOrbSecondary: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(34,150,243,0.04)",
    bottom: -60,
    left: -20,
  },
  heroBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  heroTopBar: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTopActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroTopIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroQuickStats: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  miniPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  miniPillCompact: {
    backgroundColor: PALETTE.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderColor: PALETTE.border,
  },
  miniPillText: {
    marginLeft: 5,
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "700",
  },
  miniPillTextCompact: {
    marginLeft: 3,
    fontSize: 9,
    color: PALETTE.accent,
  },
  heroAvatarSlot: {
    paddingHorizontal: 18,
    marginTop: -44,
  },
  avatarWrap: {
    position: "relative",
    alignSelf: "flex-start",
  },
  heroIdentityBlock: {
    marginTop: -6,
    marginHorizontal: 14,
    paddingHorizontal: 4,
    paddingVertical: 2,
    paddingBottom: 14,
  },
  identityTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  name: {
    fontSize: 21,
    fontWeight: "800",
    color: PALETTE.text,
  },
  subRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  subText: {
    fontSize: 11,
    color: PALETTE.muted,
    fontWeight: "600",
    marginRight: 2,
  },
  editProfileBtn: {
    marginTop: 10,
    width: "100%",
    backgroundColor: "#5865F2",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  editProfileText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: "700",
  },
  profileFilterRow: {
    flexDirection: "row",
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 12,
    padding: 4,
    marginTop: 10,
  },
  profileFilterBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  profileFilterBtnActive: {
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.accent,
  },
  profileFilterText: {
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  profileFilterTextActive: {
    color: PALETTE.text,
  },

  topActionsRow: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 40,
    zIndex: 150,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowColor: "#BED3EE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  topActionSpacer: {
    flex: 1,
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: PALETTE.white,
    zIndex: 10,
    overflow: "hidden",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomWidth: 1,
    borderColor: "#E7EEFF",
  },
  headerBgFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
  },
  headerOrbPrimary: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(34,150,243,0.08)",
    top: -72,
    right: -36,
  },
  headerOrbSecondary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(34,150,243,0.05)",
    bottom: -72,
    left: -30,
  },
  headerAccentStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 116,
    backgroundColor: "#F6FAFF",
  },

  heroWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    flexDirection: "column",
    alignItems: "flex-start",
  },

  photoCard: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "visible",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: "#fff",
    shadowColor: "#BED3EE",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  photoCardImageClip: {
    width: "100%",
    height: "100%",
    borderRadius: 44,
    overflow: "hidden",
  },
  photoCardImage: {
    width: "100%",
    height: "100%",
  },
  photoCardCamera: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  identitySide: {
    width: "100%",
    marginTop: 12,
  },
  identityCard: {
    width: "100%",
    backgroundColor: "transparent",
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  identityName: {
    color: PALETTE.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  identityUsername: {
    color: PALETTE.muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  identityMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 8,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PALETTE.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  metaPillOnline: {
    backgroundColor: "#ECFDF3",
    borderColor: "#CFF7E0",
  },
  metaPillOffline: {
    backgroundColor: "#F8FAFC",
  },
  metaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  metaPillText: {
    marginLeft: 6,
    color: PALETTE.accentDark,
    fontSize: 11,
    fontWeight: "700",
  },
  metaPillTextOnline: {
    color: "#0F766E",
  },
  metaPillTextOffline: {
    color: PALETTE.muted,
  },
  heroEditBtn: {
    marginTop: 12,
    width: "100%",
    backgroundColor: PALETTE.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEditText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: "700",
  },

  contentWrap: {
    paddingHorizontal: 14,
    gap: 4,
  },

  quickActions: {
    backgroundColor: "#FCFEFF",
    borderWidth: 1,
    borderColor: "#E7EEFF",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    shadowColor: "#BED3EE",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  quickActionItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7FAFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E7EEFF",
    paddingVertical: 10,
  },
  quickActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: PALETTE.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#33506D",
  },

  card: {
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PALETTE.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: PALETTE.text,
    marginBottom: 10,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 16,
    backgroundColor: PALETTE.card,
    marginBottom: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: PALETTE.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  iconWrapDanger: {
    backgroundColor: "#FEECEC",
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: PALETTE.text,
  },
  actionTitleDanger: {
    color: PALETTE.danger,
  },
  actionSub: {
    fontSize: 12,
    color: PALETTE.muted,
    marginTop: 2,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EFF4FA",
  },
  infoLabel: {
    color: PALETTE.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  infoValue: {
    color: PALETTE.text,
    fontSize: 13,
    fontWeight: "700",
    maxWidth: "64%",
    textAlign: "right",
  },

  childCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    padding: 13,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAF0F8",
    shadowColor: "#D9E7F6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  childImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  childBody: { flex: 1, marginLeft: 12 },
  childName: {
    fontSize: 15,
    fontWeight: "700",
    color: PALETTE.text,
  },
  childMeta: {
    fontSize: 12.5,
    color: PALETTE.muted,
    marginTop: 2,
  },

  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAF0F8",
    marginBottom: 10,
  },
  accountItemNoBorder: {
    marginBottom: 0,
  },
  accountIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  accountText: {
    fontSize: 15,
    marginLeft: 11,
    flex: 1,
    color: PALETTE.text,
    fontWeight: "650",
  },

  noteStateCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: "#F8FBFF",
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  noteStateText: {
    marginTop: 8,
    fontSize: 12,
    color: PALETTE.muted,
    fontWeight: "600",
  },

  dropdownMenu: {
    position: "absolute",
    right: 10,
    backgroundColor: PALETTE.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    zIndex: 1000,
    minWidth: 205,
    overflow: "hidden",
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
    borderBottomColor: "#F1F5F9",
  },
  menuItemNoBorder: { borderBottomWidth: 0 },
  menuText: {
    fontSize: 15,
    color: PALETTE.text,
    fontWeight: "600",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.35)",
    justifyContent: "center",
    padding: 14,
  },
  modalContainer: {
    backgroundColor: PALETTE.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: PALETTE.text,
  },
  modalContent: { padding: 16 },

  inputGroup: { marginBottom: 14 },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 7,
  },
  textInput: {
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#F8FBFF",
    color: PALETTE.text,
  },
  errorInput: {
    borderColor: "#DC2626",
    borderWidth: 1.5,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },

  modalActions: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  confirmButton: { backgroundColor: PALETTE.accent },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: PALETTE.muted,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});