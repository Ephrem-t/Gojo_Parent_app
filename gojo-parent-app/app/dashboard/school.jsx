import React, { useEffect, useState, useRef } from "react";
import { View, Text, Image, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Animated, Modal, Pressable, Dimensions } from "react-native";
import { ref, get } from "firebase/database";
import { database } from "../../constants/firebaseConfig";
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRouter } from "expo-router";

const PALETTE = {
  background: "#f5f7fb",
  surface: "#ffffff",
  card: "#ffffff",
  accent: "#2563eb",
  muted: "#6b7280",
  text: "#0f172a",
  border: "#e5e7eb",
  shadow: "rgba(15, 23, 42, 0.08)",
};

export default function SchoolScreen() {
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [detailsAnim] = useState(new Animated.Value(0));
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const router = useRouter();

  // Skeleton shimmer animation (attendance style)
  const skeletonAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.timing(skeletonAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
        easing: Animated.Easing ? Animated.Easing.linear : undefined,
      })
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [skeletonAnim]);

  const renderShimmer = (style) => {
    const translateX = skeletonAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-60, 200],
    });
    return (
      <View style={[{ backgroundColor: '#e3e7ef', borderRadius: 8, overflow: 'hidden' }, style]}>
        <Animated.View
          style={{
            backgroundColor: '#f5f7fb',
            opacity: 0.7,
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            transform: [{ translateX }],
          }}
        />
      </View>
    );
  };

  const renderSkeleton = () => (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
        {/* Header skeleton */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          {renderShimmer({ width: 74, height: 74, borderRadius: 37, marginRight: 16 })}
          <View style={{ flex: 1 }}>
            {renderShimmer({ height: 18, width: '70%', marginBottom: 10 })}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {renderShimmer({ height: 22, width: 90, borderRadius: 12, marginRight: 8 })}
              {renderShimmer({ height: 22, width: 90, borderRadius: 12 })}
            </View>
          </View>
        </View>
        {/* Metrics row skeleton */}
        <View style={{ flexDirection: 'row', marginBottom: 18 }}>
          {renderShimmer({ height: 60, flex: 1, borderRadius: 12, marginRight: 8 })}
          {renderShimmer({ height: 60, flex: 1, borderRadius: 12, marginRight: 8 })}
          {renderShimmer({ height: 60, flex: 1, borderRadius: 12 })}
        </View>
        {/* Info rows skeleton */}
        {[1,2,3,4].map(i => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
            {renderShimmer({ height: 14, width: '30%', borderRadius: 8 })}
            {renderShimmer({ height: 14, width: '50%', borderRadius: 8 })}
          </View>
        ))}
        {/* Gallery skeleton */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
          {renderShimmer({ width: 140, height: 180, borderRadius: 16 })}
          {renderShimmer({ width: 140, height: 180, borderRadius: 16 })}
        </View>
      </ScrollView>
    </View>
  );

  useEffect(() => {
    // Fetch school info and admins
    const fetchSchoolAndAdmins = async () => {
      try {
        // Fetch school info (use correct key 'Guda Miju')
        const schoolSnap = await get(ref(database, 'schools/Guda Miju/info'));
        setSchool(schoolSnap.val());

        // Fetch all school admins for this school
        const adminsSnap = await get(ref(database, 'School_Admins'));
        const adminsData = adminsSnap.exists() ? adminsSnap.val() : {};
        // Filter admins for this school if needed (assuming adminId is enough, or add schoolId if available)
        // Build a list of admin objects with userId and title
        const adminListRaw = Object.entries(adminsData)
          .filter(([key, a]) => a.userId)
          .map(([key, a]) => ({ dbKey: key, userId: a.userId, title: a.title || '' }));

        // Fetch user info for each admin and merge with title
        const usersSnap = await get(ref(database, 'Users'));
        const usersData = usersSnap.exists() ? usersSnap.val() : {};
        const adminUserList = adminListRaw.map(admin => {
          const user = usersData[admin.userId];
          return user ? {
            dbKey: admin.dbKey,
            userId: admin.userId,
            name: user.name,
            email: user.username,
            phone: user.phone || '',
            profileImage: user.profileImage || '',
            title: admin.title,
          } : null;
        }).filter(Boolean);
        setAdminUsers(adminUserList);
      } catch (e) {
        setAdminUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSchoolAndAdmins();
  }, []);

  if (loading) {
    return renderSkeleton();
  }

  if (!school) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}> 
        <Text style={styles.title}>School Info Not Found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>

      {/* Cover Image with overlapping logo */}
      <View style={styles.coverContainer}>
        {school.coverImageUrl ? (
          <Image source={{ uri: school.coverImageUrl }} style={styles.coverImage} />
        ) : null}
        {school.logoUrl ? (
          <View style={styles.logoOverlapWrapper}>
            <Image source={{ uri: school.logoUrl }} style={styles.logoOverlap} />
          </View>
        ) : null}
      </View>

      {/* Collapsible Info Card */}
      <TouchableOpacity
        style={styles.infoCard}
        activeOpacity={0.85}
        onPress={() => {
          if (!expanded) {
            setExpanded(true);
            Animated.timing(detailsAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: false,
            }).start();
          } else {
            Animated.timing(detailsAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: false,
            }).start(() => setExpanded(false));
          }
        }}
      >
        <View style={styles.infoCardHeader}>
          <InfoRow label="School Name" value={school.name} boldValue />
          
          <InfoRow label="Email" value={school.email} />
          <InfoRow label="Phone" value={school.phone} />
          <InfoRow label="Academic Year" value={school.academicYear} />
        </View>
        <View style={styles.infoCardDivider} />
        {/* Collapsible details */}
        {expanded && (
          <Animated.View
            style={[
              styles.infoCardDropdown,
              {
                opacity: detailsAnim,
                height: detailsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 340],
                }),
                overflow: 'hidden',
              },
            ]}
          >
          
            <InfoRow label="Address" value={school.address} />
            <InfoRow label="City" value={school.city} />
            <InfoRow label="Level" value={school.level} />
            <InfoRow label="Language" value={school.language} />
            <InfoRow label="Short Name" value={school.shortName} />
         
            <InfoRow label="Academic Year" value={school.academicYear} />
            <InfoRow label="Region" value={school.region} />
            <InfoRow label="Ownership" value={school.ownership} />
            <InfoRow label="Alternative Phone" value={school.alternativePhone} />
            <InfoRow label="Created At" value={school.createdAt ? new Date(school.createdAt).toLocaleDateString() : ''} />
          
          </Animated.View>
        )}
        <Text style={styles.dropHint}>{expanded ? 'Tap to hide details ▲' : 'Tap to show more ▼'}</Text>
      </TouchableOpacity>
  

      {/* Gallery */}
      {school.gallery && (
        <View style={styles.gallerySection}>
          <Text style={styles.sectionTitle}>Gallery</Text>
          <ScrollView
            style={{ width: '100%' }}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryRow}
          >
            {Object.values(school.gallery).map((url, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  setSelectedImage(url);
                  setModalVisible(true);
                }}
                activeOpacity={0.85}
              >
                <Image source={{ uri: url }} style={styles.galleryImg} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* School Management List */}
      {adminUsers.length > 0 && (
        <View style={styles.adminSection}>
          <Text style={styles.sectionTitle}>School Management</Text>
          {adminUsers.map((admin, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.childCard}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/chat', params: { userId: admin.dbKey, name: admin.name, email: admin.email, phone: admin.phone, profileImage: admin.profileImage, title: admin.title } })}
            >
              <Image
                source={{ uri: admin.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.name)}` }}
                style={styles.childImage}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.childName}>{admin.name}</Text>
                {admin.title ? (
                  <Text style={[styles.childDetails, { fontSize: 15 }]}>{admin.title}</Text>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  style={styles.messageBtn}
                  onPress={() => router.push({ pathname: '/chat', params: { userId: admin.userId, name: admin.name } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${admin.name}`}
                  disabled={!admin.userId}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1e90ff" />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Fullscreen Modal for Gallery Image */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullscreenImg}
              resizeMode="contain"
            />
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ label, value, boldValue }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, boldValue && { fontWeight: 'bold', fontSize: 16 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
        adminSection: {
          marginHorizontal: 16,
          marginTop: 18,
          marginBottom: 10,
        },
  // --- Copied from profile.jsx for exact match ---
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowColor: PALETTE.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  childImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: PALETTE.border,
    resizeMode: 'cover',
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  childName: { fontSize: 16, marginTop: -20, fontWeight: "700", color: PALETTE.text },
  childDetails: { fontSize: 13, color: PALETTE.muted, marginTop: 2 },
  // --- End copied styles ---
      modalOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
      },
      modalContent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgb(0, 0, 0)',
        borderRadius: 18,
        margin: 16,
      },
      fullscreenImg: {
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
        maxWidth: '100%',
        maxHeight: '100%',
      },
      closeButton: {
        position: 'absolute',
        top: 40,
        right: 30,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 20,
        padding: 8,
        zIndex: 101,
      },
      closeButtonText: {
        color: '#fff',
        fontSize: 26,
        fontWeight: 'bold',
      },
    infoCardDropdown: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      paddingTop: 8,
      backgroundColor: 'rgba(245,247,251,0.93)',
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
    },
  container: {
    flex: 1,
    backgroundColor: PALETTE.background,
  },
  coverContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    marginBottom: 20,
  },
  coverImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  logoOverlapWrapper: {
    position: 'absolute',
    left: 24,
    bottom: -20,
    backgroundColor: '#fff',
    borderRadius: 50,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  logoOverlap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#eee',
  },
  nameBlock: {
    marginLeft: 120,
    marginTop: -24,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PALETTE.text,
  },
  shortName: {
    fontSize: 16,
    color: PALETTE.muted,
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: PALETTE.card,
    marginHorizontal: 6, // reduced for wider card
    marginTop: 5,
    marginBottom: 28, // increased to prevent cut-off
    borderRadius: 18,
    padding: 0,
    overflow: 'visible', // allow dropHint to show fully
    borderWidth: 1.5,
    borderColor: '#e3e7ef',
    shadowColor: '#1e293b',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 24,
    elevation: 8,
  },
  infoCardHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: 'rgba(245,247,251,0.97)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  infoCardDivider: {
    height: 1.5,
    backgroundColor: '#e3e7ef',
    marginHorizontal: 16,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  infoLabel: {
    color: PALETTE.muted,
    fontSize: 14,
  },
  infoValue: {
    color: PALETTE.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  gallerySection: {
    marginHorizontal: 16,
    marginTop: -10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
    color: PALETTE.text,
  },
  galleryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dropHint: {
    textAlign: 'center',
    color: PALETTE.muted,
    fontSize: 13,
    marginTop: 8,
    marginBottom: 12, // more space below
    fontStyle: 'italic',
  },
  galleryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 16,
  },
  galleryImg: {
    width: 140,
    height: 180,
    borderRadius: 16,
    backgroundColor: '#eee',
    marginRight: 0
  },
  messageBtn: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(29, 155, 240, 0.1)',
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    width: 32,
  },
});
