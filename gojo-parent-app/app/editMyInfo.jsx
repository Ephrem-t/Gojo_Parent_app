import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get, update } from "firebase/database";
import { database } from "../constants/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#2563EB";
const PRIMARY_DARK = "#1D4ED8";
const PRIMARY_SOFT = "#EFF6FF";
const BG = "#FFFFFF";
const CARD = "#FFFFFF";
const TEXT = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

const HEADER_MAX_HEIGHT = 210;
const HEADER_MIN_HEIGHT = 58;

export default function EditMyInfo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [schoolKey, setSchoolKey] = useState(null);
  const [parentId, setParentId] = useState(null);
  const [userId, setUserId] = useState(null);

  const [userInfo, setUserInfo] = useState({
    name: "",
    phone: "",
    email: "",
    username: "",
    job: "",
    age: "",
    city: "",
    citizenship: "",
    address: "",
    bio: "",
  });

  const schoolAwarePath = useCallback(
    (subPath) => (schoolKey ? `Platform1/Schools/${schoolKey}/${subPath}` : subPath),
    [schoolKey]
  );

  const handleBack = useCallback(() => {
    if (router?.canGoBack && router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [pid, sk] = await Promise.all([
          AsyncStorage.getItem("parentId"),
          AsyncStorage.getItem("schoolKey"),
        ]);

        if (!mounted) return;

        setParentId(pid || null);
        setSchoolKey(sk || null);

        if (!pid) {
          Alert.alert("Error", "User not found");
          handleBack();
          return;
        }

        const pathPrefix = sk ? `Platform1/Schools/${sk}/` : "";

        const parentSnap = await get(ref(database, `${pathPrefix}Parents/${pid}`));
        if (!parentSnap.exists()) {
          Alert.alert("Error", "Parent data not found");
          handleBack();
          return;
        }

        const parentData = parentSnap.val() || {};
        if (!parentData.userId) {
          Alert.alert("Error", "User ID not found");
          handleBack();
          return;
        }

        setUserId(parentData.userId);

        const userSnap = await get(ref(database, `${pathPrefix}Users/${parentData.userId}`));
        if (!userSnap.exists()) {
          Alert.alert("Error", "User profile not found");
          handleBack();
          return;
        }

        const userData = userSnap.val() || {};

        setUserInfo({
          name: userData.name || "",
          phone: userData.phone || "",
          email: userData.email || "",
          username: userData.username || "",
          job: userData.job || "",
          age: userData.age ? String(userData.age) : "",
          city: userData.city || "",
          citizenship: userData.citizenship || "",
          address: userData.address || "",
          bio: userData.bio || "",
        });
      } catch (e) {
        console.error("load profile error:", e);
        Alert.alert("Error", "Failed to load your information");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [handleBack]);

  const updateField = (field, value) => {
    setUserInfo((prev) => ({ ...prev, [field]: value }));
  };

  const editablePayload = useMemo(
    () => ({
      job: (userInfo.job || "").trim(),
      age: (userInfo.age || "").trim(),
      city: (userInfo.city || "").trim(),
      citizenship: (userInfo.citizenship || "").trim(),
      address: (userInfo.address || "").trim(),
      bio: (userInfo.bio || "").trim(),
    }),
    [userInfo]
  );

  const handleSave = async () => {
    if (!userId || !parentId) {
      Alert.alert("Error", "User not found");
      return;
    }

    if (editablePayload.age && !/^\d{1,3}$/.test(editablePayload.age)) {
      Alert.alert("Validation", "Age must be a number (1-3 digits).");
      return;
    }

    setSaving(true);
    try {
      await update(ref(database, `${schoolAwarePath("Users")}/${userId}`), editablePayload);
      Alert.alert("Success", "Your information has been updated successfully.");
      handleBack();
    } catch (e) {
      console.error("save profile error:", e);
      Alert.alert("Error", "Failed to save your information");
    } finally {
      setSaving(false);
    }
  };

  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [HEADER_MAX_HEIGHT + insets.top, HEADER_MIN_HEIGHT + insets.top],
    extrapolate: "clamp",
  });

  const heroOpacity = scrollY.interpolate({
    inputRange: [0, 50, 100],
    outputRange: [1, 0.45, 0],
    extrapolate: "clamp",
  });

  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, 90],
    outputRange: [0, -18],
    extrapolate: "clamp",
  });

  const compactBarOpacity = scrollY.interpolate({
    inputRange: [0, 45, 85],
    outputRange: [0, 0.25, 1],
    extrapolate: "clamp",
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={[styles.topActionsRow, { top: insets.top + 6 }]}>
        <TouchableOpacity style={styles.topIcon} onPress={handleBack}>
          <Ionicons name="arrow-back" size={21} color="#fff" />
        </TouchableOpacity>

        <Animated.View style={[styles.compactCenter, { opacity: compactBarOpacity }]}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            Edit My Info
          </Text>
        </Animated.View>

        <TouchableOpacity
          style={[styles.saveButtonTop, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={15} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.saveButtonText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <View style={styles.headerOverlay} />

        <Animated.View
          style={[
            styles.heroWrap,
            {
              opacity: heroOpacity,
              transform: [{ translateY: heroTranslateY }],
            },
          ]}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="create-outline" size={28} color={PRIMARY} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Edit My Info</Text>
              <Text style={styles.heroSub}>
                Update your editable profile details while protected fields stay secure.
              </Text>

              <View style={styles.statusChip}>
                <Ionicons name="shield-checkmark-outline" size={14} color={PRIMARY} />
                <Text style={styles.statusText}>Secure profile editing</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 20 : 0}
      >
        <Animated.ScrollView
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          contentContainerStyle={{
            paddingTop: HEADER_MAX_HEIGHT + insets.top + 14,
            paddingHorizontal: 14,
            paddingBottom: 28 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.noticeCard}>
            <Ionicons name="lock-closed-outline" size={16} color={PRIMARY_DARK} />
            <Text style={styles.noticeText}>
              Name, Email, Phone Number, and Username are protected and cannot be changed.
            </Text>
          </View>

          <View style={styles.card}>
            <SectionHeader title="Protected Information" icon="shield-outline" />

            <InputField label="Name" value={userInfo.name} editable={false} />
            <InputField label="Email" value={userInfo.email} editable={false} />
            <InputField label="Phone Number" value={userInfo.phone} editable={false} />
            <InputField label="Username" value={userInfo.username} editable={false} />
          </View>

          <View style={styles.card}>
            <SectionHeader title="Editable Details" icon="create-outline" />

            <InputField
              label="Job / Occupation"
              value={userInfo.job}
              onChangeText={(v) => updateField("job", v)}
              placeholder="Enter job or occupation"
            />

            <InputField
              label="Age"
              value={userInfo.age}
              onChangeText={(v) => updateField("age", v.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              maxLength={3}
              placeholder="Enter age"
            />

            <InputField
              label="City"
              value={userInfo.city}
              onChangeText={(v) => updateField("city", v)}
              placeholder="Enter city"
            />

            <InputField
              label="Citizenship"
              value={userInfo.citizenship}
              onChangeText={(v) => updateField("citizenship", v)}
              placeholder="Enter citizenship"
            />

            <InputField
              label="Address"
              value={userInfo.address}
              onChangeText={(v) => updateField("address", v)}
              placeholder="Enter full address"
              multiline
              numberOfLines={4}
            />

            <InputField
              label="Bio"
              value={userInfo.bio}
              onChangeText={(v) => updateField("bio", v)}
              placeholder="Tell us about yourself"
              multiline
              numberOfLines={5}
            />
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function SectionHeader({ title, icon }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={16} color={PRIMARY_DARK} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  multiline = false,
  numberOfLines,
  keyboardType = "default",
  maxLength,
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.textArea,
          !editable && styles.inputDisabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={editable}
        selectTextOnFocus={editable}
        multiline={multiline}
        numberOfLines={numberOfLines}
        keyboardType={keyboardType}
        maxLength={maxLength}
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BG,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: MUTED,
    fontWeight: "600",
  },

  topActionsRow: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 40,
    zIndex: 200,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.20)",
  },
  compactCenter: {
    position: "absolute",
    left: 56,
    right: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  compactTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  saveButtonTop: {
    minWidth: 78,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    flexDirection: "row",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: PRIMARY,
    zIndex: 10,
    overflow: "hidden",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PRIMARY,
  },
  heroWrap: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
  },
  heroCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: TEXT,
  },
  heroSub: {
    fontSize: 13,
    color: MUTED,
    marginTop: 3,
    lineHeight: 18,
    fontWeight: "500",
  },
  statusChip: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: PRIMARY_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
    color: PRIMARY,
    marginLeft: 6,
  },

  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  noticeText: {
    marginLeft: 8,
    flex: 1,
    color: "#1E3A8A",
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },

  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: "rgba(15,23,42,0.04)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT,
  },

  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT,
  },
  inputDisabled: {
    backgroundColor: "#F1F5F9",
    color: "#64748B",
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
    paddingTop: 12,
  },
});