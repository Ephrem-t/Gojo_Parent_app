import { Slot, usePathname, useRouter } from "expo-router";
import { addNetworkStateListener } from "expo-network";
import * as ExpoSplashScreen from "expo-splash-screen";
import type { DataSnapshot, DatabaseReference } from "firebase/database";
import { off, onValue, ref } from "firebase/database";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import AppLaunchSplash from "../components/ui/AppLaunchSplash";
import BlockedAccountModal from "../components/ui/BlockedAccountModal";
import { database } from "../constants/firebaseConfig";
import { ParentThemeProvider } from "../hooks/use-parent-theme";
import { flushQueuedPostActions } from "./lib/postActionQueue";
import { isInternetReachableNow } from "./lib/networkGuard";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  clearParentSession,
  getBlockedContactCaption,
  getParentAccessState,
  getParentUserRecord,
  getSchoolContactInfo,
  normalizePhoneNumber,
  readParentSession,
} from "./lib/accountAccess";

const EMPTY_NOTICE = {
  visible: false,
  schoolName: "",
  phone: "",
  phoneLabel: "",
};

type ParentSession = {
  userId?: string;
  userNodeKey?: string;
  username?: string;
  role?: string;
  parentId?: string;
  schoolKey?: string | null;
  lastLogin?: string;
};

type ParentRecordUser = {
  isActive?: boolean;
} & Record<string, unknown>;

type ParentUserRecord = {
  user?: ParentRecordUser;
  nodeKey?: string | null;
  schoolKey?: string | null;
};

type ParentAccessState = {
  status: "missing" | "blocked" | "active";
  schoolKey?: string | null;
  user?: ParentRecordUser;
  nodeKey?: string | null;
};

type SchoolContactInfo = {
  schoolName?: string;
  phone?: string;
  phoneLabel?: string;
};

type UserValueHandler = (snap: DataSnapshot) => void;

const readStoredParentSession = readParentSession as () => Promise<ParentSession>;
const resolveParentAccessState = getParentAccessState as (session?: ParentSession | null) => Promise<ParentAccessState>;
const resolveParentUserRecord = getParentUserRecord as (session?: ParentSession | null) => Promise<ParentUserRecord | null>;
const resolveSchoolContactInfo = getSchoolContactInfo as (schoolKey?: string | null) => Promise<SchoolContactInfo>;
const MINIMUM_LAUNCH_SPLASH_MS = 2200;

ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const userRefRef = useRef<DatabaseReference | null>(null);
  const userCallbackRef = useRef<UserValueHandler | null>(null);
  const blockedHandledRef = useRef(false);
  const nativeSplashHiddenRef = useRef(false);
  const [authState, setAuthState] = useState("checking");
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState(EMPTY_NOTICE);
  const isLoginRoute = pathname === "/" || pathname === "";

  const cleanupUserListener = useCallback(() => {
    if (userRefRef.current && userCallbackRef.current) {
      try {
        off(userRefRef.current, "value", userCallbackRef.current);
      } catch {}
    }

    userRefRef.current = null;
    userCallbackRef.current = null;
  }, []);

  const showBlockedNotice = async (schoolKey: string | null = null) => {
    const contact = await resolveSchoolContactInfo(schoolKey);
    setBlockedNotice({
      visible: true,
      schoolName: contact.schoolName || "",
      phone: contact.phone || "",
      phoneLabel: contact.phoneLabel || "",
    });
  };

  const openSchoolDialer = async () => {
    const phone = normalizePhoneNumber(blockedNotice.phone || blockedNotice.phoneLabel);

    if (!phone) {
      Alert.alert("Unavailable", "School phone number is not available.");
      return;
    }

    const tel = `tel:${phone}`;
    const can = await Linking.canOpenURL(tel);

    if (!can) {
      Alert.alert("Unavailable", `Cannot open dialer for: ${phone}`);
      return;
    }

    await Linking.openURL(tel);
  };

  const handleBlockedLogout = async () => {
    cleanupUserListener();
    blockedHandledRef.current = false;
    setBlockedNotice(EMPTY_NOTICE);
    await clearParentSession();

    if (pathname !== "/") {
      router.replace("/");
    }
  };

  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHiddenRef.current) {
      return;
    }

    nativeSplashHiddenRef.current = true;
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinimumSplashElapsed(true);
    }, MINIMUM_LAUNCH_SPLASH_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    void flushQueuedPostActions();

    const subscription = addNetworkStateListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (online) {
        void flushQueuedPostActions();
      }
    });

    return () => {
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const syncAuthState = async () => {
      const session = await readStoredParentSession();
      if (!mounted) return;

      const hasStoredSession =
        String(session.role || "").toLowerCase() === "parent" &&
        !!session.schoolKey &&
        !!(session.userId || session.userNodeKey);

      if (!hasStoredSession) {
        cleanupUserListener();
        blockedHandledRef.current = false;
        setAuthState("unauthenticated");
        setBlockedNotice(EMPTY_NOTICE);

        if (!isLoginRoute) {
          router.replace("/");
        }

        return;
      }

      const onlineNow = await isInternetReachableNow();
      if (!mounted) return;

      if (!onlineNow) {
        setAuthState("authenticated");
        setBlockedNotice(EMPTY_NOTICE);

        if (isLoginRoute) {
          router.replace("/dashboard/home");
        }

        return;
      }

      const accessState = await resolveParentAccessState(session);
      if (!mounted) return;

      if (accessState.status === "active") {
        setAuthState("authenticated");
        setBlockedNotice(EMPTY_NOTICE);

        if (isLoginRoute) {
          router.replace("/dashboard/home");
        }

        return;
      }

      cleanupUserListener();
      blockedHandledRef.current = false;
      await clearParentSession();
      if (!mounted) return;

      if (accessState.status === "blocked") {
        setAuthState("blocked");
        await showBlockedNotice(accessState.schoolKey || session.schoolKey || null);
      } else {
        setAuthState("unauthenticated");
        setBlockedNotice(EMPTY_NOTICE);
      }

      if (!isLoginRoute) {
        router.replace("/");
      }
    };

    void syncAuthState();

    return () => {
      mounted = false;
    };
  }, [cleanupUserListener, isLoginRoute, router]);

  useEffect(() => {
    let mounted = true;

    const startWatcher = async () => {
      if (authState !== "authenticated" || isLoginRoute) {
        cleanupUserListener();
        blockedHandledRef.current = false;
        return;
      }

      const session = await readStoredParentSession();
      if (!mounted) return;

      if (String(session.role || "").toLowerCase() !== "parent") {
        cleanupUserListener();
        blockedHandledRef.current = false;
        return;
      }

      const record = await resolveParentUserRecord(session);
      if (!mounted) return;

      const nodeKey = record?.nodeKey || session.userNodeKey || session.userId || "";
      const schoolKey = record?.schoolKey || session.schoolKey || null;

      if (!nodeKey) {
        cleanupUserListener();
        return;
      }

      const userPath = schoolKey
        ? `Platform1/Schools/${schoolKey}/Users/${nodeKey}`
        : `Users/${nodeKey}`;
      const userDbRef = ref(database, userPath);

      cleanupUserListener();

      const handleUserValue = (snap: DataSnapshot) => {
        if (!mounted || !snap.exists()) return;

        const user = snap.val() || {};
        if (user.isActive === false) {
          blockedHandledRef.current = true;
          void showBlockedNotice(schoolKey);
          return;
        }

        if (blockedHandledRef.current) {
          blockedHandledRef.current = false;
          setBlockedNotice(EMPTY_NOTICE);
        }
      };

      userRefRef.current = userDbRef;
      userCallbackRef.current = handleUserValue;
      onValue(userDbRef, handleUserValue);

      if (record?.user?.isActive === false) {
        blockedHandledRef.current = true;
        await showBlockedNotice(schoolKey);
      }
    };

    void startWatcher();

    return () => {
      mounted = false;
      cleanupUserListener();
    };
  }, [authState, cleanupUserListener, isLoginRoute]);

  const shouldHoldRoute =
    authState === "checking" ||
    (authState === "authenticated" && isLoginRoute) ||
    ((authState === "unauthenticated" || authState === "blocked") && !isLoginRoute);
  const showLaunchSplash = shouldHoldRoute || !minimumSplashElapsed;

  useEffect(() => {
    if (!showLaunchSplash) {
      hideNativeSplash();
    }
  }, [hideNativeSplash, showLaunchSplash]);

  return (
    <ParentThemeProvider>
      <View style={styles.root}>
        <View
          pointerEvents={showLaunchSplash ? "none" : "auto"}
          style={showLaunchSplash ? styles.hiddenRouteLayer : styles.routeLayer}
        >
          <Slot />
        </View>
        {showLaunchSplash ? (
          <View onLayout={hideNativeSplash} style={styles.splashLayer}>
            <AppLaunchSplash />
          </View>
        ) : null}
        <BlockedAccountModal
          visible={!showLaunchSplash && blockedNotice.visible}
          message={BLOCKED_ACCOUNT_MESSAGE}
          caption={getBlockedContactCaption(blockedNotice)}
          onPrimaryPress={openSchoolDialer}
          onSecondaryPress={handleBlockedLogout}
          primaryDisabled={!blockedNotice.phone && !blockedNotice.phoneLabel}
          secondaryLabel="Go to Login"
        />
      </View>
    </ParentThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  routeLayer: {
    flex: 1,
  },
  hiddenRouteLayer: {
    flex: 1,
    opacity: 0,
  },
  splashLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
