import { Slot, usePathname, useRouter } from "expo-router";
import { addNetworkStateListener } from "expo-network";
import { off, onValue, ref } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import BlockedAccountModal from "../components/ui/BlockedAccountModal";
import { database } from "../constants/firebaseConfig";
import { ParentThemeProvider } from "../hooks/use-parent-theme";
import { flushQueuedPostActions } from "./lib/postActionQueue";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  clearParentSession,
  getBlockedContactCaption,
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

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const userRefRef = useRef(null);
  const userCallbackRef = useRef(null);
  const blockedHandledRef = useRef(false);
  const [blockedNotice, setBlockedNotice] = useState(EMPTY_NOTICE);

  const cleanupUserListener = () => {
    if (userRefRef.current && userCallbackRef.current) {
      try {
        off(userRefRef.current, "value", userCallbackRef.current);
      } catch {}
    }

    userRefRef.current = null;
    userCallbackRef.current = null;
  };

  const showBlockedNotice = async (schoolKey = null) => {
    const contact = await getSchoolContactInfo(schoolKey);
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

    const startWatcher = async () => {
      if (pathname === "/") {
        cleanupUserListener();
        blockedHandledRef.current = false;
        return;
      }

      const session = await readParentSession();
      if (!mounted) return;

      if (String(session.role || "").toLowerCase() !== "parent") {
        cleanupUserListener();
        blockedHandledRef.current = false;
        return;
      }

      const record = await getParentUserRecord(session);
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

      const handleUserValue = (snap) => {
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
  }, [pathname]);

  return (
    <ParentThemeProvider>
      <Slot />
      <BlockedAccountModal
        visible={blockedNotice.visible}
        message={BLOCKED_ACCOUNT_MESSAGE}
        caption={getBlockedContactCaption(blockedNotice)}
        onPrimaryPress={openSchoolDialer}
        onSecondaryPress={handleBlockedLogout}
        primaryDisabled={!blockedNotice.phone && !blockedNotice.phoneLabel}
        secondaryLabel="Go to Login"
      />
    </ParentThemeProvider>
  );
}
