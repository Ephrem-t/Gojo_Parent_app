import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  Alert,
  TextInput,
  Modal,
  Linking,
  RefreshControl,
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
import { readCachedJsonRecord, writeCachedJson } from "./lib/dataCache";
import AppImage from "../components/ui/AppImage";
import { ProfileScreenSkeleton } from "../components/ui/AppSkeletons";
import { useParentTheme } from "../hooks/use-parent-theme";

function getProfileCacheKey(schoolKey, parentNodeId) {
  return `cache:profile:${String(schoolKey || "root")}:${String(parentNodeId || "unknown")}`;
}

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
  const { colors, isDark, statusBarStyle, toggleTheme, languageCode, amharic, setLanguageCode } = useParentTheme();

  const PALETTE = useMemo(() => makePalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(PALETTE), [PALETTE]);

  return { PALETTE, styles, isDark, statusBarStyle, toggleTheme, languageCode, amharic, setLanguageCode };
}

const TERMS_URL = "https://example.com/terms";

function getProfileLabels(languageCode) {
  const amharic = languageCode === "am";
  const oromo = languageCode === "om";
  const tigrinya = languageCode === "ti";

  if (tigrinya) {
    return {
      loadingProfile: "ፕሮፋይል ይጽዕን ኣሎ...",
      profileUnavailableTitle: "ፕሮፋይል ኣይተረኽበን",
      profileUnavailableBody: "እዚ ወላዲ ፕሮፋይል ምጽዓን ኣይተኻእለን።",
      backToDashboard: "ናብ ዳሽቦርድ ተመለስ",
      menuEditInfo: "ሓበሬታ ኣርትዕ",
      menuChangePhoto: "ፎቶ ቀይር",
      menuChangePassword: "መሕለፊ ቃል ቀይር",
      menuLanguage: "ቋንቋ ቀይር",
      menuSaveToGallery: "ናብ ጋለሪ ኣቐምጥ",
      menuTerms: "ውዕላትን ምስጢራዊነትን",
      menuLogout: "ውጻእ",
      childSingle: "ውሉድ",
      childPlural: "ውሉዳት",
      parentRole: "ወላዲ",
      online: "ኣብ መስመር",
      offline: "ካብ መስመር ወጻኢ",
      editProfile: "ፕሮፋይል ኣርትዕ",
      tabMain: "ዋና",
      tabInfo: "ሓበሬታ",
      familyOverview: "ኣጠቓላሊ ስድራ",
      parentAccount: "ኣካውንት ወላዲ",
      linkedChildSingular: "ዝተኣሳሰረ ውሉድ",
      linkedChildPlural: "ዝተኣሳሰሩ ውሉዳት",
      noLinkedChildrenYet: "ክሳብ ሕጂ ዝተኣሳሰሩ ውሉዳት የለዉን",
      grade: "ክፍሊ",
      section: "ሴክሽን",
      fallbackChildRole: "ውሉድ",
      noLinkedChildrenFound: "ዝተኣሳሰሩ ውሉዳት ኣይተረኽቡን።",
      support: "ደገፍ",
      telegram: "ቴሌግራም",
      telegramSubtitle: "ምስ ጎጆ ጉጅለ ኣብ ቴሌግራም ተዘራረብ",
      email: "ኢመይል",
      emailSubtitle: "ብኢመይል መልእኽቲ ስደድልና",
      profileInfo: "ሓበሬታ ፕሮፋይል",
      name: "ስም",
      username: "ስም ተጠቃሚ",
      role: "ተራ",
      status: "ኩነታት",
      children: "ውሉዳት",
      phone: "ስልኪ",
      emailLabel: "ኢመይል",
      editProfileTitle: "ፕሮፋይል ኣርትዕ",
      changePasswordTitle: "መሕለፊ ቃል ቀይር",
      currentPassword: "ናይ ሕጂ መሕለፊ ቃል",
      newPassword: "ሓድሽ መሕለፊ ቃል",
      confirmNewPassword: "ሓድሽ መሕለፊ ቃል ኣረጋግጽ",
      enterCurrentPassword: "ናይ ሕጂ መሕለፊ ቃል ኣእቱ",
      enterNewPassword: "ሓድሽ መሕለፊ ቃል ኣእቱ (እንተኾነ 6 ፊደላት)",
      confirmNewPasswordPlaceholder: "ሓድሽ መሕለፊ ቃል ኣረጋግጽ",
      cancel: "ሰርዝ",
      save: "ኣቐምጥ",
      saving: "ይቕመጥ ኣሎ...",
      languageTitle: "ቋንቋ ቀይር",
      languageEnglish: "English",
      languageAmharic: "Amharic",
      languageOromo: "Afaan Oromoo",
      languageTigrinya: "ትግርኛ",
      languageEnglishSubtitle: "ኣፕን ብእንግሊዝኛ ኣርእይ",
      languageAmharicSubtitle: "ኣፕን ብአማርኛ ኣርእይ",
      languageOromoSubtitle: "ኣፕን ብኣፋን ኦሮሞ ኣርእይ",
      languageTigrinyaSubtitle: "ኣፕን ብትግርኛ ኣርእይ",
      languageValue: "TI",
      recentlyJoined: "ቀረባ ጊዜ ተጸንቢሩ",
    };
  }

  if (amharic) {
    return {
      loadingProfile: "መገለጫ በመጫን ላይ...",
      profileUnavailableTitle: "መገለጫው አልተገኘም",
      profileUnavailableBody: "የዚህን ወላጅ መገለጫ መጫን አልቻልንም።",
      backToDashboard: "ወደ ዳሽቦርድ ተመለስ",
      menuEditInfo: "መረጃ አርትዕ",
      menuChangePhoto: "ፎቶ ቀይር",
      menuChangePassword: "የይለፍ ቃል ቀይር",
      menuLanguage: "ቋንቋ ቀይር",
      menuSaveToGallery: "ወደ ጋለሪ አስቀምጥ",
      menuTerms: "ውሎች እና ግላዊነት",
      menuLogout: "ውጣ",
      childSingle: "ልጅ",
      childPlural: "ልጆች",
      parentRole: "ወላጅ",
      online: "መስመር ላይ",
      offline: "ከመስመር ውጭ",
      editProfile: "መገለጫ አርትዕ",
      tabMain: "ዋና",
      tabInfo: "መረጃ",
      familyOverview: "የቤተሰብ አጠቃላይ እይታ",
      parentAccount: "የወላጅ መለያ",
      linkedChildSingular: "የተገናኘ ልጅ",
      linkedChildPlural: "የተገናኙ ልጆች",
      noLinkedChildrenYet: "እስካሁን የተገናኙ ልጆች የሉም",
      grade: "ክፍል",
      section: "ሴክሽን",
      fallbackChildRole: "ልጅ",
      noLinkedChildrenFound: "እስካሁን የተገናኙ ልጆች አልተገኙም።",
      support: "ድጋፍ",
      telegram: "ቴሌግራም",
      telegramSubtitle: "ከ Gojo ቡድን ጋር በቴሌግራም ይነጋገሩ",
      email: "ኢሜይል",
      emailSubtitle: "በኢሜይል መልዕክት ይላኩልን",
      profileInfo: "የመገለጫ መረጃ",
      name: "ስም",
      username: "የተጠቃሚ ስም",
      role: "ሚና",
      status: "ሁኔታ",
      children: "ልጆች",
      phone: "ስልክ",
      emailLabel: "ኢሜይል",
      editProfileTitle: "መገለጫ አርትዕ",
      changePasswordTitle: "የይለፍ ቃል ቀይር",
      currentPassword: "የአሁኑ የይለፍ ቃል",
      newPassword: "አዲስ የይለፍ ቃል",
      confirmNewPassword: "አዲሱን የይለፍ ቃል ያረጋግጡ",
      enterCurrentPassword: "የአሁኑን የይለፍ ቃል ያስገቡ",
      enterNewPassword: "አዲስ የይለፍ ቃል ያስገቡ (ቢያንስ 6 ቁምፊዎች)",
      confirmNewPasswordPlaceholder: "አዲሱን የይለፍ ቃል ያረጋግጡ",
      cancel: "ሰርዝ",
      save: "አስቀምጥ",
      saving: "በማስቀመጥ ላይ...",
      languageTitle: "ቋንቋ ቀይር",
      languageEnglish: "English",
      languageAmharic: "አማርኛ",
      languageOromo: "Afaan Oromoo",
      languageEnglishSubtitle: "መተግበሪያውን በእንግሊዝኛ አሳይ",
      languageAmharicSubtitle: "መተግበሪያውን በአማርኛ አሳይ",
      languageOromoSubtitle: "መተግበሪያውን በአፋን ኦሮሞ አሳይ",
      languageValue: "AM",
      recentlyJoined: "በቅርቡ ተቀላቀለ",
    };
  }

  if (oromo) {
    return {
      loadingProfile: "Profaayilii fe'aa jira...",
      profileUnavailableTitle: "Profaayiliin hin argamne",
      profileUnavailableBody: "Profaayilii maatii kana fe'uu hin dandeenye.",
      backToDashboard: "Gara daashboordii deebi'i",
      menuEditInfo: "Odeeffannoo gulaali",
      menuChangePhoto: "Suuraa jijjiiri",
      menuChangePassword: "Jecha darbii jijjiiri",
      menuLanguage: "Afaan jijjiiri",
      menuSaveToGallery: "Galarii keessatti kaa'i",
      menuTerms: "Seerota fi dhuunfaa",
      menuLogout: "Ba'i",
      childSingle: "Ijoollee",
      childPlural: "Ijoollee",
      parentRole: "Maatii",
      online: "Toora irratti",
      offline: "Toora ala",
      editProfile: "Profaayilii gulaali",
      tabMain: "Ijo",
      tabInfo: "Odeeffannoo",
      familyOverview: "Ilaalcha maatii",
      parentAccount: "Akkaawuntii maatii",
      linkedChildSingular: "ijoollee walqabate",
      linkedChildPlural: "ijoollee walqabatan",
      noLinkedChildrenYet: "Ammaaf ijoolleen walqabatan hin jiran",
      grade: "Kutaa",
      section: "Kutaa xiqqaa",
      fallbackChildRole: "Ijoollee",
      noLinkedChildrenFound: "Ijoolleen walqabatan hin argamne.",
      support: "Deeggarsa",
      telegram: "Telegram",
      telegramSubtitle: "Garee Gojo wajjin Telegram irratti haasayi",
      email: "Imeelii",
      emailSubtitle: "Nuutti ergaa imeeliin ergi",
      profileInfo: "Odeeffannoo profaayilii",
      name: "Maqaa",
      username: "Maqaa fayyadamaa",
      role: "Gahee hojii",
      status: "Haala",
      children: "Ijoollee",
      phone: "Bilbila",
      emailLabel: "Imeelii",
      editProfileTitle: "Profaayilii gulaali",
      changePasswordTitle: "Jecha darbii jijjiiri",
      currentPassword: "Jecha darbii amma jiru",
      newPassword: "Jecha darbii haaraa",
      confirmNewPassword: "Jecha darbii haaraa mirkaneessi",
      enterCurrentPassword: "Jecha darbii amma jiru galchi",
      enterNewPassword: "Jecha darbii haaraa galchi (xiqqaate qubee 6)",
      confirmNewPasswordPlaceholder: "Jecha darbii haaraa mirkaneessi",
      cancel: "Dhiisi",
      save: "Kaa'i",
      saving: "Kaa'aa jira...",
      languageTitle: "Afaan jijjiiri",
      languageEnglish: "English",
      languageAmharic: "Amharic",
      languageOromo: "Afaan Oromoo",
      languageEnglishSubtitle: "Appicha Englishiin agarsiisi",
      languageAmharicSubtitle: "Appicha Amaariffaan agarsiisi",
      languageOromoSubtitle: "Appicha Afaan Oromoon agarsiisi",
      languageValue: "OM",
      recentlyJoined: "Dhiheenya kana makame",
    };
  }

  return {
    loadingProfile: "Loading profile...",
    profileUnavailableTitle: "Profile unavailable",
    profileUnavailableBody: "We could not load this parent profile.",
    backToDashboard: "Back to dashboard",
    menuEditInfo: "Edit Info",
    menuChangePhoto: "Change Photo",
    menuChangePassword: "Change Password",
    menuLanguage: "Change Language",
    menuSaveToGallery: "Save to Gallery",
    menuTerms: "Terms & Privacy",
    menuLogout: "Logout",
    childSingle: "Child",
    childPlural: "Children",
    parentRole: "Parent",
    online: "Online",
    offline: "Offline",
    editProfile: "Edit Profile",
    tabMain: "Main",
    tabInfo: "Info",
    familyOverview: "Family overview",
    parentAccount: "Parent account",
    linkedChildSingular: "linked child",
    linkedChildPlural: "linked children",
    noLinkedChildrenYet: "No linked children yet",
    grade: "Grade",
    section: "Section",
    fallbackChildRole: "Child",
    noLinkedChildrenFound: "No linked children found yet.",
    support: "Support",
    telegram: "Telegram",
    telegramSubtitle: "Chat with the Gojo team on Telegram",
    email: "Email",
    emailSubtitle: "Send us a message by email",
    profileInfo: "Profile info",
    name: "Name",
    username: "Username",
    role: "Role",
    status: "Status",
    children: "Children",
    phone: "Phone",
    emailLabel: "Email",
    editProfileTitle: "Edit Profile",
    changePasswordTitle: "Change Password",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmNewPassword: "Confirm New Password",
    enterCurrentPassword: "Enter current password",
    enterNewPassword: "Enter new password (min 6 characters)",
    confirmNewPasswordPlaceholder: "Confirm new password",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    languageTitle: "Change Language",
    languageEnglish: "English",
    languageAmharic: "Amharic",
    languageOromo: "Afaan Oromo",
    languageTigrinya: "Tigrinya",
    languageEnglishSubtitle: "Use English across the app",
    languageAmharicSubtitle: "Use Amharic across the app",
    languageOromoSubtitle: "Use Afaan Oromo across the app",
    languageTigrinyaSubtitle: "Use Tigrinya across the app",
    languageValue: "EN",
    recentlyJoined: "Recently joined",
  };
}

export default function ParentProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { PALETTE, styles, isDark, statusBarStyle, toggleTheme, languageCode, setLanguageCode } = useProfileThemeConfig();

  const [schoolKey, setSchoolKey] = useState(null);
  const [parentNodeId, setParentNodeId] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [parentUser, setParentUser] = useState(null);
  const [children, setChildren] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [online, setOnline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  const defaultProfile = "https://cdn-icons-png.flaticon.com/512/847/847969.png";
  const labels = useMemo(() => getProfileLabels(languageCode), [languageCode]);

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

  const loadParentData = useCallback(async ({ showLoading = true } = {}) => {
    if (!parentNodeId) {
      setParentUser(null);
      setChildren([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const cacheKey = getProfileCacheKey(schoolKey, parentNodeId);
      if (showLoading) {
        const cachedProfileRecord = await readCachedJsonRecord(cacheKey);
        const cachedProfile = cachedProfileRecord?.value || null;

        if (cachedProfile && typeof cachedProfile === "object") {
          setParentUser(cachedProfile.parentUser || null);
          setChildren(Array.isArray(cachedProfile.children) ? cachedProfile.children : []);
          setLoading(false);
        } else {
          setLoading(true);
        }
      }

      const networkState = await getNetworkStateAsync();
      const onlineNow = Boolean(networkState.isConnected && networkState.isInternetReachable !== false);
      setOnline(onlineNow);

      if (!onlineNow) {
        return;
      }

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
        getLinkedChildrenForParent(prefix, parentNodeId, { forceNetwork: true }),
      ]);

      const userData = userSnap?.exists() ? userSnap.val() || {} : {};
      const nextParentUser = {
        ...userData,
        userId: parentNode.userId,
        status: parentNode.status,
        createdAt: parentNode.createdAt,
      };

      const nextChildren = (linkedChildren || []).map((child) => ({
        ...child,
        profileImage: child.profileImage || defaultProfile,
      }));

      setParentUser(nextParentUser);
      setChildren(nextChildren);
      writeCachedJson(cacheKey, {
        parentUser: nextParentUser,
        children: nextChildren,
        fetchedAt: Date.now(),
      }).catch(() => {});
    } catch (error) {
      console.log("Error fetching parent profile:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [defaultProfile, parentNodeId, schoolKey]);

  useEffect(() => {
    if (!bootstrapped) return;
    void loadParentData();
  }, [bootstrapped, loadParentData]);

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

  const handleRefresh = useCallback(async () => {
    if (!bootstrapped || loading || refreshing) {
      return;
    }

    setRefreshing(true);
    await loadParentData({ showLoading: false });
  }, [bootstrapped, loadParentData, loading, refreshing]);

  const handleChildPress = (child) => {
    const params = { roleName: "Student" };

    if (child?.studentId) {
      params.recordId = String(child.studentId);
    }

    if (child?.userId) {
      params.userId = String(child.userId);
    }

    if (!params.recordId && !params.userId) {
      return;
    }

    router.push({ pathname: "/userProfile", params });
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

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Please allow photo access to change your profile picture.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });

      if (result.canceled) return;

      const selectedAsset = result.assets?.[0];
      if (!selectedAsset?.uri) {
        Alert.alert("Error", "No image was selected.");
        return;
      }

      await uploadProfileImage(selectedAsset.uri);
    } catch {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const uploadProfileImage = async (imageUri) => {
    try {
      if (!parentUser?.userId) return Alert.alert("Error", "User not found");
      setUploadingPhoto(true);

      const response = await fetch(imageUri);
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("Selected image is empty or unreadable.");
      }

      const imageRef = storageRef(storage, `profileImages/${parentUser.userId}/${Date.now()}.jpg`);
      await uploadBytes(imageRef, blob, { contentType: blob.type || "image/jpeg" });
      const downloadURL = await getDownloadURL(imageRef);

      await update(ref(database, schoolAwarePath(`Users/${parentUser.userId}`)), {
        profileImage: downloadURL,
      });

      const nextParentUser = { ...(parentUser || {}), profileImage: downloadURL };
      setParentUser(nextParentUser);
      AsyncStorage.setItem("profileImage", downloadURL).catch(() => {});
      writeCachedJson(getProfileCacheKey(schoolKey, parentNodeId), {
        parentUser: nextParentUser,
        children,
        fetchedAt: Date.now(),
      }).catch(() => {});
      Alert.alert("Success", "Profile picture updated successfully");
    } catch (error) {
      Alert.alert("Error", `Failed to upload image: ${error.message}`);
    } finally {
      setUploadingPhoto(false);
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

  const openLanguageModal = useCallback(() => {
    setShowMenu(false);
    setShowLanguageModal(true);
  }, []);

  const closeLanguageModal = useCallback(() => {
    setShowLanguageModal(false);
  }, []);

  const handleLanguageChange = useCallback((nextLanguageCode) => {
    setLanguageCode(nextLanguageCode);
    setShowLanguageModal(false);
  }, [setLanguageCode]);

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
    return <ProfileScreenSkeleton />;
  }

  if (!parentUser) {
    return (
      <View style={styles.loadingWrap}>
        <Ionicons name="person-circle-outline" size={56} color={PALETTE.offline} />
        <Text style={styles.loadingTitle}>{labels.profileUnavailableTitle}</Text>
        <Text style={styles.loadingText}>{labels.profileUnavailableBody}</Text>
        <TouchableOpacity style={styles.emptyBackBtn} onPress={handleBack} activeOpacity={0.88}>
          <Text style={styles.emptyBackText}>{labels.backToDashboard}</Text>
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
            <TouchableOpacity style={styles.menuItem} onPress={openLanguageModal}>
              <Text style={styles.menuText}>{`${labels.menuLanguage} (${labels.languageValue})`}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSaveProfilePhoto}>
              <Text style={styles.menuText}>{labels.menuSaveToGallery}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleTerms}>
              <Text style={styles.menuText}>{labels.menuTerms}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemNoBorder]} onPress={handleLogout}>
              <Text style={[styles.menuText, { color: PALETTE.danger, fontWeight: "700" }]}>{labels.menuLogout}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

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
                  text={`${children.length} ${children.length === 1 ? labels.childSingle : labels.childPlural}`}
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
                <AppImage
                  uri={parentUser.profileImage || defaultProfile}
                  fallbackSource={require("../assets/images/avatar_placeholder.png")}
                  style={styles.photoCardImage}
                />
              </View>
              <TouchableOpacity
                style={styles.photoCardCamera}
                onPress={handleImagePicker}
                activeOpacity={0.9}
                disabled={uploadingPhoto}
              >
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
            <MiniPill icon="person-outline" text={labels.parentRole} compact />
            <MiniPill
              icon={isOnline ? "wifi-outline" : "cloud-offline-outline"}
              text={isOnline ? labels.online : labels.offline}
              compact
            />
          </View>

          <TouchableOpacity style={styles.editProfileBtn} onPress={openEditModal} activeOpacity={0.88}>
            <Text style={styles.editProfileText}>{labels.editProfile}</Text>
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
                {labels.tabMain}
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
                {labels.tabInfo}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.contentWrap}>
        <Animated.ScrollView
          style={styles.sectionScroll}
          contentContainerStyle={[
            styles.sectionScrollContent,
            { paddingBottom: Math.max(88, insets.bottom + 64) },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[PALETTE.accent]}
              tintColor={PALETTE.accent}
              progressViewOffset={8}
            />
          }
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
          bounces
          showsVerticalScrollIndicator={false}
        >
          {profileSectionTab === "main" ? (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{labels.familyOverview}</Text>

                {children.length ? (
                  children.map((child) => (
                    <TouchableOpacity
                      key={child.studentId}
                      style={styles.childCard}
                      onPress={() => handleChildPress(child)}
                      activeOpacity={0.88}
                    >
                      <AppImage
                        uri={child.profileImage}
                        fallbackSource={require("../assets/images/avatar_placeholder.png")}
                        style={styles.childImage}
                      />
                      <View style={styles.childBody}>
                        <View style={styles.childTopRow}>
                          <Text style={styles.childName}>{child.name}</Text>
                          <View style={styles.childRolePill}>
                            <Text style={styles.childRoleText}>{labels.fallbackChildRole}</Text>
                          </View>
                        </View>
                        <Text style={styles.childMeta}>
                          {labels.grade} {child.grade || "--"} • {labels.section} {child.section || "--"}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={PALETTE.muted} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.noteStateCard}>
                    <Ionicons name="people-outline" size={18} color={PALETTE.muted} />
                    <Text style={styles.noteStateText}>{labels.noLinkedChildrenFound}</Text>
                  </View>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{labels.support}</Text>
                <ActionRow
                  icon="paper-plane-outline"
                  title={labels.telegram}
                  subtitle={labels.telegramSubtitle}
                  onPress={() => Linking.openURL("https://t.me/gojo_edu")}
                />
                <ActionRow
                  icon="mail-outline"
                  title={labels.email}
                  subtitle={labels.emailSubtitle}
                  onPress={() => Linking.openURL("mailto:gojo.education1@gmail.com")}
                />
              </View>
            </>
          ) : (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{labels.profileInfo}</Text>
              <InfoRow label={labels.name} value={parentUser.name} />
              <InfoRow label={labels.username} value={parentUser.username ? usernameHandle : null} />
              <InfoRow label={labels.role} value={labels.parentRole} />
              <InfoRow label={labels.status} value={isOnline ? labels.online : labels.offline} />
              <InfoRow label={labels.children} value={`${children.length}`} />
              <InfoRow label={labels.phone} value={parentUser.phone} />
              <InfoRow label={labels.emailLabel} value={parentUser.email} />
            </View>
          )}
        </Animated.ScrollView>
      </View>

      <Modal visible={showLanguageModal} transparent animationType="fade" onRequestClose={closeLanguageModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{labels.languageTitle}</Text>

            <TouchableOpacity
              style={[styles.languageOptionBtn, languageCode === "en" && styles.languageOptionBtnActive]}
              onPress={() => handleLanguageChange("en")}
              activeOpacity={0.88}
            >
              <Ionicons name="language-outline" size={18} color={PALETTE.text} />
              <View style={styles.languageOptionBody}>
                <Text style={styles.languageOptionTitle}>{labels.languageEnglish}</Text>
                <Text style={styles.languageOptionSubtitle}>{labels.languageEnglishSubtitle}</Text>
              </View>
              {languageCode === "en" ? <Ionicons name="checkmark-circle" size={18} color={PALETTE.accent} /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.languageOptionBtn, languageCode === "am" && styles.languageOptionBtnActive]}
              onPress={() => handleLanguageChange("am")}
              activeOpacity={0.88}
            >
              <Ionicons name="language-outline" size={18} color={PALETTE.text} />
              <View style={styles.languageOptionBody}>
                <Text style={styles.languageOptionTitle}>{labels.languageAmharic}</Text>
                <Text style={styles.languageOptionSubtitle}>{labels.languageAmharicSubtitle}</Text>
              </View>
              {languageCode === "am" ? <Ionicons name="checkmark-circle" size={18} color={PALETTE.accent} /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.languageOptionBtn, languageCode === "om" && styles.languageOptionBtnActive]}
              onPress={() => handleLanguageChange("om")}
              activeOpacity={0.88}
            >
              <Ionicons name="language-outline" size={18} color={PALETTE.text} />
              <View style={styles.languageOptionBody}>
                <Text style={styles.languageOptionTitle}>{labels.languageOromo}</Text>
                <Text style={styles.languageOptionSubtitle}>{labels.languageOromoSubtitle}</Text>
              </View>
              {languageCode === "om" ? <Ionicons name="checkmark-circle" size={18} color={PALETTE.accent} /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.languageOptionBtn, languageCode === "ti" && styles.languageOptionBtnActive]}
              onPress={() => handleLanguageChange("ti")}
              activeOpacity={0.88}
            >
              <Ionicons name="language-outline" size={18} color={PALETTE.text} />
              <View style={styles.languageOptionBody}>
                <Text style={styles.languageOptionTitle}>{labels.languageTigrinya}</Text>
                <Text style={styles.languageOptionSubtitle}>{labels.languageTigrinyaSubtitle}</Text>
              </View>
              {languageCode === "ti" ? <Ionicons name="checkmark-circle" size={18} color={PALETTE.accent} /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.editOptionBtn, styles.editOptionCancel]}
              onPress={closeLanguageModal}
              activeOpacity={0.88}
            >
              <Ionicons name="close-outline" size={18} color={PALETTE.muted} />
              <Text style={[styles.editOptionText, styles.editOptionCancelText]}>{labels.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{labels.editProfileTitle}</Text>

            <TouchableOpacity style={styles.editOptionBtn} onPress={handleEditInfo} activeOpacity={0.88}>
              <Ionicons name="create-outline" size={18} color={PALETTE.text} />
              <Text style={styles.editOptionText}>{labels.menuEditInfo}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.editOptionBtn} onPress={handleImagePicker} activeOpacity={0.88}>
              <Ionicons name="image-outline" size={18} color={PALETTE.text} />
              <Text style={styles.editOptionText}>{labels.menuChangePhoto}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.editOptionBtn} onPress={openPasswordModalFromActions} activeOpacity={0.88}>
              <Ionicons name="key-outline" size={18} color={PALETTE.text} />
              <Text style={styles.editOptionText}>{labels.menuChangePassword}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.editOptionBtn, styles.editOptionCancel]}
              onPress={closeEditModal}
              activeOpacity={0.88}
            >
              <Ionicons name="close-outline" size={18} color={PALETTE.muted} />
              <Text style={[styles.editOptionText, styles.editOptionCancelText]}>{labels.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={handleClosePasswordModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{labels.changePasswordTitle}</Text>

            <Field
              label={labels.currentPassword}
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                setCurrentPasswordError("");
              }}
              secureTextEntry
              placeholder={labels.enterCurrentPassword}
              error={currentPasswordError}
            />

            <Field
              label={labels.newPassword}
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
              placeholder={labels.enterNewPassword}
              error={newPasswordError}
            />

            <Field
              label={labels.confirmNewPassword}
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
              placeholder={labels.confirmNewPasswordPlaceholder}
              error={confirmPasswordError}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleClosePasswordModal}
                disabled={isChangingPassword}
              >
                <Text style={styles.cancelButtonText}>{labels.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              >
                <Text style={styles.confirmButtonText}>{isChangingPassword ? labels.saving : labels.save}</Text>
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
    marginHorizontal: 0,
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
  languageOptionBtn: {
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  languageOptionBtnActive: {
    borderColor: PALETTE.accent,
    backgroundColor: PALETTE.accentSoft,
  },
  languageOptionBody: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  languageOptionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: PALETTE.text,
  },
  languageOptionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: PALETTE.muted,
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