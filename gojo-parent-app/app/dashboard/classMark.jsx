import { useEffect, useState } from "react";
import { useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ref, get } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { database } from "../../constants/firebaseConfig";

export default function ClassMark() {
  const [parentId, setParentId] = useState(null);
  const [children, setChildren] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [childUser, setChildUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [marks, setMarks] = useState({});
  const [showList, setShowList] = useState(false);
  const [cache, setCache] = useState({});
  const [expanded, setExpanded] = useState({}); // 🔽 expand state
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState('semester1');

  const shimmerAnim = useRef(new Animated.Value(-120)).current;
  const detailsAnim = useRef({}).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const dropdownOpacity = useRef(new Animated.Value(0)).current;
  const dropdownTrans = useRef(new Animated.Value(-10)).current;

  // Responsive breakpoints
  const { width, height } = useWindowDimensions();
  const isSmall = width < 360;
  const isMedium = width >= 360 && width < 400;
  const isTablet = width >= 768;
  const scale = isSmall ? 0.9 : isMedium ? 0.95 : isTablet ? 1.1 : 1.0;
  const fontScale = isSmall ? 0.92 : isMedium ? 0.97 : isTablet ? 1.08 : 1.0;
  const avatarSize = isSmall ? 64 : isTablet ? 84 : Math.round(74 * scale);
  const headerPadding = Math.round(22 * scale);
  const headerRadius = Math.round(20 * scale);
  const headerMinH = isSmall ? 120 : isTablet ? 140 : 130;
  const headerChevronSize = isSmall ? 18 : isTablet ? 22 : 20;
  const dropdownTop = headerPadding + avatarSize + Math.round(24 * scale);
  const dropdownMaxH = Math.min(Math.round(height * 0.5), 360);
  const percentMinWidth = isSmall ? Math.round(72 * scale) : Math.round(80 * scale);
  const percentPadH = Math.round(12 * scale);
  const percentPadV = isSmall ? Math.round(6 * scale) : Math.round(8 * scale);
  const progressHeight = Math.max(6, isSmall ? Math.round(6 * scale) : Math.round(8 * scale));
  const cardPad = Math.round(18 * scale);
  const cardRadius = Math.round(16 * scale);
  const metaIconSize = isSmall ? 14 : 16;
  const arrowIconSize = isSmall ? 16 : isTablet ? 20 : 18;
  const chipPadH = isSmall ? 8 : Math.round(10 * scale);
  const chipPadV = isSmall ? 4 : Math.round(6 * scale);
  const pillPadH = isSmall ? 10 : Math.round(12 * scale);
  const pillPadV = isSmall ? 8 : Math.round(10 * scale);
  const router = useRouter();

  const defaultProfile =
    "https://cdn-icons-png.flaticon.com/512/847/847969.png";

  /* ---------------- LOAD PARENT ID ---------------- */
  useEffect(() => {
    AsyncStorage.getItem("parentId").then((id) => {
      if (id) setParentId(id);
    });
  }, []);

  // Shimmer animation loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 220,
          duration: 1100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: -120,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  // Animate backdrop and dropdown on open
  useEffect(() => {
    if (showList) {
      backdropOpacity.setValue(0);
      dropdownOpacity.setValue(0);
      dropdownTrans.setValue(-10);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(dropdownOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(dropdownTrans, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      dropdownOpacity.setValue(0);
      dropdownTrans.setValue(-10);
    }
  }, [showList]);

  /* ---------------- LOAD ALL DATA ---------------- */
  useEffect(() => {
    if (!parentId) return;

    const loadData = async () => {
      setLoading(true);
      const [
        parentsSnap,
        studentsSnap,
        usersSnap,
        coursesSnap,
        marksSnap,
        teachersSnap,
        assignSnap,
      ] = await Promise.all([
        get(ref(database, "Parents")),
        get(ref(database, "Students")),
        get(ref(database, "Users")),
        get(ref(database, "Courses")),
        get(ref(database, "ClassMarks")),
        get(ref(database, "Teachers")),
        get(ref(database, "TeacherAssignments")),
      ]);

      const data = {
        parents: parentsSnap.val() || {},
        students: studentsSnap.val() || {},
        users: usersSnap.val() || {},
        courses: coursesSnap.val() || {},
        marks: marksSnap.val() || {},
        teachers: teachersSnap.val() || {},
        assignments: assignSnap.val() || {},
      };

      setCache(data);

      const parent = data.parents[parentId];
      const kids = parent?.children ? Object.values(parent.children) : [];
      setChildren(kids);

      if (kids.length > 0) loadChild(kids[0], 0, data);
      setLoading(false);
    };

    loadData();
  }, [parentId]);

  /* ---------------- LOAD CHILD ---------------- */
  const loadChild = (child, index, data) => {
    const student = data.students[child.studentId];
    if (!student) return;

    const user = data.users[student.userId];

    setChildUser({
      ...user,
      grade: student.grade,
      section: student.section,
      studentId: child.studentId,
    });

    const courseList = Object.keys(data.courses)
      .map((id) => ({ courseId: id, ...data.courses[id] }))
      .filter(
        (c) => c.grade === student.grade && c.section === student.section
      )
      .map((course) => {
        const assign = Object.values(data.assignments).find(
          (a) => a.courseId === course.courseId
        );
        const teacherId = assign ? assign.teacherId : null;
        const teacherName = assign
          ? data.users[data.teachers[assign.teacherId]?.userId]?.name || "N/A"
          : "N/A";
        return { ...course, teacherName, teacherId };
      });

    setCourses(courseList);
    setMarks(data.marks || {});
    setExpanded({}); // reset expand on child change
    setCurrentIndex(index);
    setShowList(false);
  };

  /* ---------------- TOTAL MARK ---------------- */
  const calcTotal = (assessments) => {
    let score = 0;
    let max = 0;

    Object.values(assessments || {}).forEach((a) => {
      score += a.score || 0;
      max += a.max || 0;
    });

    return { score, max };
  };

  /* ---------------- TOGGLE EXPAND ---------------- */
  const toggleExpand = (courseId) => {
    setExpanded((prev) => {
      const nextOpen = !prev[courseId];
      const next = { ...prev, [courseId]: nextOpen };
      if (nextOpen) {
        if (!detailsAnim[courseId]) detailsAnim[courseId] = new Animated.Value(0);
        Animated.timing(detailsAnim[courseId], {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }
      return next;
    });
  };

  // ---------------- OVERALL METRICS (header) ----------------
  let overallScore = 0;
  let overallMax = 0;
  let assessmentsCount = 0;
  courses.forEach((course) => {
    const studentMarks = marks?.[course.courseId]?.[childUser?.studentId];
    if (!studentMarks?.assessments) return;
    Object.values(studentMarks.assessments).forEach((a) => {
      overallScore += a.score || 0;
      overallMax += a.max || 0;
      assessmentsCount += 1;
    });
  });
  const overallPercent = overallMax > 0 ? Math.round((overallScore / overallMax) * 100) : 0;
  const averagePoint = assessmentsCount > 0 ? Math.round(overallScore / assessmentsCount) : 0;
  const percentilePoint = overallPercent; // placeholder until real percentile data
  const overallRank = "--"; // placeholder until backend provides rank

  const renderShimmerBar = (width = "82%") => (
    <View style={styles.skeletonRow}>
      <View style={[styles.skeletonBox, { width }]}> 
        <Animated.View
          style={[
            styles.shimmer,
            {
              transform: [{ translateX: shimmerAnim }],
            },
          ]}
        />
      </View>
    </View>
  );

  // Attendance-style header skeleton shimmer
  const SkeletonHeader = () => {
    return (
      <View style={[styles.header, { padding: headerPadding, borderRadius: headerRadius, minHeight: headerMinH }]}> 
        <View style={styles.headerLeft}>
          <View style={styles.skeletonAvatar}>
            <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
          </View>
          <View style={styles.headerText}>
            <View style={[styles.skeletonBox, { width: "70%", height: 18, marginBottom: 10 }]}> 
              <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
            </View>
            <View style={styles.chipRow}>
              <View style={[styles.skeletonChip, { height: 22, width: 90, borderRadius: 12, marginRight: 8, marginBottom: 6 }]}> 
                <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
              </View>
              <View style={[styles.skeletonChip, { height: 22, width: 90, borderRadius: 12, marginBottom: 6 }]}> 
                <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
              </View>
            </View>
          </View>
        </View>
        <View style={[styles.headerMetricsRow, { marginTop: isSmall ? 8 : 14 }]}> 
          <View style={[styles.skeletonPill, { height: 60, flex: 1, borderRadius: 12, marginRight: 8 }]}> 
            <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
          </View>
          <View style={[styles.skeletonPill, { height: 60, flex: 1, borderRadius: 12, marginRight: 8 }]}> 
            <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
          </View>
          <View style={[styles.skeletonPill, { height: 60, flex: 1, borderRadius: 12 }]}> 
            <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
          </View>
        </View>
      </View>
    );
  };

  const SkeletonCard = () => (
    <View style={[styles.card, { padding: cardPad, borderRadius: cardRadius }]}>
      <View style={styles.courseHeader}>
        <View style={{ flex: 1 }}>
          <View style={[styles.skeletonBox, { width: "55%", height: 16 }]}> 
            <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
          </View>
          <View style={[styles.skeletonBox, { width: "40%", height: 12, marginTop: 8 }]}> 
            <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
          </View>
          <View style={styles.courseMetaRow}>
            <View style={[styles.skeletonChip, { width: 120, height: 24 }]}> 
              <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
            </View>
            <View style={[styles.skeletonChip, { width: 140, height: 24 }]}> 
              <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
            </View>
          </View>
        </View>
        <View style={styles.percentPill}>
          <View style={[styles.skeletonBox, { width: 60, height: 28 }]}> 
            <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
          </View>
        </View>
      </View>
      <View style={[styles.progressTrack, { height: progressHeight }]}> 
        <View style={[styles.skeletonBox, { height: "100%", width: "100%" }]}> 
          <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* ================= HEADER ================= */}
      <LinearGradient
        colors={["#f7f9fc", "#eef3ff"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { padding: headerPadding, borderRadius: headerRadius, minHeight: headerMinH }]}
      >
        {loading ? (
          <SkeletonHeader />
        ) : (
          <>
            <TouchableOpacity
              style={styles.headerLeft}
              onPress={() => setShowList(!showList)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: childUser?.profileImage || defaultProfile }}
                style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: Math.round(avatarSize / 2) }]}
              />

              <View style={styles.headerText}>
                <Text style={[styles.childName, { fontSize: Math.round(20 * fontScale) }]} numberOfLines={1}>
                  {childUser?.name || "Student"}
                </Text>
                <View style={styles.chipRow}>
                  <View style={[styles.chip, { paddingHorizontal: chipPadH, paddingVertical: chipPadV }]}>
                    <Text style={[styles.chipText, { fontSize: Math.round(13 * fontScale) }]}>Grade {childUser?.grade ?? "--"}</Text>
                  </View>
                  <View style={[styles.chip, { paddingHorizontal: chipPadH, paddingVertical: chipPadV }]}>
                    <Text style={[styles.chipText, { fontSize: Math.round(13 * fontScale) }]}>Section {childUser?.section ?? "--"}</Text>
                  </View>
                  {/* Semester Picker (always Semester 1 and 2) */}
                  <View style={[styles.chip, { paddingHorizontal: chipPadH, paddingVertical: chipPadV, flexDirection: 'row', alignItems: 'center', marginLeft: 6 }]}> 
                    <Text style={[styles.chipText, { fontSize: Math.round(13 * fontScale), color: '#2563eb', fontWeight: 'bold', marginRight: 6 }]}>Semester:</Text>
                    {['semester1', 'semester2'].map(sem => (
                      <TouchableOpacity
                        key={sem}
                        style={{
                          backgroundColor: selectedSemester === sem ? '#2563eb' : '#e5e7eb',
                          paddingHorizontal: 10,
                          paddingVertical: 3,
                          borderRadius: 12,
                          marginHorizontal: 2,
                        }}
                        onPress={() => setSelectedSemester(sem)}
                      >
                        <Text style={{ color: selectedSemester === sem ? '#fff' : '#1e293b', fontWeight: '700', fontSize: Math.round(13 * fontScale) }}>{sem === 'semester1' ? '1' : '2'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {children.length > 1 && (
                <Ionicons
                  name={showList ? "chevron-up" : "chevron-down"}
                  size={headerChevronSize}
                  color="#2563eb"
                  style={[styles.headerArrow, { marginTop: -50 * scale }]}
                />
              )}
            </TouchableOpacity>

            <View style={[styles.headerMetricsRow, { marginTop: isSmall ? 8 : 14 }]}>
              <View style={[styles.metricPillPrimary, { paddingHorizontal: pillPadH, paddingVertical: pillPadV }] }>
                <Text style={[styles.pillLabel, { fontSize: Math.round(12 * fontScale) }]}>Rank</Text>
                <Text style={[styles.pillValue, { fontSize: Math.round(16 * fontScale) }]}>{overallRank}</Text>
              </View>
              <View style={[styles.metricPill, { paddingHorizontal: pillPadH, paddingVertical: pillPadV }] }>
                <Text style={[styles.pillLabel, { fontSize: Math.round(12 * fontScale) }]}>Avg Point</Text>
                <Text style={[styles.pillValue, { fontSize: Math.round(16 * fontScale) }]}>{averagePoint}</Text>
              </View>
              <View style={[styles.metricPill, { paddingHorizontal: pillPadH, paddingVertical: pillPadV }] }>
                <Text style={[styles.pillLabel, { fontSize: Math.round(12 * fontScale) }]}>Percentile</Text>
                <Text style={[styles.pillValue, { fontSize: Math.round(16 * fontScale) }]}>{percentilePoint}%</Text>
              </View>
            </View>
          </>
        )}
      </LinearGradient>

      {loading && (
        <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      )}

      {!loading && children.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { fontSize: Math.round(17 * fontScale) }]}>No children linked yet</Text>
          <Text style={[styles.emptySubtitle, { fontSize: Math.round(14 * fontScale) }]}>
            Add your child to view their class marks and progress.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            activeOpacity={0.85}
            onPress={() => {
              try {
                router.push && router.push("/userProfile");
              } catch {}
              setShowList(false);
            }}
          >
            <Text style={[styles.emptyButtonText, { fontSize: Math.round(14 * fontScale) }]}>Add child</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ================= DROPDOWN ================= */}
      {children.length > 1 && showList && (
        <>
          <TouchableWithoutFeedback onPress={() => setShowList(false)}>
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
          </TouchableWithoutFeedback>

          <Animated.View style={[styles.dropdown, { top: dropdownTop, maxWidth: Math.min(460, width - 24), opacity: dropdownOpacity, transform: [{ translateY: dropdownTrans }] }]}>
            <View style={styles.dropdownHandle} />
            <View style={styles.dropdownHeader}>
              <View>
                <Text style={[styles.dropdownTitle, { fontSize: Math.round(16 * fontScale) }]}>Select your child</Text>
                <Text style={[styles.dropdownSubtitle, { fontSize: Math.round(12 * fontScale) }]}>
                  {children.length} profiles · Grade {childUser?.grade ?? "--"} / Section {childUser?.section ?? "--"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowList(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.dropdownClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={[styles.dropdownScroll, { maxHeight: dropdownMaxH }]} nestedScrollEnabled>
              {children.map((c, i) => {
                const s = cache.students?.[c.studentId];
                const u = cache.users?.[s?.userId];

                return (
                  <TouchableOpacity
                    key={c.studentId}
                    style={[
                      styles.dropdownItem,
                      currentIndex === i && styles.dropdownActive,
                      { paddingHorizontal: isSmall ? 8 : 10, paddingVertical: isSmall ? 10 : 12 }
                    ]}
                    onPress={() => loadChild(c, i, cache)}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri: u?.profileImage || defaultProfile }}
                      style={[styles.dropdownAvatar, { width: isSmall ? 36 : 40, height: isSmall ? 36 : 40, borderRadius: isSmall ? 18 : 20 }]}
                    />
                    <View style={styles.dropdownContent}>
                      <Text style={[styles.dropdownText, { fontSize: Math.round(15 * fontScale) }]} numberOfLines={1}>
                        {u?.name || "Student"}
                      </Text>
                      <Text style={[styles.dropdownMeta, { fontSize: Math.round(12 * fontScale) }]} numberOfLines={1}>
                        Grade {s?.grade ?? "--"} · Section {s?.section ?? "--"}
                      </Text>
                    </View>
                    <Ionicons
                      name={currentIndex === i ? "checkmark-circle" : "chevron-forward"}
                      size={18}
                      color={currentIndex === i ? "#2563eb" : "#94a3b8"}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </>
      )}

      {/* ================= BODY ================= */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: 16 }}>
        {courses.map((course) => {
          const courseMarks = marks?.[course.courseId] || {};
          const studentId = childUser?.studentId;
          const studentMarks = courseMarks[studentId] || {};
          const semMarks = studentMarks[selectedSemester];
          if (!semMarks) return null;

          // Calculate totals for header (only selected semester)
          let totalScore = 0, totalMax = 0, totalCount = 0;
          if (semMarks.assessments) {
            Object.values(semMarks.assessments).forEach((a) => {
              totalScore += a.score || 0;
              totalMax += a.max || 0;
              totalCount += 1;
            });
          }
          const percent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
          const isOpen = expanded[course.courseId];

          return (
            <View key={course.courseId} style={[styles.card, { padding: cardPad, borderRadius: cardRadius }] }>
              {/* 🔽 CLICKABLE COURSE HEADER */}
              <TouchableOpacity
                onPress={() => toggleExpand(course.courseId)}
                activeOpacity={0.7}
              >
                <View style={styles.courseHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.courseName, { fontSize: Math.round(16 * fontScale) }]}>{course.name}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (course.teacherId) {
                          // Find the teacher's userId from cache (like chat.jsx)
                          const teacherUserId = cache.teachers && cache.teachers[course.teacherId]?.userId;
                          router.push({
                            pathname: '/userProfile',
                            params: {
                              recordId: course.teacherId, // Teachers/<teacherId>
                              userId: teacherUserId,
                              roleName: 'Teacher',
                            },
                          });
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.teacher, { fontSize: Math.round(13 * fontScale) }]}> 
                        {course.teacherName}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.courseMetaRow}>
                      <View style={styles.metaPill}>
                        <Ionicons name="book-outline" size={metaIconSize} color="#1d4ed8" style={styles.metaIcon} />
                        <Text style={[styles.metaText, { fontSize: Math.round(12 * fontScale) }]}>{totalCount} marks</Text>
                      </View>
                      <View style={styles.metaPill}>
                        <Ionicons name="trophy-outline" size={metaIconSize} color="#ea580c" style={styles.metaIcon} />
                        <Text style={[styles.metaText, { fontSize: Math.round(12 * fontScale) }]}>Total {totalScore}/{totalMax}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.courseRight}>
                    <View style={[styles.percentPill, { minWidth: percentMinWidth, paddingHorizontal: percentPadH, paddingVertical: percentPadV }] }>
                      <Text style={[styles.percentValue, { fontSize: Math.round(17 * fontScale) }]}>{percent}%</Text>
                      <Text style={[styles.percentLabel, { fontSize: Math.round(11 * fontScale) }]}>Overall</Text>
                    </View>
                    <View style={styles.arrowBadge}>
                      <Ionicons
                        name={isOpen ? "chevron-up" : "chevron-down"}
                        size={arrowIconSize}
                        color="#2563eb"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${percent}%` }]} />
                </View>
              </TouchableOpacity>

              {/* 🔽 DETAILS */}
              {isOpen && (
                <View key={selectedSemester} style={{ marginTop: 8 }}>
                  <Text style={{ fontWeight: 'bold', marginBottom: 6 }}>
                    {selectedSemester === 'semester1' ? 'SEMESTER 1' : 'SEMESTER 2'}
                  </Text>
                  {semMarks.assessments ? (
                    Object.entries(semMarks.assessments).map(([assessKey, assess]) => (
                      <View key={assessKey} style={styles.row}>
                        <Text style={[styles.assessName, { fontSize: Math.round(14 * fontScale) }]}>{assess.name}</Text>
                        <Text style={[styles.assessScore, { fontSize: Math.round(14 * fontScale) }]}>{assess.score} / {assess.max}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: '#888', fontStyle: 'italic' }}>No assessments found</Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },

  header: {
    backgroundColor: "#ffffff",
    marginHorizontal: 8,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 20,
    padding: 22,
    elevation: 8,
    minHeight: 150,
    zIndex: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  skeletonContainer: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 6,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  skeletonRow: { marginBottom: 12 },
  skeletonBox: {
    height: 18,
    backgroundColor: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },
  skeletonAvatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#e5e7eb",
    marginRight: 16,
    overflow: "hidden",
  },
  skeletonChip: {
    height: 24,
    minWidth: 90,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
    marginRight: 8,
    marginBottom: 6,
    overflow: "hidden",
  },
  skeletonPill: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
    marginRight: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 120,
    backgroundColor: "rgba(255,255,255,0.55)",
  },

  emptyState: {
    marginHorizontal: 12,
    marginTop: 12,
    padding: 18,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "flex-start",
    gap: 8,
    elevation: 4,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  emptySubtitle: { fontSize: 14, color: "#64748b", lineHeight: 20 },
  emptyButton: {
    marginTop: 6,
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.57)",
    zIndex: 50,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 78, height: 78, borderRadius: 39, marginRight: 16 },
  headerText: { flex: 1, marginLeft: 4, paddingTop: 4 },
  childName: { fontSize: 20, fontWeight: "800", color: "#0f172a", letterSpacing: -0.2 },
  gradeText: { fontSize: 15, color: "#475569", marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  chip: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 6,
  },
  chipText: { fontSize: 13, color: "#0f172a", fontWeight: "600" },
  arrow: { color: "#2563eb", marginLeft: 8 },
  headerArrow: { color: "#2563eb", marginLeft: 8, marginTop: -50 },

  dropdown: {
    position: "absolute",
    top: 104,
    alignSelf: "center",
    width: "94%",
    maxWidth: 460,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    elevation: 14,
    zIndex: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  dropdownHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    marginBottom: 10,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  dropdownClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  dropdownTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", letterSpacing: -0.2 },
  dropdownSubtitle: { fontSize: 12, color: "#64748b", marginTop: 2 },
  dropdownScroll: { maxHeight: 280, paddingVertical: 4 },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    marginTop: 6,
  },
  dropdownActive: { backgroundColor: "#eef2ff", borderColor: "#cbd5e1" },
  dropdownAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: "#e2e8f0",
  },
  dropdownContent: { flex: 1, maxWidth: "72%" },
  dropdownText: { fontSize: 15, fontWeight: "700", color: "#0f172a", letterSpacing: -0.1 },
  dropdownMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  courseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  courseName: { fontSize: 16, fontWeight: "800", color: "#0f172a", letterSpacing: -0.1 },
  teacher: { fontSize: 13, color: "#64748b", marginBottom: 8, marginTop: 2 },

  courseMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
  },
  metaIcon: { marginRight: 6 },
  metaText: { fontSize: 12.5, color: "#0f172a", fontWeight: "600", letterSpacing: -0.05 },

  courseRight: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    gap: 6,
    marginLeft: 10,
  },
  percentPill: {
    backgroundColor: "#eef2ff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "flex-end",
    minWidth: 80,
  },
  percentValue: { fontSize: 17, fontWeight: "800", color: "#1d4ed8", letterSpacing: -0.2 },
  percentLabel: { fontSize: 11, color: "#475569", marginTop: 2 },
  arrowBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e0ecff",
    alignItems: "center",
    justifyContent: "center",
  },

  progressTrack: {
    marginTop: 12,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },

  totalBoxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  metricPill: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  metricPillPrimary: {
    flex: 1,
    backgroundColor: "#e0f2fe",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  pillLabel: { fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: "600" },
  pillValue: { fontSize: 16, fontWeight: "800", color: "#0f172a" },

  headerMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  assessName: { fontSize: 14 },
  assessScore: { fontSize: 14, fontWeight: "600" },
});
