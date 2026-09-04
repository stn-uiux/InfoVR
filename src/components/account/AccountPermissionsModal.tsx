import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Icon } from "@iconify/react";
import { StnBadge, StnBadgeVariant } from "../ui/StnBadge";
import { useStore } from "../../store/useStore";
import { StnModal } from "../ui/StnModal";
import { StnTable, StnTableColumn } from "../ui/StnTable";
import { CreateAccountModal } from "./CreateAccountModal";

type AccountRole = "admin" | "editor" | "viewer" | "pending";
type AccountStatus = "활성" | "정지";

interface AccountGroup {
  id: string;
  name: string;
  parentId: string | null; // null = root level
}

interface AccountData {
  id: number;
  name: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  allowedRooms: string[];
  groupId: string;
  createdAt: string;
}

// --- Room Tree ---
interface RoomTreeNode { id: string; name: string; children?: RoomTreeNode[]; }

const ROOM_TREE: RoomTreeNode[] = [
  {
    id: "sudogwon", name: "수도권", children: [
      {
        id: "seoul", name: "서울", children: [
          {
            id: "gangnam-center", name: "강남센터", children: [
              { id: "gangnam-room-1", name: "강남 1전산실" },
              { id: "gangnam-room-2", name: "강남 2전산실" },
              { id: "gangnam-room-3", name: "강남 3전산실" },
            ]
          },
          {
            id: "gangbuk-center", name: "강북센터", children: [
              { id: "gangbuk-room-1", name: "강북 1전산실" },
              { id: "gangbuk-room-2", name: "강북 2전산실" },
            ]
          }
        ]
      },
      {
        id: "gyeonggi", name: "경기", children: [
          {
            id: "gwacheon-center", name: "과천센터", children: [
              { id: "gwacheon-room-1", name: "과천 1전산실" },
              { id: "gwacheon-room-2", name: "과천 2전산실" },
            ]
          }
        ]
      }
    ]
  },
  {
    id: "chungcheong", name: "충청권", children: [
      { id: "daejeon-center", name: "대전센터", children: [{ id: "daejeon-room-1", name: "대전센터 전산실" }] },
      { id: "sejong-center", name: "세종센터", children: [{ id: "sejong-room-1", name: "세종센터 전산실" }] }
    ]
  }
];

const getAllLeafIds = (nodes: RoomTreeNode[]): string[] => {
  const r: string[] = [];
  const w = (n: RoomTreeNode) => { if (!n.children?.length) r.push(n.id); else n.children.forEach(w); };
  nodes.forEach(w); return r;
};
const ALL_ROOM_IDS = getAllLeafIds(ROOM_TREE);

// --- Default Groups (nested) ---
const DEFAULT_GROUPS: AccountGroup[] = [
  { id: "dev", name: "개발실", parentId: null },
  { id: "dev-front", name: "프론트엔드", parentId: "dev" },
  { id: "dev-back", name: "백엔드", parentId: "dev" },
  { id: "ops", name: "운영실", parentId: null },
  { id: "ops-infra", name: "인프라", parentId: "ops" },
  { id: "ops-noc", name: "NOC", parentId: "ops" },
  { id: "sec", name: "보안팀", parentId: null },
  { id: "mgmt", name: "경영지원", parentId: null },
];

const ALL_GROUP_IDS = ["dev-front", "dev-back", "ops-infra", "ops-noc", "sec", "mgmt"];

const randomDate = (start: Date, end: Date) => {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split("T")[0];
};

const DUMMY_ACCOUNTS: AccountData[] = Array.from({ length: 50 }, (_, i) => {
  const roles: AccountRole[] = ["admin", "editor", "viewer"];
  const statuses: AccountStatus[] = ["활성", "활성", "활성", "정지"];
  const role = roles[i % 3];
  const rooms = role === "admin" ? [...ALL_ROOM_IDS] : role === "editor" ? ALL_ROOM_IDS.filter((_, x) => x % 2 === 0) : ALL_ROOM_IDS.slice(0, 3);
  return { id: i + 1, name: `테스트사용자 ${i + 1}`, email: `user${i + 1}@infovr.local`, role, status: statuses[i % 4], allowedRooms: rooms, groupId: ALL_GROUP_IDS[i % ALL_GROUP_IDS.length], createdAt: randomDate(new Date(2024, 0, 1), new Date(2026, 7, 27)) };
});
DUMMY_ACCOUNTS[0] = { id: 1, name: "김운영", email: "admin@infovr.local", role: "admin", status: "활성", allowedRooms: [...ALL_ROOM_IDS], groupId: "ops-infra", createdAt: "2024-01-15" };
DUMMY_ACCOUNTS[1] = { id: 2, name: "박관리", email: "manager@infovr.local", role: "editor", status: "활성", allowedRooms: ALL_ROOM_IDS.filter((_, i) => i % 2 === 0), groupId: "ops-noc", createdAt: "2024-03-22" };
DUMMY_ACCOUNTS[2] = { id: 3, name: "이담당", email: "viewer1@infovr.local", role: "viewer", status: "정지", allowedRooms: ALL_ROOM_IDS.slice(0, 2), groupId: "sec", createdAt: "2024-06-10" };
DUMMY_ACCOUNTS[3] = { id: 4, name: "최엔지니어", email: "eng@infovr.local", role: "editor", status: "활성", allowedRooms: ALL_ROOM_IDS.slice(0, 5), groupId: "dev-front", createdAt: "2025-01-08" };
DUMMY_ACCOUNTS[4] = { id: 5, name: "신입사원", email: "newbie@infovr.local", role: "pending", status: "활성", allowedRooms: [], groupId: "none", createdAt: "2026-08-20" };
DUMMY_ACCOUNTS[5] = { id: 6, name: "외주작업자", email: "contractor@infovr.local", role: "pending", status: "활성", allowedRooms: [], groupId: "none", createdAt: "2026-08-25" };
DUMMY_ACCOUNTS[6] = { id: 7, name: "개발실장", email: "dev_lead@infovr.local", role: "admin", status: "활성", allowedRooms: [...ALL_ROOM_IDS], groupId: "dev", createdAt: "2024-01-01" };
DUMMY_ACCOUNTS[7] = { id: 8, name: "운영실장", email: "ops_lead@infovr.local", role: "admin", status: "활성", allowedRooms: [...ALL_ROOM_IDS], groupId: "ops", createdAt: "2024-01-01" };

// ============================================================
// Utility: get all descendant group IDs (inclusive)
// ============================================================
const getDescendantGroupIds = (groups: AccountGroup[], parentId: string): string[] => {
  const result = [parentId];
  const children = groups.filter(g => g.parentId === parentId);
  children.forEach(c => result.push(...getDescendantGroupIds(groups, c.id)));
  return result;
};

const isDescendantOf = (groups: AccountGroup[], childId: string, ancestorId: string): boolean => {
  let current = groups.find(g => g.id === childId);
  while (current) {
    if (current.parentId === ancestorId) return true;
    current = groups.find(g => g.id === current!.parentId);
  }
  return false;
};

// ============================================================
// Room Tree Picker
// ============================================================
const RoomTreePicker = ({ tree, checked, onToggle }: { tree: RoomTreeNode[]; checked: Set<string>; onToggle: (id: string, desc: string[]) => void }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["sudogwon", "chungcheong", "seoul", "gyeonggi"]));
  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const leafs = (n: RoomTreeNode): string[] => !n.children?.length ? [n.id] : n.children.flatMap(leafs);
  const state = (n: RoomTreeNode): "all" | "partial" | "none" => {
    if (!n.children?.length) return checked.has(n.id) ? "all" : "none";
    const l = leafs(n), c = l.filter(id => checked.has(id)).length;
    return c === 0 ? "none" : c === l.length ? "all" : "partial";
  };
  const render = (n: RoomTreeNode, d: number): React.ReactNode => {
    const hk = n.children && n.children.length > 0, ie = expanded.has(n.id), s = state(n), ls = leafs(n);
    return <div key={n.id}>
      <div className="room-tree-node" style={{ paddingLeft: `${d * 20 + 8}px` }}>
        {hk ? <span className="room-tree-toggle" onClick={() => toggle(n.id)}><Icon icon={ie ? "material-symbols:expand-more" : "material-symbols:chevron-right"} style={{ fontSize: "18px" }} /></span>
          : <span className="room-tree-toggle" style={{ visibility: "hidden" }}><Icon icon="material-symbols:chevron-right" style={{ fontSize: "18px" }} /></span>}
        <label className="room-tree-checkbox-label">
          <input type="checkbox" checked={s === "all"} ref={el => { if (el) el.indeterminate = s === "partial"; }} onChange={() => onToggle(n.id, ls)} className="room-tree-checkbox" />
          <Icon icon={hk ? "fluent:folder-24-filled" : "fluent:building-24-filled"} style={{ fontSize: "16px", color: hk ? "var(--theme-primary)" : "var(--text-tertiary)", marginRight: "6px" }} />
          <span className="room-tree-label">{n.name}</span>
        </label>
      </div>
      {hk && ie && n.children!.map(c => render(c, d + 1))}
    </div>;
  };
  return <div className="room-tree-container">{tree.map(n => render(n, 0))}</div>;
};

// ============================================================
// Context Menu
// ============================================================
const ContextMenu = ({ x, y, items, onClose }: {
  x: number; y: number;
  items: { label: string; icon: string; danger?: boolean; onClick: () => void }[];
  onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div ref={ref} className="ctx-menu" style={{ left: x, top: y }}>
      {items.map((item, i) => (
        <button key={i} className={`ctx-menu-item ${item.danger ? "danger" : ""}`} onClick={() => { item.onClick(); onClose(); }}>
          <Icon icon={item.icon} style={{ fontSize: "16px" }} />{item.label}
        </button>
      ))}
    </div>
  );
};

// ============================================================
// Group Tree Sidebar (recursive, drag & drop)
// ============================================================
const GroupTreeSidebar = ({
  groups, selectedGroupId, onSelectGroup, accountCounts,
  onCreateGroup, onRenameGroup, onDeleteGroup, onMoveGroup,
}: {
  groups: AccountGroup[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
  accountCounts: Record<string, number>;
  onCreateGroup: (parentId: string | null) => void;
  onRenameGroup: (g: AccountGroup) => void;
  onDeleteGroup: (id: string) => void;
  onMoveGroup: (groupId: string, newParentId: string | null) => void;
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(groups.filter(g => g.parentId === null).map(g => g.id)));
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; groupId: string | null } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const toggleExpand = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleCtx = (e: React.MouseEvent, groupId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, groupId });
  };

  const ctxItems = () => {
    const items: { label: string; icon: string; danger?: boolean; onClick: () => void }[] = [];
    if (ctxMenu?.groupId && ctxMenu.groupId !== "all" && ctxMenu.groupId !== "none") {
      items.push({ label: "하위 그룹 추가", icon: "fluent:folder-add-24-regular", onClick: () => onCreateGroup(ctxMenu!.groupId) });
      const g = groups.find(g => g.id === ctxMenu.groupId);
      if (g) {
        items.push({ label: "이름 변경", icon: "material-symbols:edit", onClick: () => onRenameGroup(g) });
        items.push({ label: "그룹 삭제", icon: "material-symbols:delete", danger: true, onClick: () => onDeleteGroup(g.id) });
      }
    } else {
      items.push({ label: "새 그룹 추가", icon: "fluent:folder-add-24-regular", onClick: () => onCreateGroup(null) });
    }
    return items;
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, groupId: string) => {
    e.dataTransfer.setData("text/group-id", groupId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(targetId);
  };

  const handleDragLeave = () => setDragOverId(null);

  const handleDrop = (e: React.DragEvent, targetParentId: string | null) => {
    e.preventDefault();
    setDragOverId(null);
    const draggedId = e.dataTransfer.getData("text/group-id");
    if (!draggedId || draggedId === targetParentId) return;
    // Prevent dropping onto self or descendant
    if (targetParentId && (draggedId === targetParentId || isDescendantOf(groups, targetParentId, draggedId))) return;
    onMoveGroup(draggedId, targetParentId);
  };

  const getChildren = (parentId: string | null) => groups.filter(g => g.parentId === parentId);

  const renderGroup = (group: AccountGroup, depth: number) => {
    const children = getChildren(group.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(group.id);
    const isActive = selectedGroupId === group.id;
    const isDragOver = dragOverId === group.id;

    return (
      <div key={group.id}>
        <div
          className={`group-tree-item ${isActive ? "active" : ""} ${isDragOver ? "drag-over" : ""}`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => onSelectGroup(group.id)}
          onContextMenu={(e) => handleCtx(e, group.id)}
          draggable
          onDragStart={(e) => handleDragStart(e, group.id)}
          onDragOver={(e) => handleDragOver(e, group.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, group.id)}
        >
          {hasChildren ? (
            <span className="group-tree-toggle" onClick={(e) => { e.stopPropagation(); toggleExpand(group.id); }}>
              <Icon icon={isExpanded ? "material-symbols:expand-more" : "material-symbols:chevron-right"} style={{ fontSize: "16px" }} />
            </span>
          ) : (
            <span className="group-tree-toggle-spacer" />
          )}
          <Icon icon={hasChildren && isExpanded ? "fluent:folder-open-24-filled" : "fluent:folder-24-filled"} style={{ fontSize: "15px", color: isActive ? "var(--theme-primary)" : "var(--text-tertiary)", flexShrink: 0 }} />
          <span className="group-tree-name">{group.name}</span>
          <span className="group-tree-count">{accountCounts[group.id] || 0}</span>
        </div>
        {hasChildren && isExpanded && children.map(c => renderGroup(c, depth + 1))}
      </div>
    );
  };

  const rootGroups = getChildren(null);

  return (
    <div className="group-sidebar" onContextMenu={(e) => handleCtx(e, null)} onDragOver={(e) => { e.preventDefault(); setDragOverId("root"); }} onDrop={(e) => handleDrop(e, null)}>
      <div className="group-sidebar-title" onContextMenu={(e) => e.stopPropagation()}>
        <Icon icon="fluent:organization-24-filled" style={{ fontSize: "16px" }} />
        그룹
      </div>
      <div className="group-sidebar-list">
        {/* 전체 */}
        <div
          className={`group-tree-item ${selectedGroupId === "all" ? "active" : ""}`}
          style={{ paddingLeft: "12px" }}
          onClick={() => onSelectGroup("all")}
          onContextMenu={(e) => handleCtx(e, "all")}
        >
          <Icon icon="fluent:people-community-24-filled" style={{ fontSize: "15px", color: selectedGroupId === "all" ? "var(--theme-primary)" : "var(--text-tertiary)" }} />
          <span className="group-tree-name">전체</span>
          <span className="group-tree-count">{accountCounts["all"] || 0}</span>
        </div>

        {/* Tree */}
        {rootGroups.map(g => renderGroup(g, 0))}

        {/* 미지정 */}
        <div
          className={`group-tree-item ${selectedGroupId === "none" ? "active" : ""} ${dragOverId === "none-drop" ? "drag-over" : ""}`}
          style={{ paddingLeft: "36px", marginTop: "4px", borderTop: "1px solid var(--border-weak)", paddingTop: "8px" }}
          onClick={() => onSelectGroup("none")}
          onDragOver={(e) => { e.preventDefault(); setDragOverId("none-drop"); }}
          onDragLeave={handleDragLeave}
          onDrop={(e) => { e.preventDefault(); setDragOverId(null); /* accounts drop only - groups cant go to none */ }}
        >
          <Icon icon="fluent:folder-open-24-regular" style={{ fontSize: "15px", opacity: 0.5 }} />
          <span className="group-tree-name">미지정</span>
          <span className="group-tree-count">{accountCounts["none"] || 0}</span>
        </div>
      </div>
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxItems()} onClose={() => setCtxMenu(null)} />}
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================
export const AccountPermissionsModal = () => {
  const { settingsModalOpen, setSettingsModalOpen, settingsModalTab, setSettingsModalTab, showToast } = useStore();
  const [accounts, setAccounts] = useState<AccountData[]>(DUMMY_ACCOUNTS);
  const [groups, setGroups] = useState<AccountGroup[]>(DEFAULT_GROUPS);

  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [batchRole, setBatchRole] = useState<AccountRole>("admin");
  const [batchGroupId, setBatchGroupId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");

  const [roomModalUser, setRoomModalUser] = useState<AccountData | null>(null);
  const [roomChecked, setRoomChecked] = useState<Set<string>>(new Set());

  const [renameGroup, setRenameGroup] = useState<AccountGroup | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false);

  // Computed
  const accountCounts = useMemo(() => {
    const counts: Record<string, number> = { all: accounts.length, none: 0 };
    const knownIds = new Set(groups.map(g => g.id));
    // Each group count = direct members only (not descendants) for the count badge
    groups.forEach(g => { counts[g.id] = accounts.filter(a => a.groupId === g.id).length; });
    counts["none"] = accounts.filter(a => !a.groupId || a.groupId === "none" || !knownIds.has(a.groupId)).length;
    return counts;
  }, [accounts, groups]);

  const filteredAccounts = useMemo(() => {
    if (selectedGroupId === "all") return accounts;
    if (selectedGroupId === "none") {
      const knownIds = new Set(groups.map(g => g.id));
      return accounts.filter(a => !a.groupId || a.groupId === "none" || !knownIds.has(a.groupId));
    }
    // Include accounts from this group AND all descendant groups
    const descendantIds = getDescendantGroupIds(groups, selectedGroupId);
    return accounts.filter(a => descendantIds.includes(a.groupId));
  }, [accounts, selectedGroupId, groups]);


  const getGroupName = (gid: string) => {
    if (!gid || gid === "none") return "미지정";
    const group = groups.find(g => g.id === gid);
    if (!group) return "미지정";
    const buildPath = (g: AccountGroup): string => {
      const parent = groups.find(p => p.id === g.parentId);
      return parent ? `${buildPath(parent)} > ${g.name}` : g.name;
    };
    return buildPath(group);
  };

  const getGroupDepth = useCallback((gid: string) => {
    if (!gid || gid === "none") return 999;
    let depth = 0;
    let curr = groups.find(g => g.id === gid);
    while (curr && curr.parentId) {
      depth++;
      curr = groups.find(g => g.id === curr!.parentId);
    }
    return depth;
  }, [groups]);

  const handlePreSort = useCallback((a: AccountData, b: AccountData) => {
    if (selectedGroupId === "all") return 0;
    return getGroupDepth(a.groupId) - getGroupDepth(b.groupId);
  }, [getGroupDepth, selectedGroupId]);

  const getRowClassName = useCallback((record: AccountData) => {
    if (selectedGroupId === "all") {
      return getGroupDepth(record.groupId) === 0 ? "highlight-row" : "";
    }
    return record.groupId === selectedGroupId ? "highlight-row" : "";
  }, [selectedGroupId, getGroupDepth]);

  // --- Handlers ---
  const handleClose = () => setSettingsModalOpen(false);

  const handleDelete = (id: number) => {
    if (confirm("정말 이 계정을 삭제하시겠습니까?")) {
      setAccounts(accounts.filter(a => a.id !== id));
      showToast("계정이 성공적으로 삭제되었습니다.", "success");
    }
  };

  const handleRoleChange = (id: number, newRole: string) => {
    setAccounts(accounts.map(u => u.id === id ? { ...u, role: newRole as AccountRole } : u));
    showToast("권한이 성공적으로 변경되었습니다.", "success");
  };

  const handleBatchRoleUpdate = () => {
    setAccounts(accounts.map(u => selectedIds.includes(u.id) ? { ...u, role: batchRole } : u));
    showToast(`${selectedIds.length}개 계정의 권한이 ${batchRole.toUpperCase()}로 변경되었습니다.`, "success");
    setSelectedIds([]);
  };

  const handleBatchGroupMove = () => {
    if (!batchGroupId) return;
    setAccounts(accounts.map(u => selectedIds.includes(u.id) ? { ...u, groupId: batchGroupId } : u));
    showToast(`${selectedIds.length}개 계정이 '${getGroupName(batchGroupId)}' 그룹으로 이동되었습니다.`, "success");
    setSelectedIds([]);
  };

  const handleBatchDelete = () => {
    if (confirm(`선택한 ${selectedIds.length}개 계정을 삭제하시겠습니까?`)) {
      setAccounts(accounts.filter(a => !selectedIds.includes(a.id)));
      showToast(`${selectedIds.length}개 계정이 삭제되었습니다.`, "success");
      setSelectedIds([]);
    }
  };

  const handleCreateAccount = (data: { name: string; email: string; password: string; groupId: string; role: string }) => {
    const newAccount: AccountData = {
      id: Date.now(),
      name: data.name,
      email: data.email,
      role: data.role as AccountRole,
      status: "활성",
      allowedRooms: [],
      groupId: data.groupId,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setAccounts([newAccount, ...accounts]);
    showToast(`계정 '${data.name}'이(가) 추가되었습니다.`, "success");
    setIsCreateAccountModalOpen(false);
  };

  // Room
  const openRoomModal = (user: AccountData) => { setRoomModalUser(user); setRoomChecked(new Set(user.allowedRooms)); };
  const handleRoomToggle = (_: string, leafs: string[]) => {
    setRoomChecked(prev => {
      const n = new Set(prev);
      leafs.every(id => n.has(id)) ? leafs.forEach(id => n.delete(id)) : leafs.forEach(id => n.add(id));
      return n;
    });
  };
  const handleSaveRoomPermissions = () => {
    if (!roomModalUser) return;
    setAccounts(accounts.map(u => u.id === roomModalUser.id ? { ...u, allowedRooms: Array.from(roomChecked) } : u));
    showToast(`${roomModalUser.name}의 전산실 접근 권한이 저장되었습니다.`, "success");
    setRoomModalUser(null);
  };

  // Group CRUD
  const handleCreateGroup = (parentId: string | null) => {
    const name = prompt(parentId ? `'${getGroupName(parentId)}' 하위에 새 그룹 이름:` : "새 그룹 이름을 입력하세요:");
    if (!name?.trim()) return;
    const id = `grp-${Date.now()}`;
    setGroups([...groups, { id, name: name.trim(), parentId }]);
    showToast(`'${name.trim()}' 그룹이 생성되었습니다.`, "success");
  };

  const handleStartRename = (g: AccountGroup) => { setRenameGroup(g); setRenameValue(g.name); };
  const handleSaveRename = () => {
    if (!renameGroup || !renameValue.trim()) return;
    setGroups(groups.map(g => g.id === renameGroup.id ? { ...g, name: renameValue.trim() } : g));
    showToast("그룹 이름이 변경되었습니다.", "success");
    setRenameGroup(null);
  };

  const handleDeleteGroup = (gid: string) => {
    const descendants = getDescendantGroupIds(groups, gid);
    if (confirm("이 그룹과 하위 그룹을 모두 삭제하시겠습니까? 소속 계정은 미지정 상태가 됩니다.")) {
      setGroups(groups.filter(g => !descendants.includes(g.id)));
      setAccounts(accounts.map(a => descendants.includes(a.groupId) ? { ...a, groupId: "none" } : a));
      if (descendants.includes(selectedGroupId)) setSelectedGroupId("all");
      showToast("그룹이 삭제되었습니다.", "success");
    }
  };

  const handleMoveGroup = (groupId: string, newParentId: string | null) => {
    setGroups(groups.map(g => g.id === groupId ? { ...g, parentId: newParentId } : g));
    showToast(`그룹이 ${newParentId ? `'${getGroupName(newParentId)}' 하위로` : "최상위로"} 이동되었습니다.`, "success");
  };

  // Flat list of all groups for StnSelect
  const allGroupOptions = useMemo(() => {
    const buildLabel = (g: AccountGroup): string => {
      const parent = groups.find(p => p.id === g.parentId);
      return parent ? `${buildLabel(parent)} > ${g.name}` : g.name;
    };
    return groups.map(g => ({ value: g.id, label: buildLabel(g) }));
  }, [groups]);

  // --- Column Definitions ---
  const accountColumns: StnTableColumn<AccountData>[] = [
    { key: "name", title: "이름", sortable: true, sortValue: (u) => u.name, render: (u) => <div className="user-info-row"><div className={`user-avatar-sm role-${u.role}`}><Icon icon="fluent:person-24-filled" /></div><div className="user-name">{u.name}</div></div> },
    { key: "email", title: "아이디", sortable: true, sortValue: (u) => u.email, render: (u) => <div className="user-email">{u.email}</div> },
    { key: "group", title: "그룹", width: "120px", sortable: true, sortValue: (u) => getGroupName(u.groupId), render: (u) => <StnBadge variant="secondary">{getGroupName(u.groupId)}</StnBadge> },
    { key: "role", title: "권한", width: "120px", sortable: true, sortValue: (u) => u.role, render: (u) => { const m: Record<string, StnBadgeVariant> = { admin: "primary", editor: "success", viewer: "secondary", pending: "outline" }; return <StnBadge variant={m[u.role] || "secondary"}>{u.role === "pending" ? "승인대기" : u.role.toUpperCase()}</StnBadge>; } },
    { key: "status", title: "상태", width: "100px", sortable: true, sortValue: (u) => u.status, render: (u) => { const a = u.status === "활성"; return <div className="status-cell"><span className={`status-dot ${a ? "active" : "inactive"}`} /><span className={`status-text ${a ? "active" : "inactive"}`}>{u.status}</span></div>; } },
    { key: "createdAt", title: "생성일", width: "120px", sortable: true, sortValue: (u) => u.createdAt, render: (u) => <span className="date-text">{u.createdAt}</span> },
    { key: "actions", title: "관리", width: "100px", render: (u) => <div className="action-buttons"><button className="comm-btn comm-icon-btn comm-btn-sm comm-btn-tertiary" style={{ color: "var(--severity-critical)" }} onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }} title="삭제"><Icon icon="material-symbols:delete" className="icon" /></button></div> }
  ];

  const permissionColumns: StnTableColumn<AccountData>[] = [
    { key: "name", title: "이름", sortable: true, sortValue: (u) => u.name, render: (u) => <div className="user-info-row"><div className={`user-avatar-sm role-${u.role}`}><Icon icon="fluent:person-24-filled" /></div><div className="user-name">{u.name}</div></div> },
    { key: "email", title: "아이디", sortable: true, sortValue: (u) => u.email, render: (u) => <div className="user-email">{u.email}</div> },
    { key: "group", title: "그룹", width: "120px", sortable: true, sortValue: (u) => getGroupName(u.groupId), render: (u) => <StnBadge variant="secondary">{getGroupName(u.groupId)}</StnBadge> },
    { key: "roleSelect", title: "기본 권한", width: "200px", sortable: true, sortValue: (u) => u.role, render: (u) => <div style={{ width: "160px", margin: "0 auto" }}><select className="stn-input" style={{ height: "32px", fontSize: "13px" }} value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}><option value="admin">관리자 (Admin)</option><option value="editor">편집자 (Editor)</option><option value="viewer">조회자 (Viewer)</option><option value="pending">승인대기 (Pending)</option></select></div> },
    { key: "roomAccess", title: "전산실 접근", width: "160px", render: (u) => { 
      const c = u.allowedRooms.length, a = c === ALL_ROOM_IDS.length; 
      return (
        <button className="room-access-btn" onClick={(e) => { e.stopPropagation(); openRoomModal(u); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon icon="fluent:building-24-regular" style={{ fontSize: "16px", color: "var(--text-tertiary)" }} />
            <span>{a ? "전체" : `${c}개`}</span>
          </div>
          <Icon icon="material-symbols:chevron-right" style={{ fontSize: "16px", color: "var(--text-tertiary)" }} />
        </button>
      ); 
    } }
  ];

  if (!settingsModalOpen) return null;

  return (
    <StnModal isOpen={settingsModalOpen} onClose={handleClose} title="시스템 설정" icon="fluent:settings-24-filled" className="account-permissions-modal" style={{ width: "1360px", maxWidth: "95vw" }}>
      {/* Tabs */}
      <div className="modal-tabs-header">
        <button onClick={() => { setSettingsModalTab("accounts"); setSelectedIds([]); }} className={`modal-tab-btn ${settingsModalTab === "accounts" ? "active" : ""}`}>
          <Icon icon="fluent:people-24-regular" style={{ fontSize: "20px" }} /> 계정 관리
        </button>
        <button onClick={() => { setSettingsModalTab("permissions"); setSelectedIds([]); }} className={`modal-tab-btn ${settingsModalTab === "permissions" ? "active" : ""}`}>
          <Icon icon="fluent:shield-keyhole-24-regular" style={{ fontSize: "20px" }} /> 권한 설정
        </button>
      </div>

      {/* ===== 계정 관리 ===== */}
      {settingsModalTab === "accounts" && (
        <div className="modal-tab-content">
          <div className="modal-tab-toolbar">
            <p className="modal-tab-desc">전체 계정을 조회하고 계정의 그룹을 수정, 계정을 삭제/생성할 수 있습니다.</p>
            {selectedIds.length > 0 ? (
              <div className="modal-batch-toolbar">
                <span className="modal-batch-count">{selectedIds.length}개 선택됨</span>
                <div style={{ width: "160px" }}>
                  <select className="stn-input" style={{ height: "32px", fontSize: "13px" }} value={batchGroupId} onChange={(e) => setBatchGroupId(e.target.value)}><option value="" disabled>그룹 선택</option>{allGroupOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                </div>
                <button className="comm-btn comm-btn-sm comm-btn-primary" onClick={handleBatchGroupMove} disabled={!batchGroupId}>그룹 이동</button>
                <button className="comm-btn comm-btn-sm comm-btn-ghost" style={{ color: "var(--severity-critical)" }} onClick={handleBatchDelete}>
                  <Icon icon="material-symbols:delete" className="icon" /> 삭제
                </button>
              </div>
            ) : (
              <button className="comm-btn comm-btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }} onClick={() => setIsCreateAccountModalOpen(true)}>
                <Icon icon="fluent:person-add-24-filled" /> 새 계정 추가
              </button>
            )}
          </div>
          <div className="modal-body-with-sidebar">
            <GroupTreeSidebar groups={groups} selectedGroupId={selectedGroupId} onSelectGroup={(id) => { setSelectedGroupId(id); setSelectedIds([]); }} accountCounts={accountCounts} onCreateGroup={handleCreateGroup} onRenameGroup={handleStartRename} onDeleteGroup={handleDeleteGroup} onMoveGroup={handleMoveGroup} />
            <div className="modal-body-main">
              <StnTable columns={accountColumns} data={filteredAccounts} rowKey={(r) => r.id} selectedRowKeys={selectedIds} onSelectionChange={setSelectedIds} defaultSortKey="createdAt" defaultSortDir="desc" preSort={handlePreSort} rowClassName={getRowClassName} />
            </div>
          </div>
        </div>
      )}

      {/* ===== 권한 설정 ===== */}
      {settingsModalTab === "permissions" && (
        <div className="modal-tab-content">
          <div className="modal-tab-toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <p className="modal-tab-desc">시스템 사용자들의 접근 및 편집 권한을 관리합니다.</p>
              <div className="role-help-tooltip-container" style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Icon icon="fluent:question-circle-24-regular" style={{ fontSize: "18px", color: "var(--text-tertiary)", cursor: "help" }} />
                <div className="role-help-tooltip">
                  <div className="tooltip-item"><strong className="tooltip-title" style={{ color: "var(--theme-primary)" }}>관리자 (Admin)</strong><div className="tooltip-desc">모든 관리대상(모델, 장비, 계정, 권한)의 수정, 삭제, 생성 권한</div></div>
                  <div className="tooltip-item"><strong className="tooltip-title" style={{ color: "#10b981" }}>편집자 (Editor)</strong><div className="tooltip-desc">에디트 모드에서 모델, 장비를 수정, 삭제, 생성 할 수 있음 (계정/권한 관리 불가)</div></div>
                  <div className="tooltip-item"><strong className="tooltip-title" style={{ color: "var(--text-primary)" }}>조회자 (Viewer)</strong><div className="tooltip-desc">모니터링만 가능</div></div>
                  <div className="tooltip-item" style={{ marginBottom: 0 }}><strong className="tooltip-title" style={{ color: "var(--text-tertiary)" }}>승인대기 (Pending)</strong><div className="tooltip-desc">권한 없음 (관리자 승인 대기중)</div></div>
                </div>
              </div>
            </div>
            {selectedIds.length > 0 && (
              <div className="modal-batch-toolbar">
                <span className="modal-batch-count">{selectedIds.length}개 선택됨</span>
                <div style={{ width: "160px" }}>
                  <select className="stn-input" style={{ height: "32px", fontSize: "13px" }} value={batchRole} onChange={(e) => setBatchRole(e.target.value as AccountRole)}><option value="admin">관리자 (Admin)</option><option value="editor">편집자 (Editor)</option><option value="viewer">조회자 (Viewer)</option><option value="pending">승인대기 (Pending)</option></select>
                </div>
                <button className="comm-btn comm-btn-primary" onClick={handleBatchRoleUpdate} style={{ padding: "6px 16px", minHeight: "38px" }}>일괄 적용</button>
              </div>
            )}
          </div>
          <div className="modal-body-with-sidebar">
            <GroupTreeSidebar groups={groups} selectedGroupId={selectedGroupId} onSelectGroup={(id) => { setSelectedGroupId(id); setSelectedIds([]); }} accountCounts={accountCounts} onCreateGroup={handleCreateGroup} onRenameGroup={handleStartRename} onDeleteGroup={handleDeleteGroup} onMoveGroup={handleMoveGroup} />
            <div className="modal-body-main">
              <StnTable columns={permissionColumns} data={filteredAccounts} rowKey={(r) => r.id} selectedRowKeys={selectedIds} onSelectionChange={setSelectedIds} defaultSortKey="createdAt" defaultSortDir="desc" preSort={handlePreSort} rowClassName={getRowClassName} />
            </div>
          </div>
        </div>
      )}

      {/* Room Permission Modal */}
      {roomModalUser && (
        <div className="room-modal-overlay" onClick={() => setRoomModalUser(null)}>
          <div className="room-modal" onClick={e => e.stopPropagation()}>
            <div className="room-modal-header">
              <div className="room-modal-title-row"><Icon icon="fluent:building-24-filled" style={{ fontSize: "20px", color: "var(--theme-primary)" }} /><span className="room-modal-title">전산실 접근 권한</span></div>
              <button className="comm-btn comm-icon-btn comm-btn-sm comm-btn-ghost" onClick={() => setRoomModalUser(null)}><Icon icon="material-symbols:close" className="icon" /></button>
            </div>
            <div className="room-modal-user-info">
              <div className="user-avatar-sm"><Icon icon="fluent:person-24-filled" /></div>
              <div><div className="user-name">{roomModalUser.name}</div><div className="user-email">{roomModalUser.email}</div></div>
              <StnBadge variant={roomModalUser.role === "admin" ? "primary" : roomModalUser.role === "editor" ? "success" : "secondary"}>{roomModalUser.role.toUpperCase()}</StnBadge>
            </div>
            <div className="room-modal-summary">
              <span>선택된 전산실: </span><strong>{roomChecked.size} / {ALL_ROOM_IDS.length}</strong>
              <button className="room-modal-select-all" onClick={() => setRoomChecked(roomChecked.size === ALL_ROOM_IDS.length ? new Set() : new Set(ALL_ROOM_IDS))}>{roomChecked.size === ALL_ROOM_IDS.length ? "전체 해제" : "전체 선택"}</button>
            </div>
            <RoomTreePicker tree={ROOM_TREE} checked={roomChecked} onToggle={handleRoomToggle} />
            <div className="room-modal-footer">
              <button className="comm-btn comm-btn-ghost" onClick={() => setRoomModalUser(null)}>취소</button>
              <button className="comm-btn comm-btn-primary" onClick={handleSaveRoomPermissions}><Icon icon="fluent:checkmark-24-regular" className="icon" /> 저장</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Group Modal */}
      {renameGroup && (
        <div className="room-modal-overlay" onClick={() => setRenameGroup(null)}>
          <div className="room-modal" style={{ width: "360px" }} onClick={e => e.stopPropagation()}>
            <div className="room-modal-header">
              <div className="room-modal-title-row"><Icon icon="fluent:folder-24-filled" style={{ fontSize: "20px", color: "var(--theme-primary)" }} /><span className="room-modal-title">그룹 이름 변경</span></div>
              <button className="comm-btn comm-icon-btn comm-btn-sm comm-btn-ghost" onClick={() => setRenameGroup(null)}><Icon icon="material-symbols:close" className="icon" /></button>
            </div>
            <div style={{ padding: "20px" }}>
              <input className="stn-input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="그룹 이름" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSaveRename(); }} style={{ width: "100%" }} />
            </div>
            <div className="room-modal-footer">
              <button className="comm-btn comm-btn-ghost" onClick={() => setRenameGroup(null)}>취소</button>
              <button className="comm-btn comm-btn-primary" onClick={handleSaveRename} disabled={!renameValue.trim()}><Icon icon="fluent:checkmark-24-regular" className="icon" /> 저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 새 계정 추가 모달 */}
      {isCreateAccountModalOpen && (
        <CreateAccountModal
          open={isCreateAccountModalOpen}
          onClose={() => setIsCreateAccountModalOpen(false)}
          groups={groups}
          onSave={handleCreateAccount}
        />
      )}

      <style>{`
        .role-help-tooltip { position: absolute; top: calc(100% + 8px); left: 0; width: 280px; background: var(--panel-bg, #1a1d24); border: 1px solid var(--panel-border, #2a2d35); border-radius: 8px; padding: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); opacity: 0; visibility: hidden; transform: translateY(-10px); transition: all 0.2s ease; z-index: 100; backdrop-filter: blur(16px); }
        .tooltip-item { margin-bottom: 12px; }
        .tooltip-title { display: block; font-weight: 700; font-size: 13px; margin-bottom: 4px; }
        .tooltip-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
        .role-help-tooltip-container:hover .role-help-tooltip { opacity: 1; visibility: visible; transform: translateY(0); }

        .modal-body-with-sidebar { display: flex; flex: 1; min-height: 0; gap: 16px; }
        .modal-body-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

        /* Table Column Cells */
        .status-cell { display: flex; justify-content: center; align-items: center; gap: 6px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-dot.active { background: var(--severity-normal, #22c55e); }
        .status-dot.inactive { background: var(--text-tertiary, #6b7280); }
        .status-text { font-size: 13px; }
        .status-text.active { color: var(--text-primary); }
        .status-text.inactive { color: var(--text-secondary); }
        .date-text { font-size: 13px; color: var(--text-secondary); }

        .highlight-row { background: rgba(var(--theme-primary-rgb), 0.03); }
        .highlight-row:hover { background: rgba(var(--theme-primary-rgb), 0.06) !important; }

        .room-access-btn { width: 100px; height: 32px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; border: 1px solid var(--border-weak); background: var(--panel-bg); border-radius: 6px; color: var(--text-primary); font-size: 13px; cursor: pointer; transition: all 0.2s; outline: none; }
        .room-access-btn:hover { border-color: var(--theme-primary); background: rgba(var(--theme-primary-rgb), 0.02); }

        /* Group Tree Sidebar */
        .group-sidebar { width: 210px; flex-shrink: 0; display: flex; flex-direction: column; }
        .group-sidebar-title { display: flex; align-items: center; gap: 6px; padding: 12px 14px 12px 0; font-size: 14px; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; }
        .group-sidebar-list { flex: 1; overflow-y: auto; padding: 4px 0; }

        .group-tree-item {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 12px; cursor: pointer; font-size: 13px;
          color: var(--text-secondary); transition: all 0.15s;
          border-left: 3px solid transparent; border-radius: 0;
          user-select: none;
        }
        .group-tree-item:hover { background: rgba(128,128,128,0.06); color: var(--text-primary); }
        .group-tree-item.active { background: rgba(var(--theme-primary-rgb), 0.08); color: var(--theme-primary); font-weight: 600; border-left-color: var(--theme-primary); }
        .group-tree-item.drag-over { background: rgba(var(--theme-primary-rgb), 0.15); outline: 1px dashed var(--theme-primary); outline-offset: -1px; }

        .group-tree-toggle { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; cursor: pointer; color: var(--text-tertiary); flex-shrink: 0; }
        .group-tree-toggle-spacer { width: 18px; flex-shrink: 0; }
        .group-tree-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .group-tree-count { font-size: 11px; font-weight: 600; color: var(--text-tertiary); background: rgba(128,128,128,0.1); padding: 1px 6px; border-radius: 10px; flex-shrink: 0; }
        .group-tree-item.active .group-tree-count { color: var(--theme-primary); background: rgba(var(--theme-primary-rgb), 0.15); }

        /* Context Menu */
        .ctx-menu { position: fixed; z-index: 99999; background: var(--panel-bg, #1a1d24); border: 1px solid var(--panel-border, #2a2d35); border-radius: 8px; padding: 4px; min-width: 160px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); backdrop-filter: blur(16px); }
        .ctx-menu-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: none; color: var(--text-primary); font-size: 13px; cursor: pointer; border-radius: 4px; transition: background 0.1s; }
        .ctx-menu-item:hover { background: rgba(128,128,128,0.1); }
        .ctx-menu-item.danger { color: var(--severity-critical, #ef4444); }
        .ctx-menu-item.danger:hover { background: rgba(239,68,68,0.1); }

        .room-access-btn { display: inline-flex !important; align-items: center; gap: 6px; font-size: 12px !important; color: var(--text-secondary) !important; border: 1px solid var(--border-weak) !important; border-radius: 6px !important; padding: 4px 10px !important; cursor: pointer; transition: all 0.15s ease; }
        .room-access-btn:hover { color: var(--theme-primary) !important; border-color: var(--theme-primary) !important; background: rgba(var(--theme-primary-rgb), 0.05) !important; }

        .room-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10100; backdrop-filter: blur(4px); }
        .room-modal { width: 420px; max-width: 90vw; max-height: 80vh; background: var(--panel-bg, #1a1d24); border: 1px solid var(--panel-border, #2a2d35); border-radius: 12px; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.5); overflow: hidden; }
        .room-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-weak); }
        .room-modal-title-row { display: flex; align-items: center; gap: 8px; }
        .room-modal-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
        .room-modal-user-info { display: flex; align-items: center; gap: 10px; padding: 12px 20px; background: rgba(128,128,128,0.05); border-bottom: 1px solid var(--border-weak); }
        .room-modal-summary { display: flex; align-items: center; gap: 8px; padding: 10px 20px; font-size: 13px; color: var(--text-secondary); border-bottom: 1px solid var(--border-weak); }
        .room-modal-select-all { margin-left: auto; background: none; border: none; color: var(--theme-primary); font-size: 12px; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background 0.15s; }
        .room-modal-select-all:hover { background: rgba(var(--theme-primary-rgb), 0.1); }
        .room-tree-container { flex: 1; overflow-y: auto; padding: 8px 0; min-height: 0; }
        .room-tree-node { display: flex; align-items: center; padding: 4px 12px; min-height: 32px; cursor: default; transition: background 0.1s; }
        .room-tree-node:hover { background: rgba(128,128,128,0.06); }
        .room-tree-toggle { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; cursor: pointer; color: var(--text-tertiary); flex-shrink: 0; }
        .room-tree-checkbox-label { display: flex; align-items: center; cursor: pointer; flex: 1; min-width: 0; }
        .room-tree-checkbox { width: 16px; height: 16px; margin-right: 8px; accent-color: var(--theme-primary); cursor: pointer; flex-shrink: 0; }
        .room-tree-label { font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .room-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border-weak); }
      `}</style>
    </StnModal>
  );
};
