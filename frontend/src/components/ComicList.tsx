import { useEffect, useMemo, useState } from "react";
import type { Comic } from "../types";
import { formatBytes } from "../api";

interface Props {
  comics: Comic[];
  currentPath: string | null;
  onSelect: (c: Comic) => void;
  onClose?: () => void;
}

interface TreeNode {
  name: string;
  path: string; // path relative to comics root ("" for root)
  comic: Comic | null;
  children: Map<string, TreeNode>;
}

function buildTree(comics: Comic[]): TreeNode {
  const root: TreeNode = { name: "", path: "", comic: null, children: new Map() };
  for (const c of comics) {
    const parts = c.path.split("/");
    let node = root;
    let cur = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      cur = cur ? `${cur}/${part}` : part;
      if (i === parts.length - 1) {
        node.children.set(part, {
          name: part,
          path: cur,
          comic: c,
          children: new Map(),
        });
      } else {
        if (!node.children.has(part)) {
          node.children.set(part, {
            name: part,
            path: cur,
            comic: null,
            children: new Map(),
          });
        }
        node = node.children.get(part)!;
      }
    }
  }
  return root;
}

function collectFolders(node: TreeNode, acc: string[] = []): string[] {
  if (node.path) acc.push(node.path);
  for (const child of node.children.values()) {
    if (!child.comic) collectFolders(child, acc);
  }
  return acc;
}

function sortNodes(children: TreeNode[]): TreeNode[] {
  return [...children].sort((a, b) => {
    const aDir = !a.comic;
    const bDir = !b.comic;
    if (aDir !== bDir) return aDir ? -1 : 1; // folders first
    return a.name.localeCompare(b.name, "zh", { numeric: true });
  });
}

const collator = Intl.Collator("zh", { numeric: true });

function TreeRow({
  node,
  depth,
  expanded,
  toggle,
  currentPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  currentPath: string | null;
  onSelect: (c: Comic) => void;
}) {
  const pad = 8 + depth * 14;

  if (node.comic) {
    const active = node.comic.path === currentPath;
    return (
      <button
        onClick={() => onSelect(node.comic!)}
        className={`flex w-full items-center gap-1.5 py-1 text-left text-sm transition ${
          active
            ? "bg-white/15 text-white"
            : "text-neutral-300 hover:bg-white/10"
        }`}
        style={{ paddingLeft: pad }}
        title={node.comic.path}
      >
        <span className="text-[10px] text-neutral-500">●</span>
        <span className="truncate">{node.name}</span>
        <span className="ml-auto shrink-0 pr-2 text-[11px] text-neutral-600">
          {formatBytes(node.comic.size)}
        </span>
      </button>
    );
  }

  // folder
  const isOpen = expanded.has(node.path);
  const kids = sortNodes([...node.children.values()]);
  return (
    <div>
      <button
        onClick={() => toggle(node.path)}
        className="flex w-full items-center gap-1.5 py-1 text-left text-sm text-neutral-200 hover:bg-white/10"
        style={{ paddingLeft: pad }}
      >
        <span className="text-[10px] text-neutral-500">{isOpen ? "▾" : "▸"}</span>
        <span className="text-[13px] text-neutral-400">📁</span>
        <span className="truncate font-medium">{node.name}</span>
        <span className="ml-auto shrink-0 pr-2 text-[11px] text-neutral-600">
          {kids.length}
        </span>
      </button>
      {isOpen && (
        <div>
          {kids.map((c) => (
            <TreeRow
              key={c.path}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              currentPath={currentPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComicList({
  comics,
  currentPath,
  onSelect,
  onClose,
}: Props) {
  const [q, setQ] = useState("");
  const tree = useMemo(() => buildTree(comics), [comics]);
  const allFolders = useMemo(() => new Set(collectFolders(tree)), [tree]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem("cr:tree-collapsed");
      if (s) return new Set(JSON.parse(s));
    } catch {
      /* noop */
    }
    return new Set(); // empty = all expanded by default
  });

  // expanded = allFolders minus collapsed
  const expanded = useMemo(() => {
    const s = new Set(allFolders);
    for (const p of collapsed) s.delete(p);
    return s;
  }, [allFolders, collapsed]);

  // auto-expand ancestors of the currently open comic
  useEffect(() => {
    if (!currentPath) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      let dir = currentPath.includes("/")
        ? currentPath.slice(0, currentPath.lastIndexOf("/"))
        : "";
      while (dir) {
        next.delete(dir);
        dir = dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "";
      }
      // also expand the top-level folder itself
      if (currentPath.includes("/")) {
        next.delete(currentPath.slice(0, currentPath.indexOf("/")));
      }
      const changed = next.size !== prev.size || [...next].some((x) => !prev.has(x));
      if (changed) localStorage.setItem("cr:tree-collapsed", JSON.stringify([...next]));
      return changed ? next : prev;
    });
  }, [currentPath]);

  const toggle = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      localStorage.setItem("cr:tree-collapsed", JSON.stringify([...next]));
      return next;
    });
  };

  // search -> flat filtered list
  const term = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return [];
    return comics
      .filter((c) => c.path.toLowerCase().includes(term))
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [comics, term]);

  return (
    <div className="flex h-full flex-col bg-[#1f1f1f] text-neutral-200">
      <div className="flex items-center gap-2 border-b border-white/10 p-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索文件…"
          className="min-w-0 flex-1 rounded bg-black/40 px-2 py-1 text-sm outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-white/30"
        />
        {onClose && (
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-neutral-400 hover:bg-white/10 hover:text-white"
            title="收起列表 (L)"
          >
            ✕
          </button>
        )}
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto py-1">
        {term ? (
          filtered.length === 0 ? (
            <div className="p-3 text-center text-sm text-neutral-500">
              无匹配结果
            </div>
          ) : (
            <ul>
              {filtered.map((c) => {
                const active = c.path === currentPath;
                return (
                  <li key={c.path}>
                    <button
                      onClick={() => onSelect(c)}
                      className={`flex w-full flex-col px-3 py-1.5 text-left text-sm transition ${
                        active
                          ? "bg-white/15 text-white"
                          : "text-neutral-300 hover:bg-white/10"
                      }`}
                    >
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="truncate text-xs text-neutral-500">
                        {c.dir || "/"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : comics.length === 0 ? (
          <div className="p-3 text-center text-sm text-neutral-500">
            未发现文件
          </div>
        ) : (
          sortNodes([...tree.children.values()]).map((node) => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              expanded={expanded}
              toggle={toggle}
              currentPath={currentPath}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      <div className="border-t border-white/10 p-2 text-center text-xs text-neutral-500">
        共 {comics.length} 本 · {allFolders.size} 个目录
      </div>
    </div>
  );
}
