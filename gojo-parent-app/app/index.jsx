import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  SafeAreaView,
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
  getParentAccessState,
  getSchoolContactInfo,
  normalizePhoneNumber,
} from "./lib/accountAccess";
import { useParentTheme } from "../hooks/use-parent-theme";

export const options = { headerShown: false };

export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef(null);
  const { colors, expoStatusBarStyle, amharic, oromo } = useParentTheme();
  const palette = useMemo(
    () => ({
      background: colors.background,
      primary: colors.primary,
      muted: colors.mutedAlt,
      title: colors.textStrong,
      inputBg: colors.card,
      inputBorder: colors.borderStrong,
      inputText: colors.text,
      placeholder: colors.muted,
      error: colors.danger,
      link: colors.primary,
      footer: colors.mutedAlt,
      buttonText: colors.white,
    }),
    [colors]
  );
  const styles = useMemo(() => createStyles(palette), [palette]);
  const labels = useMemo(
    () => {
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
          parentLogin: "Seensa Maatii",
          loginSubtitle: "Gara account Gojo Parent keetti seeni",
          username: "Maqaa fayyadamaa",
          password: "Jecha darbii",
          login: "Seeni",
          needHelp: "Gargaarsa barbaaddaa? Mana barumsaa kee qunnami",
          rights: "Mirgi hundi eegameera.",
          ok: "Tole",
        };
      }

      return {
        unavailable: amharic ? "አልተገኘም" : "Unavailable",
        schoolPhoneMissing: amharic ? "የትምህርት ቤቱ ስልክ ቁጥር የለም።" : "School phone number is missing.",
        cannotOpenDialer: amharic ? "ለዚህ ቁጥር የጥሪ መተግበሪያ መክፈት አይቻልም:" : "Cannot open dialer for:",
        error: amharic ? "ስህተት" : "Error",
        couldNotResolveSchool: amharic
          ? "የትምህርት ቤቱን የመገናኛ መረጃ ገና ማግኘት አልተቻለም። መጀመሪያ የተጠቃሚ ስምዎን ያስገቡ።"
          : "Could not resolve school contact yet. Enter your username first.",
        schoolContactUnavailable: amharic ? "የትምህርት ቤቱ የመገናኛ መረጃ አይገኝም።" : "School contact is not available.",
        couldNotOpenDialer: amharic ? "የጥሪ መተግበሪያን መክፈት አልተቻለም።" : "Could not open dialer.",
        pleaseEnterCredentials: amharic ? "እባክዎ የተጠቃሚ ስምና የይለፍ ቃል ያስገቡ።" : "Please enter username and password.",
        noAccountForPrefix: amharic ? "ለዚህ የተጠቃሚ ስም ቅድመ ቁጥር ትምህርት ቤት አልተገኘም" : "School code not found for username prefix",
        noAccountResolvedSchool: amharic ? "በተገኘው ትምህርት ቤት ውስጥ በዚህ የተጠቃሚ ስም የተመዘገበ መለያ አልተገኘም።" : "No account found with that username in the resolved school.",
        lookupFailed: amharic ? "ፍለጋው አልተሳካም።" : "Lookup failed.",
        noAccountFound: amharic ? "በዚህ የተጠቃሚ ስም መለያ አልተገኘም።" : "No account found with that username.",
        notParentAccount: amharic ? "ይህ መለያ የወላጅ መለያ አይደለም።" : "This account is not a parent account.",
        incorrectPassword: amharic ? "የይለፍ ቃሉ ትክክል አይደለም።" : "Incorrect password.",
        somethingWentWrong: amharic ? "አንድ ችግር ተፈጥሯል። እንደገና ይሞክሩ።" : "Something went wrong. Try again.",
        parentLogin: amharic ? "የወላጅ መግቢያ" : "Parent Login",
        loginSubtitle: amharic ? "ወደ Gojo Parent መለያዎ ይግቡ" : "Sign in to your Gojo Parent account",
        username: amharic ? "የተጠቃሚ ስም" : "Username",
        password: amharic ? "የይለፍ ቃል" : "Password",
        login: amharic ? "ግባ" : "Login",
        needHelp: amharic ? "እርዳታ ይፈልጋሉ? ትምህርት ቤትዎን ያነጋግሩ" : "Need help? Contact your school",
        rights: amharic ? "መብቱ የተጠበቀ ነው።" : "All rights reserved.",
        ok: amharic ? "እሺ" : "OK",
      };
    },
    [amharic, oromo]
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blockedNotice, setBlockedNotice] = useState({
    visible: false,
    schoolName: "",
    phone: "",
    phoneLabel: "",
  });

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

  useEffect(() => {
    const checkSession = async () => {
      try {
        const userId = await AsyncStorage.getItem("userId");
        const userNodeKey = await AsyncStorage.getItem("userNodeKey");
        const role = await AsyncStorage.getItem("role");
        const schoolKey = await AsyncStorage.getItem("schoolKey");
        const lastLogin = await AsyncStorage.getItem("lastLogin");

        if (userId && role === "parent" && schoolKey) {
          // keep your original session-expiry idea, but fixed duration math
          if (lastLogin) {
            const now = Date.now();
            const last = parseInt(lastLogin, 10);
            const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

            if (!Number.isNaN(last) && now - last < threeDaysMs) {
              const accessState = await getParentAccessState({
                userId,
                userNodeKey: userNodeKey || "",
                role,
                schoolKey,
              });

              if (accessState.status === "active") {
                router.replace("/dashboard/home");
                return;
              }

              await clearParentSession();

              if (accessState.status === "blocked") {
                await showBlockedAccountNotice(schoolKey || accessState.schoolKey || null);
              }

              return;
            }
          }

          // if no lastLogin or expired, clear and continue login page
          await clearParentSession();
        }
      } catch (e) {
        console.warn("[Parent Login] checkSession error:", e);
      }
    };

    checkSession();
  }, [router]);

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

      // clear old session keys and save fresh
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
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.top}>
              <Image source={require("../assets/images/logo.png")} style={styles.logo} resizeMode="contain" />
              <Text style={styles.title}>{labels.parentLogin}</Text>
              <Text style={styles.subtitle}>{labels.loginSubtitle}</Text>
            </View>

            <View style={styles.form}>
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={22} color={palette.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={labels.username}
                  placeholderTextColor={palette.placeholder}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current && passwordRef.current.focus()}
                />
              </View>

              <View style={styles.inputRow}>
                <Ionicons name="key-outline" size={22} color={palette.muted} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { paddingRight: 44 }]}
                  placeholder={labels.password}
                  placeholderTextColor={palette.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                />
                <TouchableOpacity activeOpacity={0.7} onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
                  <Ionicons name={showPassword ? "eye" : "eye-off"} size={20} color={palette.muted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSignIn} disabled={loading}>
                {loading ? <ActivityIndicator color={palette.buttonText} /> : <Text style={styles.buttonText}>{labels.login}</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkRow} onPress={handleNeedHelp}>
                <Text style={styles.linkText}>{labels.needHelp}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
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

const createStyles = (palette) => StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: palette.background },
  scrollContent: { flexGrow: 1, justifyContent: "space-between", paddingTop: 12, paddingBottom: 20 },

  top: { alignItems: "center", marginTop: 8 },
  logo: { width: 180, height: 180, borderRadius: 14, marginTop: 16 },
  title: { marginTop: -8, fontSize: 34, color: palette.title, fontWeight: "800" },
  subtitle: { marginTop: 8, fontSize: 14, color: palette.muted, textAlign: "center" },

  form: { paddingHorizontal: 28, marginTop: 8 },
  error: { color: palette.error, marginBottom: 8, textAlign: "center" },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    paddingHorizontal: 12,
    height: 56,
    marginTop: 12,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, color: palette.inputText },

  eyeButton: {
    position: "absolute",
    right: 18,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },

  button: {
    height: 56,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.75 },
  buttonText: { color: palette.buttonText, fontWeight: "800", fontSize: 18 },

  linkRow: { marginTop: 12, alignItems: "center" },
  linkText: { color: palette.link, fontWeight: "600" },

  footer: { alignItems: "center", marginTop: 28, paddingBottom: 8 },
  copyright: { color: palette.footer, fontSize: 12 },
});