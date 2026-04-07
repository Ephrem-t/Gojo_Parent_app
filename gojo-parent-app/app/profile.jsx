import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  Alert,
  TextInput,
  Modal,
  Linking,
  ActivityIndicator,
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
import { useParentTheme } from "../hooks/use-parent-theme";
const makePalette = (colors, isDark) => ({
  background: colors.background,
  card: colors.card,
  cardMuted: colors.cardMuted,
  surfaceMuted: colors.surfaceMuted,
  inputBackground: colors.inputBackground,
  accent: colors.primary,
  accentDark: colors.primaryDark,
  accentSoft: colors.primarySoft,
  text: colors.text,
  subtext: colors.mutedAlt,
  muted: colors.muted,
  border: colors.border,
  borderSoft: colors.borderSoft,
  line: colors.line,
  white: colors.white,
  danger: colors.danger,
  dangerSoft: colors.dangerSoft,
  success: colors.success,
  successSoft: colors.successSoft,
  offline: colors.offline,
  overlay: colors.overlay,
  heroSurface: colors.heroSurface,
  heroBannerTint: colors.heroBannerTint,
  heroOrbPrimary: colors.heroOrbPrimary,
  heroOrbSecondary: colors.heroOrbSecondary,
  heroTopButton: colors.heroTopButton,
  heroTopBorder: colors.heroTopBorder,
  heroPillBg: colors.heroPillBg,
  heroPillBorder: colors.heroPillBorder,
  heroPillText: colors.heroPillText,
  heroSubtleText: colors.heroSubtleText,
  shadowBlue: isDark ? "#000000" : "#BED3EE",
  shadowSoft: isDark ? "#000000" : "#D9E7F6",
  topIconSurface: isDark ? colors.cardMuted : "rgba(255,255,255,0.96)",
  purpleAction: isDark ? colors.primary : "#5865F2",
  onlineBorder: isDark ? "#14532D" : "#CFF7E0",
  onlineText: isDark ? "#6EE7B7" : "#0F766E",
  error: isDark ? "#F87171" : "#DC2626",
});

function useProfileThemeConfig() {
  const { colors, isDark, statusBarStyle, toggleTheme } = useParentTheme();

  const PALETTE = useMemo(() => makePalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(PALETTE), [PALETTE]);

  return { PALETTE, styles, isDark, statusBarStyle, toggleTheme };
}

const TERMS_URL = "https://example.com/terms";

export default function ParentProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { PALETTE, styles, isDark, statusBarStyle, toggleTheme } = useProfileThemeConfig();

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
  const [showEditModal, setShowEditModal] = useState(false);

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
    setShowEditModal(false);
    router.push("/editMyInfo");
  };

  const handleDarkModePress = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);

  const handleImagePicker = async () => {
    try {
      setShowMenu(false);
      setShowEditModal(false);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const openEditModal = useCallback(() => {
    setShowMenu(false);
    setShowEditModal(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setShowEditModal(false);
  }, []);

  const openPasswordModalFromActions = useCallback(() => {
    setShowMenu(false);
    setShowEditModal(false);
    setShowPasswordModal(true);
  }, []);

  const pullY = scrollY.interpolate({
    inputRange: [-220, 0],
    outputRange: [220, 0],
    extrapolate: "clamp",
  });

  const stretchHeight = pullY.interpolate({
    inputRange: [0, 220],
    outputRange: [0, 300],
    extrapolate: "clamp",
  });

  const stretchOpacity = pullY.interpolate({
    inputRange: [0, 30, 220],
    outputRange: [0, 0.35, 1],
    extrapolate: "clamp",
  });

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
  const joinedDate = parentUser.createdAt
    ? new Date(parentUser.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recently joined";

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle={statusBarStyle} />

      <Animated.View
        style={[
          styles.stretchContainer,
          {
            height: stretchHeight,
            opacity: stretchOpacity,
            pointerEvents: "none",
          },
        ]}
      >
        <View style={styles.stretchFill} />
      </Animated.View>

      {showMenu && (
        <>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)} />
          <View style={[styles.dropdownMenu, { top: insets.top + 52 }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEditInfo}>
              <Text style={styles.menuText}>Edit Info</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleImagePicker}>
              <Text style={styles.menuText}>Change Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={openPasswordModalFromActions}>
              <Text style={styles.menuText}>Change Password</Text>
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

      <Animated.ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(88, insets.bottom + 64) },
        ]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
        bounces
        showsVerticalScrollIndicator={false}
      >
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

                  <TouchableOpacity
                    style={[styles.heroTopIconBtn, styles.heroTopIconBtnSpacing]}
                    onPress={handleDarkModePress}
                    activeOpacity={0.88}
                  >
                    <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={17} color={PALETTE.white} />
                  </TouchableOpacity>

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

              <TouchableOpacity style={styles.editProfileBtn} onPress={openEditModal} activeOpacity={0.88}>
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
              <Text style={styles.sectionTitle}>Family overview</Text>

              <TouchableOpacity style={styles.featureCard} activeOpacity={0.9} onPress={openEditModal}>
                <View style={styles.featureTop}>
                  <View style={styles.featureIconWrap}>
                    <Ionicons name="people-outline" size={18} color={PALETTE.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureTitle}>Parent account</Text>
                    <Text numberOfLines={1} style={styles.featureSub}>
                      {children.length
                        ? `${children.length} linked ${children.length === 1 ? "child" : "children"} • ${joinedDate}`
                        : `No linked children yet • ${joinedDate}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={PALETTE.muted} />
                </View>
              </TouchableOpacity>

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
                      <View style={styles.childTopRow}>
                        <Text style={styles.childName}>{child.name}</Text>
                        <View style={styles.childRolePill}>
                          <Text style={styles.childRoleText}>{child.relationship || "Child"}</Text>
                        </View>
                      </View>
                      <Text style={styles.childMeta}>
                        Grade {child.grade || "--"} • Section {child.section || "--"}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={PALETTE.muted} />
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
          </>
        )}
      </Animated.ScrollView>

      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <TouchableOpacity style={styles.editOptionBtn} onPress={handleEditInfo} activeOpacity={0.88}>
              <Ionicons name="create-outline" size={18} color={PALETTE.text} />
              <Text style={styles.editOptionText}>Edit Info</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.editOptionBtn} onPress={handleImagePicker} activeOpacity={0.88}>
              <Ionicons name="image-outline" size={18} color={PALETTE.text} />
              <Text style={styles.editOptionText}>Change Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.editOptionBtn} onPress={openPasswordModalFromActions} activeOpacity={0.88}>
              <Ionicons name="key-outline" size={18} color={PALETTE.text} />
              <Text style={styles.editOptionText}>Change Password</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.editOptionBtn, styles.editOptionCancel]}
              onPress={closeEditModal}
              activeOpacity={0.88}
            >
              <Ionicons name="close-outline" size={18} color={PALETTE.muted} />
              <Text style={[styles.editOptionText, styles.editOptionCancelText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={handleClosePasswordModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Change Password</Text>

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
        </View>
      </Modal>
    </View>
  );
}

function MiniPill({ icon, text, compact = false }) {
  const { PALETTE, styles } = useProfileThemeConfig();

  return (
    <View style={[styles.miniPill, compact && styles.miniPillCompact]}>
      <Ionicons name={icon} size={compact ? 10 : 13} color={compact ? PALETTE.accent : "#F8FAFC"} />
      <Text style={[styles.miniPillText, compact && styles.miniPillTextCompact]}>{text}</Text>
    </View>
  );
}

function ActionRow({ icon, title, subtitle, onPress, destructive = false }) {
  const { PALETTE, styles } = useProfileThemeConfig();

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
  const { styles } = useProfileThemeConfig();

  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry, error }) {
  const { styles } = useProfileThemeConfig();

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

const createStyles = (PALETTE) => StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.background },
  scroll: { padding: 14, paddingBottom: 28, paddingTop: 0 },

  stretchContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: "hidden",
    backgroundColor: PALETTE.accentSoft,
  },
  stretchFill: {
    flex: 1,
    backgroundColor: PALETTE.heroSurface,
  },

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
    marginTop: 0,
    marginHorizontal: -14,
    backgroundColor: PALETTE.card,
    borderRadius: 0,
    marginBottom: 12,
    zIndex: 3,
    borderWidth: 0,
    overflow: "hidden",
  },
  heroBanner: {
    backgroundColor: PALETTE.heroSurface,
    position: "relative",
    overflow: "hidden",
  },
  heroBannerFallback: {
    flex: 1,
    backgroundColor: PALETTE.heroSurface,
    overflow: "hidden",
  },
  heroBannerOrbPrimary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: PALETTE.heroOrbPrimary,
    top: -40,
    right: -20,
  },
  heroBannerOrbSecondary: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: PALETTE.heroOrbSecondary,
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
  heroTopIconBtnSpacing: {
    marginRight: 8,
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
    color: PALETTE.heroPillText,
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
    paddingBottom: 0,
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
    backgroundColor: PALETTE.purpleAction,
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
    backgroundColor: PALETTE.inputBackground,
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
    backgroundColor: PALETTE.topIconSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowColor: PALETTE.shadowBlue,
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
    backgroundColor: PALETTE.heroSurface,
    zIndex: 10,
    overflow: "hidden",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomWidth: 1,
    borderColor: PALETTE.borderSoft,
  },
  headerBgFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PALETTE.heroSurface,
  },
  headerOrbPrimary: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: PALETTE.heroOrbPrimary,
    top: -72,
    right: -36,
  },
  headerOrbSecondary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: PALETTE.heroOrbSecondary,
    bottom: -72,
    left: -30,
  },
  headerAccentStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 116,
    backgroundColor: PALETTE.heroBannerTint,
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
    borderColor: PALETTE.white,
    backgroundColor: PALETTE.card,
    shadowColor: PALETTE.shadowBlue,
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
    borderColor: PALETTE.heroSurface,
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
    backgroundColor: PALETTE.successSoft,
    borderColor: PALETTE.onlineBorder,
  },
  metaPillOffline: {
    backgroundColor: PALETTE.surfaceMuted,
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
    color: PALETTE.onlineText,
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
    flex: 1,
    paddingHorizontal: 14,
    gap: 4,
  },
  sectionScroll: {
    flex: 1,
  },
  sectionScrollContent: {
    gap: 4,
  },

  quickActions: {
    backgroundColor: PALETTE.cardMuted,
    borderWidth: 1,
    borderColor: PALETTE.borderSoft,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    shadowColor: PALETTE.shadowBlue,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  quickActionItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PALETTE.inputBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.borderSoft,
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
    color: PALETTE.text,
  },

  card: {
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
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

  featureCard: {
    backgroundColor: PALETTE.inputBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 14,
    marginBottom: 12,
  },
  featureTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: PALETTE.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: PALETTE.text,
  },
  featureSub: {
    marginTop: 2,
    fontSize: 12,
    color: PALETTE.muted,
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
    borderBottomColor: PALETTE.line,
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
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: PALETTE.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    marginTop: 6,
    shadowColor: PALETTE.shadowBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  childImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  childBody: { flex: 1, marginLeft: 10 },
  childTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  childName: {
    fontSize: 14,
    fontWeight: "700",
    color: PALETTE.text,
  },
  childRolePill: {
    backgroundColor: PALETTE.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  childRoleText: {
    color: PALETTE.accent,
    fontSize: 10,
    fontWeight: "800",
  },
  childMeta: {
    fontSize: 11.5,
    color: PALETTE.muted,
    marginTop: 1,
  },

  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
    backgroundColor: PALETTE.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.borderSoft,
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
    backgroundColor: PALETTE.inputBackground,
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
    borderBottomColor: PALETTE.line,
  },
  menuItemNoBorder: { borderBottomWidth: 0 },
  menuText: {
    fontSize: 15,
    color: PALETTE.text,
    fontWeight: "600",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: PALETTE.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    backgroundColor: PALETTE.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: PALETTE.text,
    marginBottom: 10,
  },

  inputGroup: { marginBottom: 14 },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: PALETTE.text,
    marginBottom: 7,
  },
  textInput: {
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: PALETTE.cardMuted,
    color: PALETTE.text,
  },
  errorInput: {
    borderColor: PALETTE.error,
    borderWidth: 1.5,
  },
  errorText: {
    color: PALETTE.error,
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 8,
  },
  modalButton: {
    minWidth: 90,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: PALETTE.surfaceMuted,
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

  editOptionBtn: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.inputBackground,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  editOptionText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "700",
    color: PALETTE.text,
  },
  editOptionCancel: {
    marginBottom: 0,
    backgroundColor: PALETTE.surfaceMuted,
  },
  editOptionCancelText: {
    color: PALETTE.muted,
  },
});