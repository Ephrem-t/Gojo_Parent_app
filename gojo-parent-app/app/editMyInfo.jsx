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
import { readCachedJsonRecord, writeCachedJson } from "./lib/dataCache";
import { isInternetReachableNow } from "./lib/networkGuard";
import { EditProfileScreenSkeleton } from "../components/ui/AppSkeletons";
import { useParentTheme } from "../hooks/use-parent-theme";

const HEADER_MAX_HEIGHT = 210;
const HEADER_MIN_HEIGHT = 58;
const EDIT_MY_INFO_CACHE_TTL_MS = 30 * 60 * 1000;

function getEditMyInfoCacheKey(schoolKey, parentId) {
  return `cache:editMyInfo:${String(schoolKey || "root")}:${String(parentId || "unknown")}`;
}

function getProfileCacheKey(schoolKey, parentId) {
  return `cache:profile:${String(schoolKey || "root")}:${String(parentId || "unknown")}`;
}

const makePalette = (colors, isDark) => ({
  primary: colors.primary,
  primaryDark: colors.primaryDark,
  primarySoft: colors.primarySoft,
  background: colors.background,
  card: colors.card,
  text: colors.text,
  muted: colors.muted,
  mutedAlt: colors.mutedAlt,
  border: colors.border,
  overlayButton: colors.heroTopButtonAlt,
  white: colors.white,
  noticeBg: colors.infoSurface,
  noticeBorder: colors.infoBorder,
  noticeText: colors.primaryDark,
  cardShadow: isDark ? "#000000" : "#0F172A",
  cardBorderOnHero: colors.heroTopBorder,
  inputBg: colors.inputBackground,
  inputDisabledBg: colors.surfaceMuted,
});

function useEditMyInfoThemeConfig() {
  const { colors, isDark, amharic, oromo } = useParentTheme();

  const palette = useMemo(() => makePalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(palette), [palette]);

  return { palette, styles, amharic, oromo };
}

function getEditMyInfoLabels(amharic, oromo) {
  if (oromo) {
    return {
      errorTitle: "Dogoggora",
      validationTitle: "Mirkaneessa",
      successTitle: "Milkaa'e",
      userNotFound: "Fayyadamaan hin argamne",
      parentDataNotFound: "Odeeffannoon maatii hin argamne",
      userIdNotFound: "User ID hin argamne",
      userProfileNotFound: "Profaayiliin fayyadamaa hin argamne",
      failedToLoad: "Odeeffannoo kee fe'uu hin dandeenye",
      failedToSave: "Odeeffannoo kee kuusuu hin dandeenye",
      ageValidation: "Umriin lakkoofsa (digit 1-3) ta'uu qaba.",
      saveSuccess: "Odeeffannoon kee milkaa'inaan haaromfameera.",
      loadingProfile: "Profaayilii kee fe'aa jira...",
      screenTitle: "Odeeffannoo Koo Gulaali",
      save: "Kaa'i",
      heroTitle: "Odeeffannoo Koo Gulaali",
      heroSub: "Dirreewwan sirreessuu dandeessu haaromsi; kan eegaman ni tursiifamu.",
      secureEditing: "Gulaallii profaayilii nageenya qabu",
      notice: "Maqaa, Email, Lakkoofsa Bilbilaa fi Username jijjiiramuu hin danda'an.",
      protectedInformation: "Odeeffannoo eegame",
      editableDetails: "Odeeffannoo gulaalamuu danda'u",
      name: "Maqaa",
      email: "Email",
      phoneNumber: "Lakkoofsa Bilbilaa",
      username: "Maqaa fayyadamaa",
      jobOccupation: "Hojii / Ogummaa",
      enterJob: "Hojii yookaan ogummaa galchi",
      age: "Umurii",
      enterAge: "Umurii galchi",
      city: "Magaalaa",
      enterCity: "Magaalaa galchi",
      citizenship: "Lammummaa",
      enterCitizenship: "Lammummaa galchi",
      address: "Teessoo",
      enterFullAddress: "Teessoo guutuu galchi",
      bio: "Waa'ee kee",
      tellAboutYourself: "Waa'ee kee gabaabinaan barreessi",
    };
  }

  if (amharic) {
    return {
      errorTitle: "ስህተት",
      validationTitle: "ማረጋገጫ",
      successTitle: "ተሳክቷል",
      userNotFound: "ተጠቃሚው አልተገኘም",
      parentDataNotFound: "የወላጅ መረጃ አልተገኘም",
      userIdNotFound: "የተጠቃሚ መለያ አልተገኘም",
      userProfileNotFound: "የተጠቃሚ መገለጫ አልተገኘም",
      failedToLoad: "መረጃዎን መጫን አልተቻለም",
      failedToSave: "መረጃዎን ማስቀመጥ አልተቻለም",
      ageValidation: "ዕድሜ ቁጥር መሆን አለበት (1-3 አሃዝ).",
      saveSuccess: "መረጃዎ በተሳካ ሁኔታ ተዘምኗል።",
      loadingProfile: "መገለጫዎ በመጫን ላይ...",
      screenTitle: "መረጃዬን አርትዕ",
      save: "አስቀምጥ",
      heroTitle: "መረጃዬን አርትዕ",
      heroSub: "የተጠበቁ መረጃዎች ደህንነታቸውን ሲጠብቁ የሚስተካከሉ ዝርዝሮችዎን ያዘምኑ።",
      secureEditing: "የተጠበቀ የመገለጫ ማስተካከያ",
      notice: "ስም፣ ኢሜይል፣ ስልክ ቁጥር እና የተጠቃሚ ስም የተጠበቁ ስለሆኑ ሊቀየሩ አይችሉም።",
      protectedInformation: "የተጠበቀ መረጃ",
      editableDetails: "ሊስተካከሉ የሚችሉ ዝርዝሮች",
      name: "ስም",
      email: "ኢሜይል",
      phoneNumber: "ስልክ ቁጥር",
      username: "የተጠቃሚ ስም",
      jobOccupation: "ስራ / ሙያ",
      enterJob: "ስራዎን ወይም ሙያዎን ያስገቡ",
      age: "ዕድሜ",
      enterAge: "ዕድሜ ያስገቡ",
      city: "ከተማ",
      enterCity: "ከተማ ያስገቡ",
      citizenship: "ዜግነት",
      enterCitizenship: "ዜግነት ያስገቡ",
      address: "አድራሻ",
      enterFullAddress: "ሙሉ አድራሻ ያስገቡ",
      bio: "ስለ እርስዎ",
      tellAboutYourself: "ስለ እርስዎ አጭር መረጃ ያስገቡ",
    };
  }

  return {
    errorTitle: "Error",
    validationTitle: "Validation",
    successTitle: "Success",
    userNotFound: "User not found",
    parentDataNotFound: "Parent data not found",
    userIdNotFound: "User ID not found",
    userProfileNotFound: "User profile not found",
    failedToLoad: "Failed to load your information",
    failedToSave: "Failed to save your information",
    ageValidation: "Age must be a number (1-3 digits).",
    saveSuccess: "Your information has been updated successfully.",
    loadingProfile: "Loading your profile...",
    screenTitle: "Edit My Info",
    save: "Save",
    heroTitle: "Edit My Info",
    heroSub: "Update your editable profile details while protected fields stay secure.",
    secureEditing: "Secure profile editing",
    notice: "Name, Email, Phone Number, and Username are protected and cannot be changed.",
    protectedInformation: "Protected Information",
    editableDetails: "Editable Details",
    name: "Name",
    email: "Email",
    phoneNumber: "Phone Number",
    username: "Username",
    jobOccupation: "Job / Occupation",
    enterJob: "Enter job or occupation",
    age: "Age",
    enterAge: "Enter age",
    city: "City",
    enterCity: "Enter city",
    citizenship: "Citizenship",
    enterCitizenship: "Enter citizenship",
    address: "Address",
    enterFullAddress: "Enter full address",
    bio: "Bio",
    tellAboutYourself: "Tell us about yourself",
  };
}

export default function EditMyInfo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { palette, styles, amharic, oromo } = useEditMyInfoThemeConfig();
  const labels = useMemo(() => getEditMyInfoLabels(amharic, oromo), [amharic, oromo]);

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

        const cacheKey = getEditMyInfoCacheKey(sk, pid);
        const cachedInfoRecord = await readCachedJsonRecord(cacheKey);
        const cachedInfo = cachedInfoRecord?.value || null;
        const cacheFresh = cachedInfoRecord
          ? Date.now() - cachedInfoRecord.savedAt <= EDIT_MY_INFO_CACHE_TTL_MS
          : false;

        if (cachedInfo && typeof cachedInfo === "object") {
          setUserId(cachedInfo.userId || null);
          setUserInfo((prev) => ({
            ...prev,
            ...(cachedInfo.userInfo || {}),
          }));
          setLoading(false);

          if (cacheFresh) {
            return;
          }
        }

        if (!pid) {
          Alert.alert(labels.errorTitle, labels.userNotFound);
          handleBack();
          return;
        }

        const onlineNow = await isInternetReachableNow();
        if (!onlineNow) {
          setLoading(false);
          return;
        }

        const pathPrefix = sk ? `Platform1/Schools/${sk}/` : "";

        const parentSnap = await get(ref(database, `${pathPrefix}Parents/${pid}`));
        if (!parentSnap.exists()) {
          Alert.alert(labels.errorTitle, labels.parentDataNotFound);
          handleBack();
          return;
        }

        const parentData = parentSnap.val() || {};
        if (!parentData.userId) {
          Alert.alert(labels.errorTitle, labels.userIdNotFound);
          handleBack();
          return;
        }

        setUserId(parentData.userId);

        const userSnap = await get(ref(database, `${pathPrefix}Users/${parentData.userId}`));
        if (!userSnap.exists()) {
          Alert.alert(labels.errorTitle, labels.userProfileNotFound);
          handleBack();
          return;
        }

        const userData = userSnap.val() || {};

        const nextUserInfo = {
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
        };

        setUserInfo(nextUserInfo);
        writeCachedJson(cacheKey, {
          userId: parentData.userId,
          userInfo: nextUserInfo,
          fetchedAt: Date.now(),
        }).catch(() => {});
      } catch (e) {
        console.error("load profile error:", e);
        Alert.alert(labels.errorTitle, labels.failedToLoad);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [handleBack, labels]);

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
      Alert.alert(labels.errorTitle, labels.userNotFound);
      return;
    }

    if (editablePayload.age && !/^\d{1,3}$/.test(editablePayload.age)) {
      Alert.alert(labels.validationTitle, labels.ageValidation);
      return;
    }

    setSaving(true);
    try {
      await update(ref(database, `${schoolAwarePath("Users")}/${userId}`), editablePayload);
      const nextUserInfo = {
        ...userInfo,
        ...editablePayload,
        age: editablePayload.age,
      };

      await writeCachedJson(getEditMyInfoCacheKey(schoolKey, parentId), {
        userId,
        userInfo: nextUserInfo,
        fetchedAt: Date.now(),
      });

      const existingProfileCacheRecord = await readCachedJsonRecord(getProfileCacheKey(schoolKey, parentId));
      const existingProfileCache = existingProfileCacheRecord?.value || null;

      if (existingProfileCache && typeof existingProfileCache === "object") {
        await writeCachedJson(getProfileCacheKey(schoolKey, parentId), {
          ...existingProfileCache,
          parentUser: {
            ...(existingProfileCache.parentUser || {}),
            ...editablePayload,
          },
          fetchedAt: Date.now(),
        });
      }

      Alert.alert(labels.successTitle, labels.saveSuccess);
      handleBack();
    } catch (e) {
      console.error("save profile error:", e);
      Alert.alert(labels.errorTitle, labels.failedToSave);
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
    return <EditProfileScreenSkeleton />;
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={[styles.topActionsRow, { top: insets.top + 6 }]}>
        <TouchableOpacity style={styles.topIcon} onPress={handleBack}>
          <Ionicons name="arrow-back" size={21} color={palette.white} />
        </TouchableOpacity>

        <Animated.View style={[styles.compactCenter, { opacity: compactBarOpacity }]}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {labels.screenTitle}
          </Text>
        </Animated.View>

        <TouchableOpacity
          style={[styles.saveButtonTop, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={15} color={palette.white} style={{ marginRight: 4 }} />
              <Text style={styles.saveButtonText}>{labels.save}</Text>
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
              <Ionicons name="create-outline" size={28} color={palette.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{labels.heroTitle}</Text>
              <Text style={styles.heroSub}>
                {labels.heroSub}
              </Text>

              <View style={styles.statusChip}>
                <Ionicons name="shield-checkmark-outline" size={14} color={palette.primary} />
                <Text style={styles.statusText}>{labels.secureEditing}</Text>
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
            <Ionicons name="lock-closed-outline" size={16} color={palette.primaryDark} />
            <Text style={styles.noticeText}>{labels.notice}</Text>
          </View>

          <View style={styles.card}>
            <SectionHeader title={labels.protectedInformation} icon="shield-outline" />

            <InputField label={labels.name} value={userInfo.name} editable={false} />
            <InputField label={labels.email} value={userInfo.email} editable={false} />
            <InputField label={labels.phoneNumber} value={userInfo.phone} editable={false} />
            <InputField label={labels.username} value={userInfo.username} editable={false} />
          </View>

          <View style={styles.card}>
            <SectionHeader title={labels.editableDetails} icon="create-outline" />

            <InputField
              label={labels.jobOccupation}
              value={userInfo.job}
              onChangeText={(v) => updateField("job", v)}
              placeholder={labels.enterJob}
            />

            <InputField
              label={labels.age}
              value={userInfo.age}
              onChangeText={(v) => updateField("age", v.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              maxLength={3}
              placeholder={labels.enterAge}
            />

            <InputField
              label={labels.city}
              value={userInfo.city}
              onChangeText={(v) => updateField("city", v)}
              placeholder={labels.enterCity}
            />

            <InputField
              label={labels.citizenship}
              value={userInfo.citizenship}
              onChangeText={(v) => updateField("citizenship", v)}
              placeholder={labels.enterCitizenship}
            />

            <InputField
              label={labels.address}
              value={userInfo.address}
              onChangeText={(v) => updateField("address", v)}
              placeholder={labels.enterFullAddress}
              multiline
              numberOfLines={4}
            />

            <InputField
              label={labels.bio}
              value={userInfo.bio}
              onChangeText={(v) => updateField("bio", v)}
              placeholder={labels.tellAboutYourself}
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
  const { palette, styles } = useEditMyInfoThemeConfig();

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={16} color={palette.primaryDark} />
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
  const { palette, styles } = useEditMyInfoThemeConfig();

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
        placeholderTextColor={palette.muted}
      />
    </View>
  );
}

const createStyles = (palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: palette.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: palette.muted,
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
    backgroundColor: palette.overlayButton,
  },
  compactCenter: {
    position: "absolute",
    left: 56,
    right: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  compactTitle: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "800",
  },
  saveButtonTop: {
    minWidth: 78,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.overlayButton,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    flexDirection: "row",
  },
  saveButtonText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: "800",
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.primary,
    zIndex: 10,
    overflow: "hidden",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.primary,
  },
  heroWrap: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
  },
  heroCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.cardBorderOnHero,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: palette.text,
  },
  heroSub: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 3,
    lineHeight: 18,
    fontWeight: "500",
  },
  statusChip: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: palette.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.primary,
    marginLeft: 6,
  },

  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: palette.noticeBg,
    borderWidth: 1,
    borderColor: palette.noticeBorder,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  noticeText: {
    marginLeft: 8,
    flex: 1,
    color: palette.noticeText,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },

  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: palette.cardShadow,
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
    backgroundColor: palette.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.text,
  },

  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.mutedAlt,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.inputBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: palette.text,
  },
  inputDisabled: {
    backgroundColor: palette.inputDisabledBg,
    color: palette.muted,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
    paddingTop: 12,
  },
});