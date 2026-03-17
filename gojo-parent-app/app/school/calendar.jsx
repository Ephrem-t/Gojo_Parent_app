import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, get } from "firebase/database";
import { database } from "../../constants/firebaseConfig";

const PRIMARY = "#1E90FF";
const TEXT = "#0F172A";
const MUTED = "#64748B";

export default function CalendarTab() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);

  const getPathPrefix = async () => {
    const sk = (await AsyncStorage.getItem("schoolKey")) || null;
    return sk ? `Platform1/Schools/${sk}/` : "";
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const prefix = await getPathPrefix();
        const snap = await get(ref(database, `${prefix}CalendarEvents`));
        if (!mounted) return;

        if (!snap.exists()) {
          setEvents([]);
        } else {
          const arr = [];
          snap.forEach((child) => arr.push({ id: child.key, ...(child.val() || {}) }));
          arr.sort((a, b) => new Date(a.gregorianDate || 0) - new Date(b.gregorianDate || 0));
          setEvents(arr);
        }
      } catch (e) {
        console.warn("Calendar events load error:", e);
        setEvents([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events.filter((e) => {
      const d = new Date(e.gregorianDate || 0);
      d.setHours(0, 0, 0, 0);
      return d >= today;
    });
  }, [events]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>School Calendar</Text>
        <Text style={styles.cardSub}>Upcoming and important school events.</Text>
      </View>

      {upcoming.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No upcoming events.</Text>
        </View>
      ) : (
        <FlatList
          data={upcoming}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const dateLabel = item.gregorianDate
              ? new Date(item.gregorianDate).toLocaleDateString()
              : "No date";

            return (
              <View style={styles.eventCard}>
                <Text style={styles.eventTitle}>{item.title || "Event"}</Text>
                <Text style={styles.eventMeta}>
                  {dateLabel} • {item.category || item.type || "general"}
                </Text>
                {!!item.notes && <Text style={styles.eventNote}>{item.notes}</Text>}
                {item.ethiopianDate ? (
                  <Text style={styles.ethDate}>
                    ET: {item.ethiopianDate.day}/{item.ethiopianDate.month}/{item.ethiopianDate.year}
                  </Text>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: TEXT },
  cardSub: { fontSize: 13, color: MUTED, marginTop: 4 },
  emptyText: { color: MUTED, textAlign: "center", fontSize: 13 },

  eventCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  eventTitle: { fontSize: 15, fontWeight: "700", color: TEXT },
  eventMeta: { fontSize: 12, color: MUTED, marginTop: 3 },
  eventNote: { fontSize: 13, color: TEXT, marginTop: 6 },
  ethDate: { fontSize: 12, color: "#475569", marginTop: 6 },
});