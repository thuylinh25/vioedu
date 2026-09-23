"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Session as AuthSession } from "@supabase/supabase-js";
import {
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, ExternalLink,
  Eye, EyeOff, Home, LogOut, Pencil, Plus, Settings, Trash2, User, UsersRound, WifiOff, X,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "../lib-supabase-client";
import {
  WEEKDAYS, addDays, addMonths, dateKey, dateLabel, endOf, fmt12, minutesOf,
  monthLabel, monthWeeks, pad, to12, to24, weekDays, weekLabel,
} from "./lib-time";
import { ConfirmDialog, ConfirmState, EmptyState, RowMenu, Sheet, Skeleton, Toast, ToastStack } from "./ui";
import { FacebookIcon, GoogleIcon } from "./BrandIcons";

type Group = { id: string; name: string; owner_id: string };
type Member = { id: string; group_id: string; name: string; user_id?: string | null };
/** Một tài khoản đã đăng nhập, đọc từ bảng public.profiles. */
type Profile = { id: string; email: string | null; full_name: string | null; avatar_url: string | null };
/** Một học sinh đã tồn tại ở đâu đó trong các nhóm — nguồn duy nhất của tên học sinh. */
type Student = { name: string; user_id: string | null };
type Session = {
  id: number; date: string; memberId: string | null;
  memberName: string; time: string; duration: number; done: boolean;
};
/** Hàng schedules trả về từ Supabase, kèm tên học sinh lấy qua quan hệ. */
type ScheduleRow = {
  id: number; study_date: string; member_id: string | null; student_name: string | null;
  start_time: string; duration: number; done: boolean;
  // Quan hệ một-một, nhưng kiểu suy ra từ supabase-js là mảng, nên nhận cả hai dạng.
  group_members?: { name: string } | { name: string }[] | null;
};
type Tab = "home" | "people" | "stats" | "settings";
type OAuthProvider = "google" | "facebook";

const OAUTH: { id: OAuthProvider; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "facebook", label: "Facebook", Icon: FacebookIcon },
];

/** Supabase returns operator-facing strings; show people something they can act on. */
function friendlyAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.";
  if (m.includes("email not confirmed")) return "Email chưa được xác nhận. Hãy kiểm tra hộp thư và xác nhận trước khi đăng nhập.";
  if (m.includes("user already registered") || m.includes("already been registered")) return "Email này đã có tài khoản. Hãy đăng nhập thay vì đăng ký.";
  // Độ dài tối thiểu do Supabase cấu hình, không do ứng dụng đặt ra, nên đừng nói ra một con số có thể sai.
  if (m.includes("password should be at least") || m.includes("password is too short")) return "Máy chủ từ chối vì mật khẩu quá ngắn.";
  if (m.includes("unable to validate email") || m.includes("invalid email")) return "Địa chỉ email không hợp lệ.";
  // Hạn mức thư khác hẳn hạn mức đăng nhập: nó là quota gửi mail của dự án,
  // người dùng có đợi cũng không tự hết nếu vẫn bật xác nhận email.
  if (m.includes("email rate limit")) return "Dự án đã hết hạn mức gửi email xác nhận. Tắt \"Confirm email\" trong Supabase, hoặc đợi khoảng một giờ.";
  if (m.includes("rate limit") || m.includes("too many requests")) return "Bạn đã thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Không kết nối được máy chủ. Kiểm tra kết nối mạng rồi thử lại.";
  return "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.";
}

const TABS: { id: Tab; icon: typeof Home; label: string }[] = [
  { id: "home", icon: Home, label: "Lịch" },
  { id: "people", icon: UsersRound, label: "Học sinh" },
  { id: "stats", icon: CalendarDays, label: "Tiến độ" },
  { id: "settings", icon: Settings, label: "Cài đặt" },
];
const TAB_TITLE: Record<Tab, string> = { home: "Lịch học", people: "Học sinh", stats: "Tiến độ", settings: "Cài đặt" };
const DURATIONS = [20, 30, 45, 60, 90];
/** Thời điểm bắt đầu của một buổi, để so với hiện tại. */
const startsAt = (s: { date: string; time: string }) => new Date(`${s.date}T${s.time}`).getTime();
/** Chữ viết tắt cho avatar: hai từ cuối của tên, vì tên tiếng Việt để họ trước
 *  và "Trần Thanh Phong" được gọi là "Thanh Phong" → TP. Tên một từ thì một chữ. */
function initials(name: string): string {
  const words = name.trim().split(" ").filter(Boolean);
  if (words.length === 0) return "";
  return words.slice(-2).map((w) => w[0]!.toUpperCase()).join("");
}
const subscribeOnline = (cb: () => void) => {
  addEventListener("online", cb);
  addEventListener("offline", cb);
  return () => { removeEventListener("online", cb); removeEventListener("offline", cb); };
};
/** Trang VioEdu mở ra từ menu tài khoản và từ nút "Học ngay". */
const VIOEDU_URL = "https://vio.edu.vn/";
/** New schedules open at 07:00, so the picker shows AM by default. */
const DEFAULT_TIME = "07:00";
const SCHEDULE_COLS = "id,student_name,study_date,start_time,duration,done,member_id,group_members(name)";
/** user_id chỉ tồn tại sau khi chạy supabase-profiles.sql; trước đó dùng bộ cột cũ. */
const MEMBER_COLS = "id,group_id,name,user_id";
const MEMBER_COLS_LEGACY = "id,group_id,name";

const field = "w-full rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const primaryBtn = "min-h-[48px] w-full rounded-2xl bg-indigo-600 px-4 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";

/** Ảnh đại diện tài khoản. Kích thước do lớp cha quyết định, nên cùng một
 *  component dùng được cho cả nút trên header lẫn hàng trong menu. */
function AccountAvatar({ name, email, tone, className = "" }: {
  name: string; email: string; tone: "onPurple" | "onWhite"; className?: string;
}) {
  const initial = initials(name) || (email.trim()[0] ?? "").toUpperCase();
  // Màu nền phải đi theo nền đặt avatar lên: chữ trắng trên nền trắng thì mất hút.
  const fallback = tone === "onPurple" ? "bg-white/25 text-white" : "bg-indigo-100 text-indigo-700";
  return (
    <span className={`shrink-0 grid place-items-center rounded-full font-extrabold ${fallback} ${className}`}>
      {initial || <User size={18} />}
    </span>
  );
}

/** Hour / minute / AM-PM selects. AM is always listed before PM, unlike the
 *  browser's native time input where the order follows the current value. */
function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const v = to12(value);
  const cell = `${field} text-center font-semibold`;
  return (
    <div className="grid grid-cols-3 gap-2">
      <select aria-label="Giờ" className={cell} value={v.h} onChange={(e) => onChange(to24(+e.target.value, v.m, v.ap))}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{pad(h)}</option>)}
      </select>
      <select aria-label="Phút" className={cell} value={v.m} onChange={(e) => onChange(to24(v.h, +e.target.value, v.ap))}>
        {Array.from({ length: 60 }, (_, i) => i).map((m) => <option key={m} value={m}>{pad(m)}</option>)}
      </select>
      <select aria-label="Buổi" className={cell} value={v.ap} onChange={(e) => onChange(to24(v.h, v.m, e.target.value))}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export default function VioEduApp() {
  const today = useMemo(() => new Date(), []);
  // Trạng thái mạng thuộc về trình duyệt, không phải state của React; đọc thẳng
  // từ nguồn thay vì đồng bộ lại bằng useEffect. Giá trị khi dựng sẵn ở máy chủ là true.
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [selectedDate, setSelectedDate] = useState(today);
  const [tab, setTab] = useState<Tab>("home");
  const [calView, setCalView] = useState<"week" | "month">("week");

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userProviders, setUserProviders] = useState<string[]>([]);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  /** Nguyên văn lỗi từ Supabase, hiện kèm khi câu tiếng Việt không nói được nguyên nhân. */
  const [authDetail, setAuthDetail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesError, setProfilesError] = useState("");
  /** user_id → tên học sinh mà tài khoản đó đang mang trong các nhóm. */
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  /** Mọi học sinh đã có trong bất kỳ nhóm nào, không trùng tên. */
  const [knownStudents, setKnownStudents] = useState<Student[]>([]);
  /** group_id → tên các học sinh trong nhóm, dựng từ chính lần quét của loadGroups. */
  const [groupStudentNames, setGroupStudentNames] = useState<Record<string, string[]>>({});
  const [countsFailed, setCountsFailed] = useState(false);
  /** true khi lần quét group_members đã xong. Trước đó chưa biết tài khoản này
   *  đã có hồ sơ học sinh hay chưa, nên chưa được phép hỏi lại. */
  const [indexReady, setIndexReady] = useState(false);
  /** Các hồ sơ học sinh gắn trực tiếp với tài khoản đang đăng nhập. */
  const [selfMembers, setSelfMembers] = useState<Member[]>([]);
  /** false khi cơ sở dữ liệu chưa có group_members.user_id. */
  const [linkSupported, setLinkSupported] = useState(true);
  const [onboardDone, setOnboardDone] = useState(false);
  const [onboard, setOnboard] = useState<{ name: string; groupId: string }>({ name: "", groupId: "" });
  const [onboardError, setOnboardError] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  /** user_id của học sinh đang được liên kết, để chỉ khoá đúng hàng đó. */
  const [linkingId, setLinkingId] = useState("");
  const [studentDetail, setStudentDetail] = useState<Member | null>(null);
  /** id của học sinh đang lọc trên màn Lịch; rỗng là xem cả nhóm. */
  const [studentFilter, setStudentFilter] = useState("");
  const [moveForm, setMoveForm] = useState<{ member: Member; targetId: string } | null>(null);
  const [groupDelete, setGroupDelete] = useState<{ group: Group; targetId: string } | null>(null);
  const [groupForm, setGroupForm] = useState<{ mode: "create" | "rename"; id?: string; name: string; fromOnboarding?: boolean } | null>(null);
  const [memberForm, setMemberForm] = useState<{ id: string | null; name: string; step2?: boolean } | null>(null);
  const [scheduleForm, setScheduleForm] = useState<{ id: number | null; memberId: string; time: string; duration: number } | null>(null);

  /** Guards against a slow response for group A landing after the user switched to B. */
  const loadToken = useRef(0);
  const memberCols = useRef(MEMBER_COLS);
  const loadedUser = useRef<string | null>(null);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((v) => [...v, { id, text, tone }]);
    setTimeout(() => setToasts((v) => v.filter((t) => t.id !== id)), 4000);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((v) => v.filter((t) => t.id !== id)), []);

  const currentGroup = groups.find((g) => g.id === groupId) ?? null;
  // Hồ sơ học sinh của chính tài khoản này, và (các) nhóm chứa nó. Cả lối tắt
  // trên menu avatar lẫn nhãn "Nhóm của bạn" đều đọc từ đây, nên không thể lệch nhau.
  const selfMember = selfMembers[0] ?? null;
  const selfGroupIds = new Set(selfMembers.map((m) => m.group_id));
  // Tên hiển thị của tài khoản: nếu tài khoản này chính là một học sinh thì lấy
  // tên học sinh, để chữ cái trên avatar khớp với thẻ học sinh của cùng người.
  const accountName = selfMember?.name || userName;

  // Tài khoản chưa có mặt trong nhóm đang mở. Lọc cả theo tên, vì khi cơ sở dữ
  // liệu chưa có cột user_id thì tên là căn cứ duy nhất để tránh thêm trùng.
  const takenUserIds = new Set(members.map((m) => m.user_id).filter(Boolean));
  const takenNames = new Set(members.map((m) => m.name.trim().toLowerCase()));
  // Mọi học sinh đã có ở đâu đó và chưa thuộc nhóm đang mở, kể cả người chưa
  // gắn tài khoản: loại họ ra là chặn luôn đường thêm vào nhóm khác.
  const studentOptions = knownStudents.filter(
    (st) => !takenNames.has(st.name.trim().toLowerCase()) && !(st.user_id && takenUserIds.has(st.user_id)),
  );

  const mapSchedule = (r: ScheduleRow): Session => ({
    id: r.id,
    date: r.study_date,
    memberId: r.member_id,
    memberName: (Array.isArray(r.group_members) ? r.group_members[0]?.name : r.group_members?.name) ?? r.student_name ?? "Học sinh",
    time: String(r.start_time).slice(0, 5),
    duration: r.duration,
    done: r.done,
  });

  // ---- data loading -------------------------------------------------------
  /** Quét group_members của mọi nhóm: số đếm, tên học sinh theo nhóm, và danh
   *  sách học sinh đã có. Tách riêng để mở ô "Thêm học sinh" là nạp lại được,
   *  không phải chờ đăng nhập lại mới thấy học sinh người khác vừa tạo. */
  const loadMemberIndex = useCallback(async () => {
    if (!supabase) return;
    type Tally = { id?: string; group_id: string; name?: string; user_id?: string | null };
    let counts = await supabase.from("group_members").select("id,group_id,name,user_id");
    // Cột user_id chưa có thì vẫn đếm được học sinh, chỉ không biết tên học sinh.
    setLinkSupported(!counts.error);
    if (counts.error) counts = await supabase.from("group_members").select("group_id");
    setCountsFailed(!!counts.error);
    if (counts.error) return;
    const tally: Record<string, number> = {};
    const names: Record<string, string> = {};
    // Gộp theo tên: cùng một học sinh có mặt ở nhiều nhóm chỉ hiện một lần,
    // và bản ghi nào có gắn tài khoản thì được ưu tiên giữ lại.
    const students = new Map<string, Student>();
    const byGroup: Record<string, string[]> = {};
    // Hồ sơ của chính tài khoản này: khớp theo user_id, không suy từ nhóm hay tên.
    const mine: Member[] = [];
    for (const row of (counts.data ?? []) as Tally[]) {
      tally[row.group_id] = (tally[row.group_id] ?? 0) + 1;
      if (row.id && row.user_id && row.user_id === userId) {
        mine.push({ id: row.id, group_id: row.group_id, name: row.name ?? "", user_id: row.user_id });
      }
      if (row.name) (byGroup[row.group_id] ??= []).push(row.name);
      if (row.user_id && row.name) names[row.user_id] = row.name;
      const name = row.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const seen = students.get(key);
      if (!seen || (!seen.user_id && row.user_id)) students.set(key, { name, user_id: row.user_id ?? null });
    }
    setMemberCounts(tally);
    setStudentNames(names);
    setKnownStudents([...students.values()]);
    setGroupStudentNames(byGroup);
    setSelfMembers(mine);
    setIndexReady(true);
  }, [userId]);

  const loadGroups = useCallback(async () => {
    if (!supabase) return;
    setGroupsLoading(true);
    // RLS decides which groups this account may see; no client-side owner filter.
    const { data, error } = await supabase.from("groups").select("id,name,owner_id").order("created_at");
    setGroupsLoading(false);
    if (error) { setLoadError(error.message); return; }
    setLoadError("");
    const list = (data ?? []) as Group[];
    setGroups(list);
    setGroupId((prev) => (prev && list.some((g) => g.id === prev) ? prev : list[0]?.id ?? ""));
    await loadMemberIndex();
  }, [loadMemberIndex]);

  const loadProfiles = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("profiles").select("id,email,full_name,avatar_url").order("created_at");
    // Bảng profiles có thể chưa được tạo. Giữ lại lời báo lỗi và hiện nó ngay
    // trong ô thêm học sinh: một danh sách trống lặng lẽ không cho biết là
    // chưa chạy SQL hay thật sự chưa có tài khoản nào.
    setProfilesError(error ? error.message : "");
    setProfiles(error ? [] : ((data ?? []) as Profile[]));
  }, []);

  /** Thử bộ cột có user_id trước, lùi về bộ cột cũ nếu cột chưa được thêm. */
  const fetchMembers = useCallback(async (gid: string) => {
    const run = () => supabase!.from("group_members").select(memberCols.current).eq("group_id", gid).order("created_at");
    const first = await run();
    if (!first.error || memberCols.current === MEMBER_COLS_LEGACY) return first;
    memberCols.current = MEMBER_COLS_LEGACY;
    return run();
  }, []);

  const loadGroupData = useCallback(async (gid: string) => {
    if (!supabase) return;
    setStudentFilter("");
    if (!gid) { setMembers([]); setSessions([]); return; }
    const token = ++loadToken.current;
    setDataLoading(true);
    // Drop the previous group's rows before the request goes out, so no screen
    // can show group A's members or statistics while group B is loading.
    setMembers([]);
    setSessions([]);
    const [m, s] = await Promise.all([
      fetchMembers(gid),
      supabase.from("schedules").select(SCHEDULE_COLS).eq("group_id", gid).order("study_date").order("start_time"),
    ]);
    if (token !== loadToken.current) return; // a newer group won the race
    setDataLoading(false);
    if (m.error || s.error) { setLoadError((m.error ?? s.error)!.message); return; }
    setLoadError("");
    setMembers((m.data ?? []) as unknown as Member[]);
    setSessions((s.data ?? []).map(mapSchedule));
  }, [fetchMembers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- báo thiếu cấu hình một lần khi dựng, không có vòng render nào lặp lại
    if (!supabase) { setAuthError("Thiếu cấu hình Supabase trong .env.local"); setAuthReady(true); setGroupsLoading(false); return; }
    const apply = (session: AuthSession | null) => {
      const u = session?.user ?? null;
      setAuthReady(true);
      setUserId(u?.id ?? "");
      setUserEmail(u?.email ?? "");
      // Supabase already carries the OAuth profile; no extra Google call, and
      // the provider token is never read or stored.
      const meta = (u?.user_metadata ?? {}) as Record<string, unknown>;
      const pick = (...keys: string[]) => {
        for (const k of keys) { const val = meta[k]; if (typeof val === "string" && val.trim()) return val; }
        return "";
      };
      setUserName(pick("full_name", "name", "display_name"));
      const appMeta = (u?.app_metadata ?? {}) as { provider?: unknown; providers?: unknown };
      const list = Array.isArray(appMeta.providers)
        ? appMeta.providers.filter((x): x is string => typeof x === "string")
        : typeof appMeta.provider === "string" ? [appMeta.provider] : [];
      setUserProviders(list);
      // Only refetch when the account actually changes; TOKEN_REFRESHED and
      // USER_UPDATED fire with the same user and must not re-query.
      if (loadedUser.current === (u?.id ?? null)) return;
      loadedUser.current = u?.id ?? null;
      if (u) { void loadGroups(); void loadProfiles(); }
      else { setGroups([]); setGroupId(""); setMembers([]); setSessions([]); setProfiles([]); setProfilesError(""); setStudentNames({}); setKnownStudents([]); setSelfMembers([]); setIndexReady(false); setGroupsLoading(false); }
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return; // getSession() already handled it
      apply(session);
    });
    return () => subscription.unsubscribe();
  }, [loadGroups, loadProfiles]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- tải dữ liệu nhóm khi đổi nhóm; cờ loading phải đặt trước khi request đi
  useEffect(() => { if (userId) void loadGroupData(groupId); }, [groupId, userId, loadGroupData]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc localStorage một lần cho mỗi tài khoản; đọc lúc render sẽ lệch giữa máy chủ và trình duyệt
    if (!userId) { setOnboardDone(false); return; }
    try { if (localStorage.getItem("vioedu.welcome." + userId)) setOnboardDone(true); } catch {}
  }, [userId]);

  // ---- auth ---------------------------------------------------------------
  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    // Không kiểm tra gì ở client: mọi email và mật khẩu đều được gửi thẳng lên
    // Supabase, kể cả chuỗi rỗng. Ràng buộc duy nhất còn lại là của máy chủ.
    setAuthBusy(true); setAuthError(""); setAuthDetail("");
    const creds = { email: email.trim(), password };
    const { data, error } = authMode === "login"
      ? await supabase.auth.signInWithPassword(creds)
      : await supabase.auth.signUp(creds);
    setAuthBusy(false);
    if (error) {
      setAuthError(friendlyAuthError(error.message));
      // Không giấu lỗi gốc: một thông báo chung chung khiến sự cố cấu hình máy
      // chủ trông giống lỗi người dùng nhập sai.
      setAuthDetail(error.message);
      return;
    }
    if (authMode === "signup" && !data.session) {
      setAuthMode("login");
      setAuthError("Đã gửi email xác nhận. Xác nhận xong hãy đăng nhập.");
    }
  };
  const signInOAuth = async (provider: OAuthProvider) => {
    if (!supabase) return;
    setAuthError(""); setAuthDetail("");
    setOauthBusy(provider);
    // Only the provider name leaves the client; the app secret lives in
    // Supabase and is never shipped to the browser.
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    // On success the browser navigates away, so this only runs on failure.
    if (error) {
      const label = OAUTH.find((o) => o.id === provider)?.label ?? provider;
      // Supabase answers "provider is not enabled" when the provider is off in
      // the dashboard — a setup problem the user cannot fix from this screen.
      setAuthError(
        /not enabled|unsupported provider/i.test(error.message)
          ? "Đăng nhập " + label + " chưa được bật cho ứng dụng này."
          : error.message,
      );
      setOauthBusy(null);
    }
  };
  const logout = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) toast(error.message, "err");
  };

  // ---- groups -------------------------------------------------------------
  const submitGroup = async () => {
    if (!supabase || !groupForm) return;
    const name = groupForm.name.trim();
    if (!name) return;
    setBusy(true);
    if (groupForm.mode === "create") {
      const { data, error } = await supabase.from("groups").insert({ name, owner_id: userId }).select("id,name,owner_id").single();
      setBusy(false);
      if (error) { toast(error.message, "err"); return; }
      setGroups((v) => [...v, data as Group]);
      setMemberCounts((c) => ({ ...c, [(data as Group).id]: 0 }));
      setGroupId((data as Group).id);
      const fromOnboarding = groupForm.fromOnboarding;
      setGroupForm(null);
      if (fromOnboarding) {
        // Onboarding vẫn đang mở: chọn sẵn nhóm vừa tạo và giữ nguyên tên học
        // sinh người dùng đã gõ, đừng kéo họ sang màn khác.
        setOnboard((f) => ({ ...f, groupId: (data as Group).id }));
        setGroupStudentNames((n) => ({ ...n, [(data as Group).id]: [] }));
      } else {
        // Bước 2: nhóm vừa tạo còn rỗng, nên mở thẳng ô thêm học sinh thay vì
        // bắt người dùng tự tìm đường sang tab Học sinh.
        setTab("people");
        openAddStudent(true);
      }
      toast(`Đã tạo nhóm "${name}"`);
    } else {
      const targetId = groupForm.id;
      if (!targetId) { setBusy(false); return; }
      const { error } = await supabase.from("groups").update({ name }).eq("id", targetId);
      setBusy(false);
      if (error) { toast(error.message, "err"); return; }
      setGroups((v) => v.map((g) => (g.id === targetId ? { ...g, name } : g)));
      setGroupForm(null);
      toast("Đã đổi tên nhóm");
    }
  };

  const askDeleteGroup = (target: Group) => {
    const count = memberCounts[target.id] ?? 0;
    const others = groups.filter((g) => g.id !== target.id);
    if (count === 0) { confirmDeleteGroup(target); return; }
    // Nhóm còn học sinh: chỉ cho chuyển họ đi rồi mới xóa. Học sinh không phải
    // là thứ đi kèm cái nhóm, nên không bị xóa theo nó trong bất kỳ trường hợp nào.
    if (others.length > 0) { setGroupDelete({ group: target, targetId: others[0].id }); return; }
    // Không còn nhóm nào để chuyển sang: chỉ còn cách xóa kèm, và hộp xác nhận
    // nói thẳng học sinh sẽ mất.
    confirmDeleteGroup(target);
  };

  const confirmDeleteGroup = (target: Group) => {
    const count = memberCounts[target.id] ?? 0;
    setConfirm({
      title: `Xóa nhóm "${target.name}"?`,
      body: count > 0
        ? `${count} học sinh trong nhóm này và toàn bộ lịch học của họ sẽ bị xóa vĩnh viễn. Không thể hoàn tác.`
        : "Nhóm này không còn học sinh nào. Lịch học của nhóm sẽ bị xóa. Không thể hoàn tác.",
      confirmLabel: count > 0 ? "Xóa cả học sinh" : "Xóa nhóm",
      onConfirm: async () => {
        if (!supabase) return;
        setConfirmBusy(true);
        // Children first: the FK may not cascade, and a failed group delete
        // would otherwise leave the UI claiming success.
        const schedulesDel = await supabase.from("schedules").delete().eq("group_id", target.id);
        if (schedulesDel.error) { setConfirmBusy(false); setConfirm(null); toast(schedulesDel.error.message, "err"); return; }
        const membersDel = await supabase.from("group_members").delete().eq("group_id", target.id);
        if (membersDel.error) { setConfirmBusy(false); setConfirm(null); toast(membersDel.error.message, "err"); return; }
        const { error } = await supabase.from("groups").delete().eq("id", target.id);
        setConfirmBusy(false); setConfirm(null);
        if (error) { toast(error.message, "err"); return; }
        // Refetch rather than patching state: loadGroups already drops a
        // groupId that no longer exists and falls back to the first group,
        // so this cannot leave the app pointing at the deleted group.
        setTab("home");
        await loadGroups();
        toast("Đã xóa nhóm");
      },
    });
  };

  /** Chuyển cả học sinh của một nhóm sang nhóm khác rồi mới xóa nhóm rỗng. */
  const moveAllThenDelete = async () => {
    if (!supabase || !groupDelete) return;
    const { group, targetId } = groupDelete;
    setBusy(true);
    const sch = await supabase.from("schedules").update({ group_id: targetId }).eq("group_id", group.id);
    if (sch.error) { setBusy(false); toast(sch.error.message, "err"); return; }
    const mem = await supabase.from("group_members").update({ group_id: targetId }).eq("group_id", group.id);
    if (mem.error) { setBusy(false); toast(mem.error.message, "err"); return; }
    const { error } = await supabase.from("groups").delete().eq("id", group.id);
    setBusy(false);
    if (error) { toast(error.message, "err"); return; }
    setGroupDelete(null);
    setTab("home");
    await loadGroups();
    toast(`Đã chuyển học sinh sang "${groups.find((g) => g.id === targetId)?.name ?? "nhóm khác"}" và xóa "${group.name}"`);
  };

  /** Màn chào lần đầu: đăng ký tên con và chọn nhóm cho con. */
  const submitOnboarding = async (force = false) => {
    if (!supabase || busy) return; // busy chặn bấm liên tiếp tạo hai học sinh
    const name = onboard.name.trim();
    if (!name) { setOnboardError("Hãy nhập tên học sinh."); return; }
    const gid = onboard.groupId || groups[0]?.id || "";
    if (!gid) { setOnboardError("Hãy chọn hoặc tạo một nhóm học."); return; }
    setOnboardError("");
    // Trùng tên trong cùng nhóm thường là thêm nhầm lần hai, nhưng hai học sinh
    // trùng tên vẫn có thật, nên hỏi lại chứ không chặn.
    const clash = (groupStudentNames[gid] ?? []).find((x) => x.trim().toLowerCase() === name.toLowerCase());
    if (clash && !force) {
      setConfirm({
        title: "Đã có học sinh cùng tên",
        body: `${groups.find((g) => g.id === gid)?.name ?? "Nhóm này"} đã có học sinh tên ${clash}. Bạn vẫn muốn thêm học sinh này?`,
        cancelLabel: "Quay lại",
        confirmLabel: "Vẫn thêm",
        busyLabel: "Đang lưu...",
        tone: "primary",
        onConfirm: () => { setConfirm(null); void submitOnboarding(true); },
      });
      return;
    }
    setBusy(true);
    const row: Record<string, unknown> = { group_id: gid, name };
    if (linkSupported) row.user_id = userId;
    const { error } = await supabase.from("group_members").insert(row);
    setBusy(false);
    // Lỗi thì giữ nguyên dữ liệu đã nhập và không đánh dấu onboarding xong,
    // để người dùng thử lại ngay tại chỗ.
    if (error) { setOnboardError(error.message); return; }
    setGroupStudentNames((n) => ({ ...n, [gid]: [...(n[gid] ?? []), name] }));
    setOnboardDone(true);
    await loadGroups();
    setGroupId(gid);
    // Tải lại thẳng thay vì trông vào effect theo groupId: nếu nhóm vừa thêm
    // đúng là nhóm đang mở thì groupId không đổi, effect không chạy, và màn
    // Lịch giữ nguyên danh sách học sinh rỗng đọc từ trước lúc thêm.
    await loadGroupData(gid);
    setTab("home");
    toast(`Đã thêm ${name} vào nhóm`);
  };

  /** Bỏ qua bước thiết lập và vào thẳng màn Lịch. */
  const skipOnboarding = () => {
    setOnboardDone(true);
    // Nhớ theo từng tài khoản, để lần mở sau không hỏi lại.
    try { localStorage.setItem("vioedu.welcome." + userId, "1"); } catch {}
    setTab("home");
  };

  // ---- members ------------------------------------------------------------
  const submitMember = async () => {
    if (!supabase || !memberForm || !groupId) return;
    const name = memberForm.name.trim();
    if (!name) return;
    const editingId = memberForm.id;
    setBusy(true);
    if (editingId) {
      const { error } = await supabase.from("group_members").update({ name }).eq("id", editingId);
      setBusy(false);
      if (error) { toast(error.message, "err"); return; }
      const linked = members.find((m) => m.id === editingId)?.user_id;
      if (linked) setStudentNames((n) => ({ ...n, [linked]: name }));
      setMembers((v) => v.map((m) => (m.id === editingId ? { ...m, name } : m)));
      setSessions((v) => v.map((s) => (s.memberId === editingId ? { ...s, memberName: name } : s)));
      toast("Đã đổi tên học sinh");
    }
    setMemberForm(null);
  };

  /** Liên kết một học sinh đã có tài khoản vào nhóm đang mở.
   *  Giữ nguyên tên và user_id của hồ sơ cũ, không hỏi lại tên và không đặt
   *  danh tính mới: chỉ số hàng thành viên của nhóm này tăng thêm một. */
  const addKnownStudent = async (st: Student) => {
    if (!supabase || !groupId || linkingId) return; // linkingId chặn bấm hai lần
    const key = st.user_id ?? st.name;
    setLinkingId(key);
    const row: Record<string, unknown> = { group_id: groupId, name: st.name };
    if (st.user_id && memberCols.current === MEMBER_COLS) row.user_id = st.user_id;
    const { data, error } = await supabase.from("group_members").insert(row).select(memberCols.current).single();
    setLinkingId("");
    // Chỉ số liệu trên màn được cập nhật khi máy chủ đã nhận; lỗi thì giữ
    // nguyên danh sách để bấm lại.
    if (error) { toast(error.message, "err"); return; }
    setMembers((v) => [...v, data as unknown as Member]);
    setMemberCounts((c) => ({ ...c, [groupId]: (c[groupId] ?? 0) + 1 }));
    setGroupStudentNames((n) => ({ ...n, [groupId]: [...(n[groupId] ?? []), st.name] }));
    // Chọn xong là xong: đóng luôn để thấy học sinh vừa thêm trong danh sách.
    setMemberForm(null);
    toast(`Đã thêm ${st.name} vào nhóm`);
  };

  /** Mở ô thêm học sinh và quét lại danh sách: học sinh do người khác vừa tạo
   *  phải có mặt ngay, không đợi tải lại trang. */
  const openAddStudent = (step2 = false) => {
    setMemberForm({ id: null, name: "", step2: step2 || undefined });
    void loadMemberIndex();
  };

  /** Mở hồ sơ học sinh của chính tài khoản này, dùng lại sheet Chi tiết học
   *  sinh và khoá theo id hàng group_members chứ không theo tên hay email. */
  const openSelfProfile = () => {
    if (!selfMember) return;
    setShowAccount(false);
    setTab("people");
    // Hồ sơ có thể nằm ở nhóm khác; đổi nhóm để lịch học trong sheet là của đúng nhóm đó.
    if (selfMember.group_id !== groupId) setGroupId(selfMember.group_id);
    setStudentDetail(selfMember);
  };

  /** Gắn hồ sơ học sinh với một tài khoản, hoặc bỏ gắn khi truyền chuỗi rỗng.
   *  Gắn được cho bất kỳ ai chứ không riêng người đang đăng nhập, vì người lập
   *  nhóm mới là người biết em nào dùng tài khoản nào. */
  const linkStudentAccount = async (m: Member, accountId: string) => {
    if (!supabase || busy) return;
    setBusy(true);
    const next = accountId || null;
    const { error } = await supabase.from("group_members").update({ user_id: next }).eq("id", m.id);
    setBusy(false);
    if (error) { toast(error.message, "err"); return; }
    setMembers((v) => v.map((x) => (x.id === m.id ? { ...x, user_id: next } : x)));
    setStudentDetail((d) => (d && d.id === m.id ? { ...d, user_id: next } : d));
    await loadMemberIndex();
    toast(next ? `Đã gắn tài khoản cho ${m.name}` : `Đã bỏ liên kết tài khoản khỏi ${m.name}`);
  };

  const openMove = (m: Member) => {
    setStudentDetail(null);
    setMoveForm({ member: m, targetId: groups.find((g) => g.id !== groupId)?.id ?? "" });
  };

  const submitMove = async () => {
    if (!supabase || !moveForm || !moveForm.targetId) return;
    const { member, targetId } = moveForm;
    setBusy(true);
    const mv = await supabase.from("group_members").update({ group_id: targetId }).eq("id", member.id);
    if (mv.error) { setBusy(false); toast(mv.error.message, "err"); return; }
    // Lịch học phải đi cùng học sinh, nếu không các buổi đã lên sẽ mắc lại ở nhóm cũ.
    const sch = await supabase.from("schedules").update({ group_id: targetId }).eq("member_id", member.id);
    setBusy(false);
    if (sch.error) { toast(sch.error.message, "err"); return; }
    const moved = sessions.filter((x) => x.memberId === member.id).length;
    setMembers((v) => v.filter((x) => x.id !== member.id));
    setSessions((v) => v.filter((x) => x.memberId !== member.id));
    setMemberCounts((c) => ({
      ...c,
      [groupId]: Math.max(0, (c[groupId] ?? 1) - 1),
      [targetId]: (c[targetId] ?? 0) + 1,
    }));
    setMoveForm(null);
    const to = groups.find((g) => g.id === targetId)?.name ?? "nhóm khác";
    toast(moved > 0 ? `Đã chuyển ${member.name} sang ${to} cùng ${moved} buổi học` : `Đã chuyển ${member.name} sang ${to}`);
  };

  const askDeleteMember = (m: Member) => {
    const count = sessions.filter((s) => s.memberId === m.id).length;
    setConfirm({
      title: `Xóa ${m.name}?`,
      body: count > 0
        ? `${count} buổi học của học sinh này cũng sẽ bị xóa. Không thể hoàn tác.`
        : "Học sinh này sẽ bị xóa khỏi nhóm. Không thể hoàn tác.",
      confirmLabel: "Xóa học sinh",
      onConfirm: async () => {
        if (!supabase) return;
        setConfirmBusy(true);
        const child = await supabase.from("schedules").delete().eq("member_id", m.id);
        if (child.error) { setConfirmBusy(false); setConfirm(null); toast(child.error.message, "err"); return; }
        const { error } = await supabase.from("group_members").delete().eq("id", m.id);
        setConfirmBusy(false); setConfirm(null);
        if (error) { toast(error.message, "err"); return; }
        setMembers((v) => v.filter((x) => x.id !== m.id));
        setMemberCounts((c) => ({ ...c, [m.group_id]: Math.max(0, (c[m.group_id] ?? 1) - 1) }));
        setSessions((v) => v.filter((s) => s.memberId !== m.id));
        toast("Đã xóa học sinh");
      },
    });
  };

  // ---- schedules ----------------------------------------------------------
  const openSchedule = (s?: Session) =>
    setScheduleForm(
      s
        ? { id: s.id, memberId: s.memberId ?? members[0]?.id ?? "", time: s.time, duration: s.duration }
        : { id: null, memberId: members[0]?.id ?? "", time: DEFAULT_TIME, duration: 30 },
    );

  const submitSchedule = async () => {
    if (!supabase || !scheduleForm || !groupId || !scheduleForm.memberId) return;
    const f = scheduleForm;
    const member = members.find((m) => m.id === f.memberId);
    setBusy(true);
    if (f.id === null) {
      const { data, error } = await supabase.from("schedules").insert({
        group_id: groupId,
        member_id: f.memberId,
        student_name: member?.name ?? "",
        study_date: dateKey(selectedDate),
        start_time: f.time,
        duration: f.duration,
        done: false,
      }).select(SCHEDULE_COLS).single();
      setBusy(false);
      if (error) { toast(error.message, "err"); return; }
      setSessions((v) => [...v, mapSchedule(data)]);
      toast("Đã lưu lịch học");
    } else {
      const { data, error } = await supabase.from("schedules").update({
        member_id: f.memberId,
        student_name: member?.name ?? "",
        start_time: f.time,
        duration: f.duration,
      }).eq("id", f.id).select(SCHEDULE_COLS).single();
      setBusy(false);
      if (error) { toast(error.message, "err"); return; }
      setSessions((v) => v.map((s) => (s.id === f.id ? mapSchedule(data) : s)));
      toast("Đã cập nhật lịch học");
    }
    setScheduleForm(null);
  };

  const toggleDone = async (x: Session) => {
    if (!supabase) return;
    const done = !x.done;
    setSessions((v) => v.map((s) => (s.id === x.id ? { ...s, done } : s))); // optimistic
    const { error } = await supabase.from("schedules").update({ done }).eq("id", x.id);
    if (error) {
      setSessions((v) => v.map((s) => (s.id === x.id ? { ...s, done: x.done } : s)));
      toast(error.message, "err");
    }
  };

  const askDeleteSchedule = (x: Session) =>
    setConfirm({
      title: "Xóa buổi học?",
      body: `${x.memberName} · ${fmt12(x.time)} - ${fmt12(endOf(x.time, x.duration))}`,
      confirmLabel: "Xóa buổi học",
      onConfirm: async () => {
        if (!supabase) return;
        setConfirmBusy(true);
        const { error } = await supabase.from("schedules").delete().eq("id", x.id);
        setConfirmBusy(false); setConfirm(null);
        if (error) { toast(error.message, "err"); return; }
        setSessions((v) => v.filter((s) => s.id !== x.id));
        toast("Đã xóa buổi học");
      },
    });

  // ---- derived ------------------------------------------------------------
  const week = useMemo(() => weekDays(selectedDate), [selectedDate]);
  const monthRows = useMemo(() => monthWeeks(selectedDate), [selectedDate]);
  // Màn Lịch là nơi xem toàn bộ lịch; khi đến từ hồ sơ một học sinh thì lọc
  // theo đúng học sinh đó, kể cả các chấm báo lịch trên dải ngày.
  const visibleSessions = useMemo(
    () => (studentFilter ? sessions.filter((s) => s.memberId === studentFilter) : sessions),
    [sessions, studentFilter],
  );
  /** dateKey -> how many sessions that day has, and how many are done. */
  const byDate = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    for (const s of visibleSessions) {
      const slot = (map[s.date] ??= { total: 0, done: 0 });
      slot.total += 1;
      if (s.done) slot.done += 1;
    }
    return map;
  }, [visibleSessions]);
  const daily = useMemo(
    () => visibleSessions.filter((s) => s.date === dateKey(selectedDate)).sort((a, b) => minutesOf(a.time) - minutesOf(b.time)),
    [visibleSessions, selectedDate],
  );
  const doneCount = sessions.filter((s) => s.done).length;
  const moveDay = (n: number) => { const d = new Date(selectedDate); d.setDate(d.getDate() + n); setSelectedDate(d); };

  // ---- gates --------------------------------------------------------------
  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 p-6 text-center font-semibold text-slate-500">
        Đang kết nối Supabase...
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50 p-5">
        <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-500">VioEdu</p>
          <h1 className="mt-2 text-2xl font-extrabold">{authMode === "login" ? "Đăng nhập" : "Đăng ký"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {authMode === "login" ? "Đăng nhập để xem lịch học của nhóm." : "Tạo tài khoản để bắt đầu quản lý lịch học."}
          </p>
          <form onSubmit={submitAuth} className="mt-6 space-y-3">
            <label className="block">
              <span className="text-sm font-bold">Email</span>
              <input type="text" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${field}`} placeholder="email@example.com" />
            </label>

            <div>
              <label className="block text-sm font-bold" htmlFor="auth-password">Mật khẩu</label>
              <div className="relative mt-1">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${field} pr-14`}
                  placeholder="Nhập mật khẩu"
                />
                {/* Sits inside the field's padding so the input keeps its full height. */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-2xl text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {authError && (
              <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700" role="alert">
                {authError}
                {authDetail && <span className="mt-1 block break-words text-xs text-red-500">{authDetail}</span>}
              </p>
            )}
            <button disabled={authBusy} className={primaryBtn}>
              {authBusy ? "Đang xử lý..." : authMode === "login" ? "Đăng nhập" : "Đăng ký"}
            </button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />hoặc<span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="space-y-2">
            {OAUTH.map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => signInOAuth(id)} disabled={oauthBusy !== null}
                className="relative flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-slate-200 px-12 font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60">
                {/* Icon is absolutely placed so the label stays optically centred
                    and both buttons line up regardless of glyph width. */}
                <span className="absolute left-4 grid place-items-center"><Icon size={18} /></span>
                {oauthBusy === id ? "Đang chuyển hướng..." : `Tiếp tục với ${label}`}
              </button>
            ))}
          </div>
          <p className="mt-5 text-center text-sm text-slate-500">
            {authMode === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
            <button type="button" onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); setAuthDetail(""); setShowPassword(false); }} className="font-bold text-indigo-600">
              {authMode === "login" ? "Đăng ký" : "Đăng nhập"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  const showDateStrip = tab === "home" && groups.length > 0;

  // Cùng một form tạo nhóm cho onboarding và cho màn Cài đặt, nên không có hai
  // đường tạo nhóm khác nhau.
  const groupFormSheet = (
      <Sheet open={!!groupForm} title={groupForm?.mode === "rename" ? "Đổi tên nhóm" : "Bước 1 · Tạo nhóm mới"} onClose={() => setGroupForm(null)}>
        <label className="block">
          <span className="text-sm font-bold">Tên nhóm</span>
          <input autoFocus value={groupForm?.name ?? ""} onChange={(e) => setGroupForm((f) => (f ? { ...f, name: e.target.value } : f))}
            onKeyDown={(e) => { if (e.key === "Enter") void submitGroup(); }} className={`mt-1 ${field}`} placeholder="Ví dụ: Nhóm 1" />
        </label>
        <button disabled={busy || !groupForm?.name.trim()} onClick={submitGroup} className={`mt-5 ${primaryBtn}`}>
          {busy ? "Đang lưu..." : groupForm?.mode === "rename" ? "Lưu tên nhóm" : "Tạo nhóm và tiếp tục"}
        </button>
      </Sheet>
  );

  // Lần đầu đăng nhập: tài khoản chưa gắn với học sinh nào. Hỏi ngay học sinh
  // đầu tiên, thay vì thả thẳng vào một màn lịch trống không rõ phải làm gì.
  const onboardGroup = onboard.groupId || groups[0]?.id || "";
  if (linkSupported && indexReady && !onboardDone && !groupsLoading && !studentNames[userId]) {
    return (
      <div className="grid min-h-screen place-items-center overflow-y-auto bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50 p-5">
        <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-500">VioEdu</p>
          <h1 className="mt-2 text-2xl font-extrabold">Thiết lập hồ sơ học sinh</h1>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-bold">Tên học sinh</span>
              <input autoFocus value={onboard.name}
                onChange={(e) => { setOnboard((f) => ({ ...f, name: e.target.value })); if (onboardError) setOnboardError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") void submitOnboarding(); }}
                className={`mt-1 ${field}`} placeholder="Ví dụ: Đỗ An Nguyên" />
              {onboardError && <span className="mt-1 block text-sm text-red-600">{onboardError}</span>}
            </label>

            <label className="block">
              <span className="text-sm font-bold">Nhóm học</span>
              {/* select gốc của trình duyệt: trên di động nó đã mở đúng kiểu
                  bản địa, không cần thêm thư viện chỉ để đổi vẻ ngoài. */}
              <select value={onboardGroup} className={`mt-1 ${field}`}
                onChange={(e) => {
                  if (e.target.value === "__new__") { setGroupForm({ mode: "create", name: "", fromOnboarding: true }); return; }
                  setOnboard((f) => ({ ...f, groupId: e.target.value }));
                }}>
                {groups.length === 0 && <option value="">Chưa có nhóm nào</option>}
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                <option value="__new__">+ Tạo nhóm mới</option>
              </select>
              {/* Chỉ để xác nhận đang chọn đúng nhóm: không thẻ, không avatar,
                  không menu. Dữ liệu lấy từ lần quét của loadGroups, không gọi thêm. */}
              {onboardGroup && (countsFailed ? (
                <span className="mt-2 block text-xs text-slate-400">Không thể tải thông tin nhóm</span>
              ) : (() => {
                const inGroup = groupStudentNames[onboardGroup] ?? [];
                if (inGroup.length === 0) {
                  return <span className="mt-2 block text-xs text-slate-500">Chưa có học sinh trong nhóm này</span>;
                }
                const shown = inGroup.slice(0, 3).join(", ");
                const rest = inGroup.length - 3;
                return (
                  <span className="mt-2 block text-xs text-slate-500">
                    {inGroup.length} học sinh trong nhóm
                    <span className="mt-0.5 block break-words text-slate-600">
                      {shown}{rest > 0 ? ` +${rest}` : ""}
                    </span>
                  </span>
                );
              })())}
            </label>

            <button disabled={busy} onClick={() => void submitOnboarding()} className={primaryBtn}>
              {busy ? "Đang lưu..." : "Tiếp tục"}
            </button>
            <button type="button" onClick={skipOnboarding} className="min-h-[44px] w-full text-sm font-bold text-slate-500 transition hover:text-slate-700">
              Bỏ qua
            </button>
          </div>
        </div>
        {groupFormSheet}
        <ConfirmDialog state={confirm} busy={busy} onClose={() => { if (!busy) setConfirm(null); }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50">
      <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-white shadow-xl sm:my-6 sm:h-[calc(100dvh-3rem)] sm:rounded-[34px]">
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-amber-400 p-2 text-xs font-bold text-amber-950 sm:rounded-t-[34px]">
            <WifiOff size={14} />Đang ngoại tuyến
          </div>
        )}

        <header className={`bg-gradient-to-br from-indigo-600 to-purple-600 px-5 text-white ${showDateStrip ? "pb-7 pt-6" : "pb-6 pt-5"} ${online ? "sm:rounded-t-[34px]" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            {/* flex-1 so the title claims the row's free space; without it the
                wrapper shrinks to its own content and `truncate` clips a name
                that would have fitted. */}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-indigo-200">VioEdu</p>
              {tab === "home" && groups.length > 0 ? (
                <button
                  onClick={() => setShowGroupPicker(true)}
                  aria-haspopup="dialog"
                  aria-label={`Nhóm hiện tại: ${currentGroup?.name ?? "chưa chọn"}. Chọn nhóm khác.`}
                  className="-ml-2 mt-1 flex min-h-[44px] w-full items-center gap-1.5 rounded-2xl px-2 text-left transition hover:bg-white/10"
                >
                  <span className="min-w-0 truncate text-2xl font-extrabold">{currentGroup?.name ?? "Chọn nhóm"}</span>
                  <ChevronDown size={20} className="shrink-0 text-indigo-200" />
                  {groups.length > 1 && (
                    <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-indigo-100">
                      {groups.length} nhóm
                    </span>
                  )}
                </button>
              ) : (
                <h1 className="mt-1 truncate text-2xl font-extrabold">{TAB_TITLE[tab]}</h1>
              )}
            </div>
            {/* Mọi tab trừ Cài đặt: ở đó đã có sẵn khối tài khoản, thêm avatar
                nữa là hai lối vào cùng một chỗ. */}
            {tab !== "settings" && (
              <button onClick={() => setShowAccount(true)} aria-haspopup="dialog"
                aria-label={`Tài khoản ${accountName || userEmail}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-white/15">
                <AccountAvatar name={accountName} email={userEmail} tone="onPurple"
                  className="h-10 w-10 text-sm ring-2 ring-white/40" />
              </button>
            )}
          </div>

          {/* Lịch bên dưới đã nói rõ đang xem ngày nào, nên thanh này chỉ cần
              chính ngày đó, đặt giữa hai nút, và thấp hơn một nhịp. */}
          {showDateStrip && (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-white/10 p-1">
              <button onClick={() => moveDay(-1)} aria-label="Ngày trước" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl transition hover:bg-white/15">
                <ChevronLeft />
              </button>
              <b className="min-w-0 flex-1 truncate text-center">{dateLabel(selectedDate)}</b>
              <button onClick={() => moveDay(1)} aria-label="Ngày sau" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl transition hover:bg-white/15">
                <ChevronRight />
              </button>
            </div>
          )}
        </header>

        <main className="-mt-3 min-h-0 flex-1 overflow-y-auto rounded-t-[28px] bg-slate-50 px-4 pt-5 pb-6">
          {loadError && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700" role="alert">
              <span className="min-w-0">{loadError}</span>
              <button onClick={() => { setLoadError(""); void loadGroups(); void loadGroupData(groupId); }} className="shrink-0 font-bold underline">Thử lại</button>
            </div>
          )}

          {groupsLoading ? (
            <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
          ) : groups.length === 0 ? (
            <EmptyState
              icon={<UsersRound size={22} />}
              title="Chưa có nhóm nào"
              hint="Tạo nhóm đầu tiên để bắt đầu thêm học sinh và lịch học."
              action={
                <button onClick={() => setGroupForm({ mode: "create", name: "" })} className={primaryBtn}>
                  <Plus size={18} className="mr-1 inline" />Tạo nhóm mới
                </button>
              }
            />
          ) : (
            <>
              {tab === "home" && (
                <>
                  <div className="mb-4 rounded-3xl bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedDate((d) => (calView === "week" ? addDays(d, -7) : addMonths(d, -1)))}
                        aria-label={calView === "week" ? "Tuần trước" : "Tháng trước"}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100">
                        <ChevronLeft size={18} />
                      </button>
                      <b className="min-w-0 truncate text-sm">{calView === "week" ? weekLabel(selectedDate) : monthLabel(selectedDate)}</b>
                      <button
                        onClick={() => setSelectedDate((d) => (calView === "week" ? addDays(d, 7) : addMonths(d, 1)))}
                        aria-label={calView === "week" ? "Tuần sau" : "Tháng sau"}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100">
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    <div className="mb-2 flex gap-1 rounded-2xl bg-slate-100 p-1">
                      {(["week", "month"] as const).map((v) => (
                        <button key={v} onClick={() => setCalView(v)} aria-pressed={calView === v}
                          className={`min-h-[36px] flex-1 rounded-xl text-xs font-bold transition ${calView === v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                          {v === "week" ? "Tuần" : "Tháng"}
                        </button>
                      ))}
                      {dateKey(selectedDate) !== dateKey(today) && (
                        <button onClick={() => setSelectedDate(today)}
                          className="min-h-[36px] rounded-xl px-3 text-xs font-bold text-indigo-600 transition hover:bg-white">
                          Hôm nay
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
                      {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
                    </div>

                    {(calView === "week" ? [week] : monthRows).map((row, ri) => (
                      <div key={ri} className="mt-1 grid grid-cols-7 gap-1">
                        {row.map((d) => {
                          const key = dateKey(d);
                          const active = key === dateKey(selectedDate);
                          const isToday = key === dateKey(today);
                          const outside = calView === "month" && d.getMonth() !== selectedDate.getMonth();
                          const tally = byDate[key];
                          return (
                            <button key={key} onClick={() => setSelectedDate(d)} aria-current={active ? "date" : undefined}
                              aria-label={`${dateLabel(d)}${tally ? ` — ${tally.total} buổi` : ""}`}
                              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl transition ${
                                active ? "bg-indigo-600 text-white shadow-sm"
                                : outside ? "text-slate-300 hover:bg-slate-50"
                                : "text-slate-700 hover:bg-slate-100"}`}>
                              <b className={`text-sm ${!active && isToday ? "text-indigo-600" : ""}`}>{d.getDate()}</b>
                              {/* Dot marks a day with sessions; filled once they are all done. */}
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                !tally ? "bg-transparent"
                                : active ? "bg-white"
                                : tally.done === tally.total ? "bg-emerald-500"
                                : "bg-indigo-500"}`} />
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Đến từ hồ sơ một học sinh: cho biết đang lọc theo ai và
                      cho bỏ lọc, nhóm đang xem giữ nguyên. */}
                  {studentFilter && (
                    <div className="mb-3 flex items-center gap-2 rounded-2xl bg-indigo-50 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-indigo-800">
                        {members.find((m) => m.id === studentFilter)?.name ?? "Học sinh"}
                      </span>
                      <button onClick={() => setStudentFilter("")} aria-label="Bỏ lọc học sinh"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-indigo-600 transition hover:bg-white">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h2 className="font-extrabold">Lịch học</h2>
                      <p className="text-xs text-slate-500">{daily.length} buổi đã lên lịch</p>
                    </div>
                    {/* Hidden while the empty state is showing: its own CTA is
                        the single call to action for that screen. */}
                    {daily.length > 0 && members.length > 0 && (
                      <button onClick={() => openSchedule()}
                        className="flex min-h-[44px] items-center gap-1 rounded-2xl bg-indigo-50 px-3 font-bold text-indigo-700 transition hover:bg-indigo-100">
                        <Plus size={17} />Thêm
                      </button>
                    )}
                  </div>

                  {dataLoading ? (
                    <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
                  ) : members.length === 0 ? (
                    <EmptyState icon={<UsersRound size={22} />} title="Nhóm chưa có học sinh"
                      hint="Thêm học sinh trước khi lên lịch học."
                      action={<button onClick={() => { setTab("people"); openAddStudent(); }} className={primaryBtn}>Thêm học sinh</button>} />
                  ) : daily.length === 0 ? (
                    <EmptyState icon={<CalendarDays size={22} />}
                      title={dateKey(selectedDate) === dateKey(today) ? "Không có lịch học hôm nay" : "Không có lịch học ngày này"}
                      action={<button onClick={() => openSchedule()} className={primaryBtn}><Plus size={18} className="mr-1 inline" />Thêm lịch học</button>} />
                  ) : (
                    <div className="space-y-3">
                      {daily.map((x) => (
                        <motion.article layout key={x.id} className={`rounded-3xl bg-white p-4 shadow-sm ${x.done ? "opacity-75" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-1 gap-3">
                              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-base font-extrabold text-indigo-700">
                                {initials(x.memberName) || "?"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <b className={`block truncate leading-tight ${x.done ? "text-slate-500 line-through" : ""}`}>{x.memberName}</b>
                                {/* Time and duration on one line: two stacked lines
                                    pushed the card past a comfortable phone height. */}
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-slate-600">
                                  <Clock3 size={14} className="shrink-0" />
                                  <span>{fmt12(x.time)} - {fmt12(endOf(x.time, x.duration))}</span>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-500">{x.duration} phút</span>
                                </p>
                              </div>
                            </div>
                            <RowMenu
                              label={`Tùy chọn cho buổi học của ${x.memberName}`}
                              items={[
                                { label: "Sửa buổi học", icon: <Pencil size={15} />, onSelect: () => openSchedule(x) },
                                { label: "Xóa buổi học", icon: <Trash2 size={15} />, danger: true, onSelect: () => askDeleteSchedule(x) },
                              ]}
                            />
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => toggleDone(x)}
                              className={`flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-2xl text-xs font-bold transition ${x.done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                              <Check size={15} />{x.done ? "Đã học" : "Hoàn thành"}
                            </button>
                            <a href={VIOEDU_URL} target="_blank" rel="noopener noreferrer"
                              className="grid min-h-[44px] place-items-center rounded-2xl bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700">
                              Học ngay
                            </a>
                          </div>
                        </motion.article>
                      ))}
                    </div>
                  )}
                </>
              )}

              {tab === "people" && (
                <>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    {/* Same sheet as the Lịch header, so switching groups behaves
                        identically wherever it is offered. */}
                    <button onClick={() => setShowGroupPicker(true)} aria-haspopup="dialog"
                      aria-label={`Nhóm hiện tại: ${currentGroup?.name ?? "chưa chọn"}. Chọn nhóm khác.`}
                      className="-ml-2 flex min-h-[44px] min-w-0 items-center gap-1 rounded-2xl px-2 font-bold text-slate-800 transition hover:bg-slate-200/60">
                      <span className="truncate">{currentGroup?.name ?? "Chọn nhóm"}</span>
                      <ChevronDown size={18} className="shrink-0 text-slate-500" />
                      {groups.length > 1 && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                          {groups.length} nhóm
                        </span>
                      )}
                    </button>
                    {members.length > 0 && (
                      <button onClick={() => openAddStudent()} aria-label="Thêm học sinh"
                        className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-2xl bg-indigo-50 px-3 font-bold text-indigo-700 transition hover:bg-indigo-100">
                        <Plus size={17} />Thêm
                      </button>
                    )}
                  </div>
                  {dataLoading ? (
                    <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
                  ) : members.length === 0 ? (
                    <EmptyState icon={<UsersRound size={22} />} title="Chưa có học sinh"
                      hint="Thêm học sinh để bắt đầu lên lịch."
                      action={
                        <button onClick={() => openAddStudent()} className={primaryBtn}>
                          <Plus size={18} className="mr-1 inline" />Thêm học sinh
                        </button>
                      } />
                  ) : (
                    <div className="space-y-2">
                      {members.map((m) => {
                        const total = sessions.filter((s) => s.memberId === m.id).length;
                        const done = sessions.filter((s) => s.memberId === m.id && s.done).length;
                        return (
                          <div key={m.id} className="flex items-center gap-1 rounded-3xl bg-white pr-2 shadow-sm">
                            {/* Cả thẻ mở chi tiết học sinh. RowMenu nằm ngoài nút này
                                nên không cần chặn sự kiện nổi lên. */}
                            <button onClick={() => setStudentDetail(m)} aria-label={`Xem ${m.name}`}
                              className="flex min-w-0 flex-1 items-center gap-3 rounded-3xl p-4 text-left transition hover:bg-slate-50">
                              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-base font-extrabold text-indigo-700">
                                {initials(m.name) || "?"}
                              </span>
                              <span className="min-w-0 flex-1">
                                <b className="block truncate leading-tight">{m.name}</b>
                                <span className="mt-0.5 block text-xs text-slate-500">{done}/{total} buổi hoàn thành</span>
                              </span>
                            </button>
                            <RowMenu
                              label={`Tùy chọn cho ${m.name}`}
                              items={[
                                { label: "Sửa thông tin", icon: <Pencil size={15} />, onSelect: () => setMemberForm({ id: m.id, name: m.name }) },
                                { label: "Chuyển nhóm", icon: <UsersRound size={15} />, onSelect: () => openMove(m) },
                                { label: "Xóa học sinh", icon: <Trash2 size={15} />, danger: true, onSelect: () => askDeleteMember(m) },
                              ]}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {tab === "stats" && (
                <>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <button onClick={() => setShowGroupPicker(true)} aria-haspopup="dialog"
                      className="-ml-2 flex min-h-[44px] min-w-0 items-center gap-1 rounded-2xl px-2 font-bold text-slate-800 transition hover:bg-slate-200/60">
                      <span className="truncate">{currentGroup?.name ?? "Chọn nhóm"}</span>
                      <ChevronDown size={18} className="shrink-0 text-slate-500" />
                    </button>
                  </div>

                  {dataLoading ? (
                    <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
                  ) : members.length === 0 ? (
                    <EmptyState icon={<UsersRound size={22} />} title="Nhóm chưa có học sinh"
                      hint="Thêm học sinh rồi lên lịch học để theo dõi tiến độ tại đây."
                      action={
                        <button onClick={() => { setTab("people"); openAddStudent(); }} className={primaryBtn}>
                          <Plus size={18} className="mr-1 inline" />Thêm học sinh
                        </button>
                      } />
                  ) : sessions.length === 0 ? (
                    // 0/0 is arithmetically fine but tells the user nothing, so the
                    // totals card and every member row stay hidden until real data exists.
                    <EmptyState icon={<CalendarDays size={22} />} title="Chưa có dữ liệu tiến độ"
                      hint="Tạo lịch học và đánh dấu hoàn thành để theo dõi tiến độ tại đây."
                      action={
                        <button onClick={() => { setTab("home"); openSchedule(); }} className={primaryBtn}>
                          <Plus size={18} className="mr-1 inline" />Tạo lịch học
                        </button>
                      } />
                  ) : (
                    <>
                      <div className="rounded-3xl bg-white p-5 shadow-sm">
                        <p className="text-sm text-slate-500">Tổng số buổi hoàn thành</p>
                        <div className="text-4xl font-black text-indigo-600">
                          {doneCount}<span className="text-lg text-slate-400"> / {sessions.length}</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-indigo-600 transition-all"
                            style={{ width: `${(doneCount / sessions.length) * 100}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {Math.round((doneCount / sessions.length) * 100)}% tổng số buổi của nhóm
                        </p>
                      </div>
                      <div className="mt-3 space-y-2">
                        {members.map((m) => {
                          const total = sessions.filter((s) => s.memberId === m.id).length;
                          const done = sessions.filter((s) => s.memberId === m.id && s.done).length;
                          return (
                            <div key={m.id} className="rounded-3xl bg-white p-4 shadow-sm">
                              <div className="flex items-baseline justify-between gap-3">
                                <b className="truncate">{m.name}</b>
                                <span className="shrink-0 text-sm text-slate-500">
                                  {total === 0 ? "Chưa có lịch" : `${done}/${total} buổi`}
                                </span>
                              </div>
                              {total > 0 && (
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}

              {tab === "settings" && (
                <div className="space-y-5">
                  <section>
                    <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">Tài khoản</h2>
                    <div className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm">
                      {/* Cùng một icon chữ viết tắt như trên header, không dùng ảnh nhà cung cấp. */}
                      <AccountAvatar name={accountName} email={userEmail} tone="onWhite" className="h-12 w-12" />
                      <div className="min-w-0 flex-1">
                        <b className="block truncate">{accountName || userEmail || "Tài khoản"}</b>
                        {accountName && userEmail && <p className="truncate text-sm text-slate-500">{userEmail}</p>}
                        {/* One badge per linked identity: an account can sign in
                            with a password and still have Google or Facebook linked. */}
                        {userProviders.filter((x) => x !== "email").length > 0 && (
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {userProviders.filter((x) => x !== "email").map((x) => (
                              <span key={x} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold capitalize text-slate-600">{x}</span>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">Nhóm</h2>
                    <div className="space-y-2">
                      {groups.map((g) => {
                        const active = g.id === groupId;
                        return (
                          <div key={g.id}
                            className={`flex items-center gap-2 rounded-3xl p-4 shadow-sm transition ${active ? "bg-indigo-50 ring-1 ring-indigo-200" : "bg-white"}`}>
                            <button onClick={() => setGroupId(g.id)} aria-current={active ? "true" : undefined}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left">
                              <Check size={18} className={`shrink-0 ${active ? "text-indigo-600" : "invisible"}`} />
                              <span className="min-w-0">
                                <span className={`block truncate font-bold ${active ? "text-indigo-800" : ""}`}>{g.name}</span>
                                <span className={`block text-xs ${active ? "text-indigo-500" : "text-slate-500"}`}>
                                  {/* Nhãn này nói nhóm nào chứa hồ sơ của bạn — khác hẳn dấu ✓,
                                      vốn chỉ là nhóm đang xem. Hai thứ độc lập nhau. */}
                                  {selfGroupIds.has(g.id) && <span className="font-bold text-indigo-600">Nhóm của bạn · </span>}
                                  {memberCounts[g.id] ?? 0} học sinh
                                </span>
                              </span>
                            </button>
                            {/* Dữ liệu dùng chung: mọi tài khoản đã đăng nhập đều sửa được
                                mọi nhóm, nên không còn phân biệt chủ nhóm với khách. */}
                            <RowMenu
                              label={`Tùy chọn cho nhóm ${g.name}`}
                              items={[
                                { label: "Xem học sinh", icon: <UsersRound size={15} />, onSelect: () => { setGroupId(g.id); setTab("people"); } },
                                { label: "Đổi tên nhóm", icon: <Pencil size={15} />, onSelect: () => setGroupForm({ mode: "rename", id: g.id, name: g.name }) },
                                { label: "Xóa nhóm", icon: <Trash2 size={15} />, danger: true, onSelect: () => askDeleteGroup(g) },
                              ]}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => setGroupForm({ mode: "create", name: "" })}
                      className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 font-bold text-indigo-600 transition hover:bg-indigo-50">
                      <Plus size={18} />Tạo nhóm mới
                    </button>
                  </section>

                  <button onClick={logout} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-red-50 font-bold text-red-600 transition hover:bg-red-100">
                    <LogOut size={17} />Đăng xuất thiết bị này
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {groups.length > 0 && (
          <nav className="z-30 flex w-full shrink-0 justify-around border-t border-slate-200 bg-white/95 backdrop-blur sm:rounded-b-[34px]"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            {TABS.map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
                className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-bold transition ${tab === id ? "text-indigo-600" : "text-slate-600 hover:text-slate-900"}`}>
                <Icon size={20} />{label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* --- sheets ---------------------------------------------------- */}
      <Sheet open={showAccount} title="Tài khoản" onClose={() => setShowAccount(false)}>
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
          <AccountAvatar name={accountName} email={userEmail} tone="onWhite"
            className="h-12 w-12" />
          <span className="min-w-0 flex-1">
            <b className="block truncate">{accountName || userEmail}</b>
            {/* Không lặp lại email làm dòng phụ khi nó đã là dòng chính. */}
            {accountName && <span className="block truncate text-xs text-slate-500">{userEmail}</span>}
          </span>
        </div>
        <div className="my-3 h-px bg-slate-200" />
        <div className="space-y-1">
          {selfMember && (
            <button onClick={openSelfProfile}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 font-bold text-slate-700 transition hover:bg-slate-100">
              <User size={18} className="text-slate-400" />Hồ sơ học sinh
            </button>
          )}
          <button onClick={() => { setShowAccount(false); setTab("settings"); }}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 font-bold text-slate-700 transition hover:bg-slate-100">
            <Settings size={18} className="text-slate-400" />Cài đặt
          </button>
          <a href={VIOEDU_URL} target="_blank" rel="noopener noreferrer" onClick={() => setShowAccount(false)}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 font-bold text-slate-700 transition hover:bg-slate-100">
            <ExternalLink size={18} className="text-slate-400" />Mở VioEdu
          </a>
          <button onClick={() => { setShowAccount(false); void logout(); }}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 font-bold text-red-600 transition hover:bg-red-50">
            <LogOut size={18} />Đăng xuất
          </button>
        </div>
      </Sheet>

      <Sheet open={showGroupPicker} title="Chọn nhóm" onClose={() => setShowGroupPicker(false)}>
        {/* Chỉ chọn nhóm đang xem. Tạo, đổi tên và xóa nhóm nằm ở Cài đặt, để
            một thao tác không có mặt ở hai màn. */}
        <div className="space-y-1">
          {groups.map((g) => (
            <button key={g.id} onClick={() => { setGroupId(g.id); setShowGroupPicker(false); }}
              className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${g.id === groupId ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-100"}`}>
              <Check size={18} className={`shrink-0 ${g.id === groupId ? "" : "invisible"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{g.name}</span>
                <span className={`block text-xs ${g.id === groupId ? "text-indigo-500" : "text-slate-500"}`}>
                  {memberCounts[g.id] ?? 0} học sinh
                </span>
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => { setShowGroupPicker(false); setTab("people"); }}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 font-bold text-slate-700 transition hover:bg-slate-200">
          <UsersRound size={17} />Xem học sinh của nhóm
        </button>
        <p className="mt-3 text-center text-xs text-slate-500">Tạo, đổi tên hay xóa nhóm ở tab Cài đặt.</p>
      </Sheet>

      {groupFormSheet}

      <Sheet open={!!memberForm}
        title={memberForm?.id ? "Đổi tên học sinh" : memberForm?.step2 ? "Bước 2 · Thêm học sinh" : "Thêm học sinh"}
        onClose={() => setMemberForm(null)}>
        {memberForm?.step2 && (
          <p className="mb-4 rounded-2xl bg-indigo-50 px-3 py-3 text-sm text-indigo-800">
            Đã tạo nhóm <b>{currentGroup?.name}</b>. Thêm học sinh cho nhóm, hoặc đóng để làm sau.
          </p>
        )}
        {/* Thêm học sinh chỉ còn một cách: chọn từ những người đã đăng nhập và
            đã đặt tên học sinh. Không còn đường tạo hồ sơ bằng tay. */}
        {memberForm?.id ? (
          <>
            <label className="block">
              <span className="text-sm font-bold">Tên học sinh</span>
              <input autoFocus value={memberForm.name}
                onChange={(e) => setMemberForm((f) => (f ? { ...f, name: e.target.value } : f))}
                onKeyDown={(e) => { if (e.key === "Enter") void submitMember(); }} className={`mt-1 ${field}`}
                placeholder="Nhập tên học sinh" />
            </label>
            <button disabled={busy || !memberForm.name.trim()} onClick={submitMember} className={`mt-5 ${primaryBtn}`}>
              {busy ? "Đang lưu..." : "Lưu tên"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-bold">Học sinh đã có</p>
            <p className="mb-2 mt-0.5 text-xs text-slate-500">Chọn học sinh để liên kết với nhóm này</p>
            {profilesError && (
              <p className="mb-2 rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-800">
                Chưa đọc được danh sách tài khoản. Hãy chạy supabase-profiles.sql trong Supabase → SQL Editor.
                <span className="mt-1 block break-words text-xs text-amber-700">{profilesError}</span>
              </p>
            )}
            {members.length > 0 && (
              <p className="mb-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Đã trong nhóm: <span className="text-slate-600">{members.map((m) => m.name).join(", ")}</span>
              </p>
            )}
            {studentOptions.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
                Chưa có học sinh nào để thêm vào nhóm này. Học sinh xuất hiện ở đây sau khi được tạo ở một nhóm khác, hoặc khi tự đăng nhập và đặt tên của mình.
              </p>
            ) : (
              <div className="space-y-1">
                {studentOptions.map((st) => (
                  <button key={st.user_id ?? st.name} disabled={!!linkingId} onClick={() => void addKnownStudent(st)}
                    className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-slate-100 disabled:opacity-50">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-base font-extrabold text-indigo-700">
                      {initials(st.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold">{st.name}</span>
                    <span className="shrink-0 px-2 text-sm font-bold text-indigo-600">
                      {linkingId === (st.user_id ?? st.name) ? "Đang thêm..." : "Thêm"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Sheet>

      <Sheet open={!!scheduleForm} title={scheduleForm?.id ? "Sửa lịch học" : "Thêm lịch học"} onClose={() => setScheduleForm(null)}>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-bold">Học sinh</span>
            <select value={scheduleForm?.memberId ?? ""} onChange={(e) => setScheduleForm((f) => (f ? { ...f, memberId: e.target.value } : f))} className={`mt-1 ${field}`}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <div>
            <span className="text-sm font-bold">Giờ bắt đầu</span>
            <div className="mt-1">
              <TimePicker value={scheduleForm?.time ?? DEFAULT_TIME} onChange={(t) => setScheduleForm((f) => (f ? { ...f, time: t } : f))} />
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-bold">Thời lượng</span>
            <select value={scheduleForm?.duration ?? 30} onChange={(e) => setScheduleForm((f) => (f ? { ...f, duration: +e.target.value } : f))} className={`mt-1 ${field}`}>
              {DURATIONS.map((d) => <option key={d} value={d}>{d} phút</option>)}
            </select>
          </label>
          {scheduleForm && (
            <p className="rounded-2xl bg-slate-100 p-3 text-sm text-slate-600">
              {fmt12(scheduleForm.time)} - {fmt12(endOf(scheduleForm.time, scheduleForm.duration))}
              {!scheduleForm.id && <> · {dateLabel(selectedDate)}</>}
            </p>
          )}
        </div>
        <button disabled={busy || !scheduleForm?.memberId} onClick={submitSchedule} className={`mt-5 ${primaryBtn}`}>
          {busy ? "Đang lưu..." : "Lưu lịch học"}
        </button>
        {members.length === 0 && <p className="mt-2 text-center text-xs text-slate-500">Nhóm chưa có học sinh nào.</p>}
      </Sheet>

      {/* Chi tiết học sinh: mở từ chính thẻ học sinh, khóa theo id của hàng
          group_members chứ không theo tên. */}
      <Sheet open={!!studentDetail} title={studentDetail?.name ?? ""} onClose={() => setStudentDetail(null)}>
        {studentDetail && (() => {
          const own = sessions.filter((x) => x.memberId === studentDetail.id);
          const done = own.filter((x) => x.done).length;
          // "Sắp tới" là buổi chưa đánh dấu hoàn thành và chưa tới giờ. Dữ liệu
          // chỉ có cờ done, không có hủy hay vắng, nên đây là toàn bộ định nghĩa.
          const upcoming = own.filter((x) => !x.done && startsAt(x) >= today.getTime()).sort((a, b) => startsAt(a) - startsAt(b));
          const past = own.filter((x) => x.done || startsAt(x) < today.getTime()).sort((a, b) => startsAt(b) - startsAt(a));
          // Ưu tiên buổi sắp tới; thiếu thì bù bằng buổi gần đây nhất. Tối đa ba
          // hàng, để hồ sơ không dài ra theo số buổi học.
          const shown = [...upcoming, ...past].slice(0, 3);
          const account = studentDetail.user_id ? profiles.find((x) => x.id === studentDetail.user_id) : undefined;
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-lg font-extrabold text-indigo-700">
                  {initials(studentDetail.name) || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{studentDetail.name}</b>
                  <span className="block truncate text-xs text-slate-500">
                    {account?.email ?? "Chưa gắn tài khoản"} · {currentGroup?.name}
                  </span>
                </span>
              </div>

              {linkSupported && (
                <label className="block">
                  <span className="text-sm font-bold">Tài khoản đăng nhập</span>
                  {/* Một tài khoản đại diện một học sinh, nên tài khoản đã gắn cho
                      em khác không xuất hiện ở đây. */}
                  <select disabled={busy} value={studentDetail.user_id ?? ""} className={`mt-1 ${field}`}
                    onChange={(e) => void linkStudentAccount(studentDetail, e.target.value)}>
                    <option value="">Chưa gắn tài khoản</option>
                    {profiles
                      .filter((x) => x.id === studentDetail.user_id || !studentNames[x.id])
                      .map((x) => <option key={x.id} value={x.id}>{x.email ?? x.id}</option>)}
                  </select>
                </label>
              )}

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <p className="text-2xl font-extrabold text-indigo-700">{done}</p>
                  <p className="text-xs text-slate-500">buổi hoàn thành</p>
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <p className="text-2xl font-extrabold text-slate-700">{upcoming.length}</p>
                  <p className="text-xs text-slate-500">buổi sắp tới</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-bold">Lịch học</p>
                {own.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500">Chưa có buổi học nào trong nhóm này.</p>
                ) : (
                  <>
                    {/* Không cuộn riêng ở đây: cả sheet cuộn là đủ, và ba hàng thì không cần. */}
                    <div className="space-y-1">
                      {shown.map((x) => (
                        <div key={x.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                          <Clock3 size={15} className="shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate">{dateLabel(new Date(x.date))} · {fmt12(x.time)}</span>
                          {x.done && <Check size={16} className="shrink-0 text-emerald-600" />}
                        </div>
                      ))}
                    </div>
                    {own.length > shown.length && (
                      <button onClick={() => { setStudentFilter(studentDetail.id); setStudentDetail(null); setTab("home"); }}
                        className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1 text-sm font-bold text-indigo-600 transition hover:text-indigo-700">
                        Xem tất cả lịch học<ChevronRight size={16} />
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-4">
                <button onClick={() => { setStudentDetail(null); setMemberForm({ id: studentDetail.id, name: studentDetail.name }); }}
                  className="flex min-h-[48px] w-full items-center gap-2 rounded-2xl bg-slate-100 px-4 font-bold text-slate-700 transition hover:bg-slate-200">
                  <Pencil size={16} />Sửa thông tin
                </button>
                <button onClick={() => openMove(studentDetail)} disabled={groups.length < 2}
                  className="flex min-h-[48px] w-full items-center gap-2 rounded-2xl bg-slate-100 px-4 font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50">
                  <UsersRound size={16} />Chuyển nhóm
                </button>
                <button onClick={() => { setStudentDetail(null); askDeleteMember(studentDetail); }}
                  className="flex min-h-[48px] w-full items-center gap-2 rounded-2xl bg-red-50 px-4 font-bold text-red-600 transition hover:bg-red-100">
                  <Trash2 size={16} />Xóa học sinh
                </button>
              </div>
            </div>
          );
        })()}
      </Sheet>

      <Sheet open={!!moveForm} title={`Chuyển ${moveForm?.member.name ?? ""}`} onClose={() => setMoveForm(null)}>
        <label className="block">
          <span className="text-sm font-bold">Nhóm nhận</span>
          <select value={moveForm?.targetId ?? ""} onChange={(e) => setMoveForm((f) => (f ? { ...f, targetId: e.target.value } : f))}
            className={`mt-1 ${field}`}>
            {groups.filter((g) => g.id !== groupId).map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <p className="mt-3 text-sm text-slate-500">
          Lịch học của học sinh này được chuyển sang nhóm mới cùng với học sinh, không bị xóa.
        </p>
        <button disabled={busy || !moveForm?.targetId} onClick={submitMove} className={`mt-5 ${primaryBtn}`}>
          {busy ? "Đang chuyển..." : "Chuyển nhóm"}
        </button>
      </Sheet>

      <Sheet open={!!groupDelete} title={`Xóa nhóm "${groupDelete?.group.name ?? ""}"`} onClose={() => setGroupDelete(null)}>
        <p className="text-sm leading-relaxed text-slate-600">
          Nhóm này còn <b>{memberCounts[groupDelete?.group.id ?? ""] ?? 0} học sinh</b>. Chuyển họ sang nhóm khác để giữ lại cùng lịch học, hoặc xóa tất cả.
        </p>
        <label className="mt-4 block">
          <span className="text-sm font-bold">Chuyển học sinh sang nhóm</span>
          <select value={groupDelete?.targetId ?? ""} onChange={(e) => setGroupDelete((f) => (f ? { ...f, targetId: e.target.value } : f))}
            className={`mt-1 ${field}`}>
            {groups.filter((g) => g.id !== groupDelete?.group.id).map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <button disabled={busy || !groupDelete?.targetId} onClick={moveAllThenDelete} className={`mt-4 ${primaryBtn}`}>
          {busy ? "Đang chuyển..." : "Chuyển học sinh rồi xóa nhóm"}
        </button>
        <div className="my-4 h-px bg-slate-200" />
        {/* Lối thứ hai, cố ý kém nổi bật hơn: nó xóa cả người chứ không chỉ cái nhóm. */}
        <button disabled={busy}
          onClick={() => { const g = groupDelete!.group; setGroupDelete(null); confirmDeleteGroup(g); }}
          className="min-h-[48px] w-full rounded-2xl bg-red-50 px-4 font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50">
          Xóa nhóm cùng toàn bộ học sinh
        </button>
      </Sheet>

      <ConfirmDialog state={confirm} busy={confirmBusy} onClose={() => { if (!confirmBusy) setConfirm(null); }} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
