import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, query, orderByChild, equalTo, get } from "firebase/database";
import { database } from "../constants/firebaseConfig";
import BlockedAccountModal from "../components/ui/BlockedAccountModal";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  clearParentSession,
  getBlockedContactCaption,
  getSchoolContactInfo,
  normalizePhoneNumber,
} from "./lib/accountAccess";
import { useParentTheme } from "../hooks/use-parent-theme";

export const options = { headerShown: false };

function withAlpha(color, alpha) {
  if (typeof color !== "string") return `rgba(0,0,0,${alpha})`;

  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((value) => value + value)
        .join("");
    }
    if (hex.length !== 6) return `rgba(0,0,0,${alpha})`;
    const parsed = Number.parseInt(hex, 16);
    const red = (parsed >> 16) & 255;
    const green = (parsed >> 8) & 255;
    const blue = parsed & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  if (color.startsWith("rgb(")) {
    const channels = color
      .slice(4, -1)
      .split(",")
      .map((value) => value.trim());
    if (channels.length >= 3) {
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
    }
  }

  return color;
}

export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef(null);
  const { colors, expoStatusBarStyle, amharic, isDark, oromo } = useParentTheme();

  const palette = useMemo(
    () => ({
      screen: colors.background,
      card: colors.card,
      text: colors.textStrong,
      bodyText: colors.text,
      muted: colors.mutedAlt,
      primary: colors.primary,
      soft: colors.primarySoft,
      border: colors.border,
      inputBackground: colors.inputBackground,
      white: colors.white,
      danger: colors.danger,
      dangerSurface: colors.dangerSoft,
      dangerBorder: withAlpha(colors.danger, isDark ? 0.38 : 0.2),
      primaryGlow: isDark ? "rgba(86,176,255,0.16)" : "rgba(34,150,243,0.14)",
      successGlow: isDark ? "rgba(52,211,153,0.08)" : "rgba(34,197,94,0.08)",
      shadowOpacity: isDark ? 0.18 : 0.06,
    }),
    [colors, isDark]
  );
  const styles = useMemo(() => createStyles(palette), [palette]);

  const labels = useMemo(() => {
    if (oromo) {
      return {
        unavailable: "Hin argamu",
        schoolPhoneMissing: "Lakkoofsi bilbilaa mana barumsaa hin jiru.",
        cannotOpenDialer: "Bilbila banuu hin danda'amu:",
        error: "Dogoggora",
        couldNotResolveSchool: "Qunnamtii mana barumsaa hin arganne. Dura maqaa fayyadamaa galchi.",
        schoolContactUnavailable: "Qunnamtiin mana barumsaa hin argamu.",
        couldNotOpenDialer: "App bilbilaa banuu hin dandeenye.",
        pleaseEnterCredentials: "Maqaa fayyadamaa fi jecha darbii galchi.",
        noAccountForPrefix: "Koodiin mana barumsaa prefix kanaaf hin argamne",
        noAccountResolvedSchool: "Maqaa kanaan account mana barumsaa keessatti hin argamne.",
        lookupFailed: "Barbaaduun hin milkoofne.",
        noAccountFound: "Maqaa kanaan account hin argamne.",
        notParentAccount: "Account kun account maatii miti.",
        incorrectPassword: "Jechi darbii sirrii miti.",
        somethingWentWrong: "Rakkoon uumameera. Irra deebi'ii yaali.",
        loginSubtitle: "Gara account Gojo Parent keetti seeni",
        welcomeTitle: "Baga deebi'aan dhuftan",
        heroPill: "App maatii",
        username: "Maqaa fayyadamaa",
        password: "Jecha darbii",
        login: "Seeni",
        formTitle: "Seensa",
        needHelp: "Gargaarsa barbaaddaa? Mana barumsaa kee qunnami",
        rights: "Mirgi hundi eegameera.",
        ok: "Tole",
      };
    }

    if (amharic) {
      return {
        unavailable: "አልተገኘም",
        schoolPhoneMissing: "የትምህርት ቤቱ ስልክ ቁጥር የለም።",
        cannotOpenDialer: "ለዚህ ቁጥር የጥሪ መተግበሪያ መክፈት አይቻልም:",
        error: "ስህተት",
        couldNotResolveSchool: "የትምህርት ቤቱን የመገናኛ መረጃ ገና ማግኘት አልተቻለም። መጀመሪያ የተጠቃሚ ስምዎን ያስገቡ።",
        schoolContactUnavailable: "የትምህርት ቤቱ የመገናኛ መረጃ አይገኝም።",
        couldNotOpenDialer: "የጥሪ መተግበሪያን መክፈት አልተቻለም።",
        pleaseEnterCredentials: "እባክዎ የተጠቃሚ ስምና የይለፍ ቃል ያስገቡ።",
        noAccountForPrefix: "ለዚህ የተጠቃሚ ስም ቅድመ ቁጥር ትምህርት ቤት አልተገኘም",
        noAccountResolvedSchool: "በተገኘው ትምህርት ቤት ውስጥ በዚህ የተጠቃሚ ስም የተመዘገበ መለያ አልተገኘም።",
        lookupFailed: "ፍለጋው አልተሳካም።",
        noAccountFound: "በዚህ የተጠቃሚ ስም መለያ አልተገኘም።",
        notParentAccount: "ይህ መለያ የወላጅ መለያ አይደለም።",
        incorrectPassword: "የይለፍ ቃሉ ትክክል አይደለም።",
        somethingWentWrong: "አንድ ችግር ተፈጥሯል። እንደገና ይሞክሩ።",
        loginSubtitle: "ወደ Gojo Parent መለያዎ ይግቡ",
        welcomeTitle: "እንኳን ደህና ተመለሱ",
        heroPill: "የወላጅ መተግበሪያ",
        username: "የተጠቃሚ ስም",
        password: "የይለፍ ቃል",
        login: "ወደ ዳሽቦርድ ግባ",
        formTitle: "ግባ",
        needHelp: "እርዳታ ይፈልጋሉ? ትምህርት ቤትዎን ያነጋግሩ",
        rights: "መብቱ የተጠበቀ ነው።",
        ok: "እሺ",
      };
    }

    return {
      unavailable: "Unavailable",
      schoolPhoneMissing: "School phone number is missing.",
      cannotOpenDialer: "Cannot open dialer for:",
      error: "Error",
      couldNotResolveSchool: "Could not resolve school contact yet. Enter your username first.",
      schoolContactUnavailable: "School contact is not available.",
      couldNotOpenDialer: "Could not open dialer.",
      pleaseEnterCredentials: "Please enter username and password.",
      noAccountForPrefix: "School code not found for username prefix",
      noAccountResolvedSchool: "No account found with that username in the resolved school.",
      lookupFailed: "Lookup failed.",
      noAccountFound: "No account found with that username.",
      notParentAccount: "This account is not a parent account.",
      incorrectPassword: "Incorrect password.",
      somethingWentWrong: "Something went wrong. Try again.",
      loginSubtitle: "Sign in to your Gojo Parent account",
      welcomeTitle: "Welcome back",
      heroPill: "Parent app",
      username: "Username",
      password: "Password",
      login: "Sign in to dashboard",
      formTitle: "Sign in",
      needHelp: "Need help? Contact your school",
      rights: "All rights reserved.",
      ok: "OK",
    };
  }, [amharic, oromo]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState({
    visible: false,
    schoolName: "",
    phone: "",
    phoneLabel: "",
  });

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const canSubmit = useMemo(
    () => !!String(username || "").trim() && !!String(password || "").trim() && !loading,
    [loading, password, username]
  );

  const showBlockedAccountNotice = async (explicitSchoolKey = null) => {
    const contact = await getSchoolContactInfo(explicitSchoolKey);
    setBlockedNotice({
      visible: true,
      schoolName: contact.schoolName || "",
      phone: contact.phone || "",
      phoneLabel: contact.phoneLabel || "",
    });
  };

  const openPhoneNumber = async (rawPhone) => {
    const phone = normalizePhoneNumber(rawPhone);

    if (!phone) {
      Alert.alert(labels.unavailable, labels.schoolPhoneMissing);
      return;
    }

    const tel = `tel:${phone}`;
    const can = await Linking.canOpenURL(tel);

    if (!can) {
      Alert.alert(labels.unavailable, `${labels.cannotOpenDialer} ${phone}`);
      return;
    }

    await Linking.openURL(tel);
  };

  const resolveSchoolKeyFromUsername = async (uname) => {
    if (!uname || uname.length < 3) return null;
    const prefix = uname.substring(0, 3).toUpperCase();

    try {
      const snap = await get(ref(database, `Platform1/schoolCodeIndex/${prefix}`));
      if (snap.exists()) return snap.val();
    } catch (e) {
      console.warn("[Parent Login] resolveSchoolKeyFromUsername error:", e);
    }

    return null;
  };

  const findUserByUsernameWithoutIndex = async (usersRef, uname, schoolKey) => {
    const normalizedUsername = String(uname || "").trim().toLowerCase();
    const usersSnap = await get(usersRef);

    if (!usersSnap.exists()) {
      return null;
    }

    let matchedUser = null;
    usersSnap.forEach((child) => {
      if (matchedUser) return true;

      const value = child.val() || {};
      const childUsername = String(value.username || "").trim().toLowerCase();
      if (childUsername === normalizedUsername) {
        matchedUser = {
          ...value,
          _nodeKey: child.key,
          _schoolKey: schoolKey,
        };
        return true;
      }

      return false;
    });

    return matchedUser;
  };

  const findUserByUsername = async (uname) => {
    const schoolKey = await resolveSchoolKeyFromUsername(uname);
    if (!schoolKey) {
      return { error: `${labels.noAccountForPrefix} (${uname.substring(0, 3)})` };
    }

    try {
      const usersRef = ref(database, `Platform1/Schools/${schoolKey}/Users`);
      const q = query(usersRef, orderByChild("username"), equalTo(uname));
      const snap = await get(q);

      if (!snap.exists()) {
        return { error: labels.noAccountResolvedSchool };
      }

      let found = null;
      snap.forEach((child) => {
        found = {
          ...child.val(),
          _nodeKey: child.key,
          _schoolKey: schoolKey,
        };
        return true;
      });

      return { user: found };
    } catch (err) {
      const message = String(err?.message || "");
      const missingIndex = /index not defined/i.test(message);

      if (missingIndex) {
        try {
          const usersRef = ref(database, `Platform1/Schools/${schoolKey}/Users`);
          const fallbackUser = await findUserByUsernameWithoutIndex(usersRef, uname, schoolKey);

          if (fallbackUser) {
            return { user: fallbackUser };
          }

          return { error: labels.noAccountResolvedSchool };
        } catch (fallbackErr) {
          console.error("[Parent Login] fallback username lookup error:", fallbackErr);
          return { error: labels.lookupFailed };
        }
      }

      console.error("[Parent Login] findUserByUsername error:", err);
      return { error: labels.lookupFailed };
    }
  };

  const handleNeedHelp = async () => {
    try {
      const uname = username.trim();
      let schoolKey = null;

      if (uname && uname.length >= 3) {
        schoolKey = await resolveSchoolKeyFromUsername(uname);
      }

      if (!schoolKey) {
        schoolKey = await AsyncStorage.getItem("schoolKey");
      }

      if (!schoolKey) {
        return Alert.alert(labels.unavailable, labels.couldNotResolveSchool);
      }

      const infoSnap = await get(ref(database, `Platform1/Schools/${schoolKey}/schoolInfo`));
      if (!infoSnap.exists()) {
        return Alert.alert(labels.unavailable, labels.schoolContactUnavailable);
      }

      const info = infoSnap.val() || {};
      const rawPhone = info.phone || info.alternativePhone || "";
      await openPhoneNumber(rawPhone);
    } catch (e) {
      console.warn("[Parent Login] handleNeedHelp error:", e);
      Alert.alert(labels.error, labels.couldNotOpenDialer);
    }
  };

  const handleSignIn = async () => {
    Keyboard.dismiss();
    setError("");
    const uname = username.trim();
    const pwd = String(password || "").trim();

    if (!uname || !pwd) {
      setError(labels.pleaseEnterCredentials);
      return;
    }

    setLoading(true);
    try {
      const { user, error: lookupError } = await findUserByUsername(uname);
      if (lookupError) {
        setError(lookupError);
        return;
      }

      if (!user) {
        setError(labels.noAccountFound);
        return;
      }

      if (String(user.role || "").toLowerCase() !== "parent") {
        setError(labels.notParentAccount);
        return;
      }

      const storedPwd = user.password == null ? "" : String(user.password).trim();
      if (!storedPwd || storedPwd !== pwd) {
        setError(labels.incorrectPassword);
        return;
      }

      if (typeof user.isActive === "boolean" && !user.isActive) {
        await showBlockedAccountNotice(user._schoolKey || null);
        return;
      }

      const parentId = user.parentId || "";

      await clearParentSession();

      await AsyncStorage.multiSet([
        ["userId", user.userId || user._nodeKey || ""],
        ["userNodeKey", user._nodeKey || ""],
        ["username", user.username || uname],
        ["role", "parent"],
        ["parentId", parentId],
        ["schoolKey", user._schoolKey || ""],
        ["lastLogin", Date.now().toString()],
      ]);

      router.replace("/dashboard/home");
    } catch (err) {
      console.error("Parent login error:", err);
      setError(labels.somethingWentWrong);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style={expoStatusBarStyle} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 70 : 20}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              keyboardVisible && styles.scrollContentKeyboard,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={keyboardVisible}
          >
            <View pointerEvents="none" style={styles.glowTop} />
            <View pointerEvents="none" style={styles.glowBottom} />

            <View style={[styles.contentShell, styles.top]}>
              <View style={styles.heroPill}>
                <Ionicons name="people-circle-outline" size={14} color={palette.primary} />
                <Text style={styles.heroPillText}>{labels.heroPill}</Text>
              </View>

              <Image source={require("../assets/images/freepik__talk__16046-removebg-preview.png")} style={styles.logo} resizeMode="contain" />
              <Text style={styles.title}>{labels.welcomeTitle}</Text>
              <Text style={styles.subtitle}>{labels.loginSubtitle}</Text>
            </View>

            <View style={[styles.contentShell, styles.formCard]}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>{labels.formTitle}</Text>
              </View>

              {error ? (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle" size={18} color={palette.danger} />
                  <Text style={styles.error}>{error}</Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>{labels.username}</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={22} color={palette.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={labels.username}
                  placeholderTextColor={palette.muted}
                  value={username}
                  onChangeText={(value) => {
                    setError("");
                    setUsername(value);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current && passwordRef.current.focus()}
                />
              </View>

              <Text style={[styles.fieldLabel, styles.fieldLabelSpacer]}>{labels.password}</Text>
              <View style={styles.inputRow}>
                <Ionicons name="key-outline" size={22} color={palette.muted} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { paddingRight: 44 }]}
                  placeholder={labels.password}
                  placeholderTextColor={palette.muted}
                  value={password}
                  onChangeText={(value) => {
                    setError("");
                    setPassword(value);
                  }}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                />
                <TouchableOpacity activeOpacity={0.7} onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton}>
                  <Ionicons name={showPassword ? "eye" : "eye-off"} size={20} color={palette.muted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.button, !canSubmit && styles.buttonDisabled]} onPress={handleSignIn} disabled={!canSubmit}>
                {loading ? (
                  <ActivityIndicator color={palette.white} />
                ) : (
                  <View style={styles.buttonContent}>
                    <Ionicons name="lock-closed-outline" size={16} color={palette.white} />
                    <Text style={styles.buttonText}>{labels.login}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.supportRow} onPress={handleNeedHelp} activeOpacity={0.85}>
                <Ionicons name="call-outline" size={16} color={palette.primary} />
                <Text style={styles.supportRowText}>{labels.needHelp}</Text>
                <Ionicons name="chevron-forward" size={16} color={palette.muted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.footer, keyboardVisible && styles.footerKeyboard]}>
              <Text style={styles.copyright}>{`© 2026 Gojo Parent. ${labels.rights}`}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <BlockedAccountModal
        visible={blockedNotice.visible}
        message={BLOCKED_ACCOUNT_MESSAGE}
        caption={getBlockedContactCaption(blockedNotice)}
        onPrimaryPress={() => openPhoneNumber(blockedNotice.phone || blockedNotice.phoneLabel)}
        onSecondaryPress={() => setBlockedNotice((current) => ({ ...current, visible: false }))}
        primaryDisabled={!blockedNotice.phone && !blockedNotice.phoneLabel}
        secondaryLabel={labels.ok}
      />
    </SafeAreaView>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safe: { flex: 1, backgroundColor: palette.screen },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "space-between",
      paddingTop: 18,
      paddingBottom: 18,
      paddingHorizontal: 18,
      position: "relative",
      overflow: "hidden",
    },
    scrollContentKeyboard: {
      justifyContent: "flex-start",
      paddingBottom: 28,
    },
    glowTop: {
      position: "absolute",
      top: -72,
      right: -36,
      width: 188,
      height: 188,
      borderRadius: 999,
      backgroundColor: palette.primaryGlow,
    },
    glowBottom: {
      position: "absolute",
      bottom: 72,
      left: -64,
      width: 180,
      height: 180,
      borderRadius: 999,
      backgroundColor: palette.successGlow,
    },
    contentShell: {
      width: "100%",
      maxWidth: 390,
      alignSelf: "center",
    },
    top: { alignItems: "center", marginTop: 2 },
    heroPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: palette.soft,
      borderWidth: 1,
      borderColor: palette.border,
    },
    heroPillText: {
      marginLeft: 6,
      color: palette.primary,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    logo: { width: 168, height: 168, marginTop: 6 },
    title: { marginTop: -8, fontSize: 27, color: palette.text, fontWeight: "900" },
    subtitle: {
      marginTop: 5,
      fontSize: 12,
      lineHeight: 17,
      color: palette.muted,
      textAlign: "center",
      maxWidth: 290,
      fontWeight: "600",
    },
    formCard: {
      marginTop: 12,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.card,
      paddingHorizontal: 14,
      paddingVertical: 14,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: palette.shadowOpacity,
      shadowRadius: 20,
      elevation: 4,
    },
    formHeader: { marginBottom: 2 },
    formTitle: { color: palette.text, fontSize: 18, fontWeight: "900" },
    formSubtitle: { marginTop: 3, color: palette.muted, fontSize: 11, fontWeight: "700" },
    errorCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.dangerBorder,
      backgroundColor: palette.dangerSurface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 12,
    },
    error: {
      flex: 1,
      color: palette.danger,
      marginLeft: 8,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
    },
    fieldLabel: { marginTop: 10, marginBottom: 6, color: palette.text, fontSize: 12, fontWeight: "800" },
    fieldLabelSpacer: { marginTop: 8 },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.inputBackground,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: 12,
      height: 50,
    },
    inputIcon: { marginRight: 8 },
    input: { flex: 1, fontSize: 15, color: palette.bodyText },
    fieldHint: { marginTop: 6, color: palette.muted, fontSize: 10, lineHeight: 15, fontWeight: "600" },
    eyeButton: {
      position: "absolute",
      right: 18,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
    },
    button: {
      height: 50,
      borderRadius: 15,
      backgroundColor: palette.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 12,
    },
    buttonDisabled: { opacity: 0.55 },
    buttonContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: { color: palette.white, fontWeight: "900", fontSize: 15, marginLeft: 8 },
    supportRow: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    supportRowText: { marginHorizontal: 8, color: palette.primary, fontSize: 11, fontWeight: "700" },
    footer: { alignItems: "center", marginTop: 14, paddingBottom: 4 },
    footerKeyboard: { marginTop: 12 },
    copyright: { color: palette.muted, fontSize: 12 },
  });
}