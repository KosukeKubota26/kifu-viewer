import { useEffect, useRef, useState } from 'react';
import type { GameNode } from '../lib/kifParser';

interface Props {
  root: GameNode;
  currentNode: GameNode;
  onSelect: (node: GameNode) => void;
  scrollToSelected: boolean;
}

interface MoveItemProps {
  node: GameNode;
  currentNode: GameNode;
  onSelect: (node: GameNode) => void;
  depth: number;
  scrollToSelected: boolean;
}

function MoveItem({ node, currentNode, onSelect, depth, scrollToSelected }: MoveItemProps) {
  const [expanded, setExpanded] = useState(true);
  const isCurrent = node.id === currentNode.id;
  const mainContinuation = node.children[0];
  const branches = node.children.slice(1);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCurrent && scrollToSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isCurrent, scrollToSelected]);

  return (
    <div>
      <div className="flex items-start gap-1">
        {depth > 0 && (
          <div
            className="shrink-0 border-l-2 border-gray-300 ml-2"
            style={{ width: depth * 8, minHeight: 24 }}
          />
        )}

        <div className="flex-1 min-w-0">
          <div
            ref={itemRef}
            onClick={() => onSelect(node)}
            className={`flex items-center gap-1 rounded px-1 py-0.5 cursor-pointer text-sm
              ${isCurrent ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-800'}`}
          >
            <span className={`w-8 text-right shrink-0 text-xs ${isCurrent ? 'text-blue-200' : 'text-gray-400'}`}>
              {node.moveNumber}
            </span>
            <span className="font-medium truncate">{node.notation}</span>
            {node.evaluation !== undefined && (
              <span className={`ml-auto shrink-0 text-xs ${isCurrent ? 'text-blue-200' : 'text-gray-400'}`}>
                {node.evaluation > 0 ? '+' : ''}{node.evaluation}
              </span>
            )}
            {branches.length > 0 && (
              <button
                onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
                className={`shrink-0 text-xs px-1 rounded ${isCurrent ? 'bg-blue-500' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                title={`分岐 ${branches.length} 本`}
              >
                {expanded ? '▼' : '▶'} {branches.length}
              </button>
            )}
          </div>

          {expanded && branches.length > 0 && (
            <div className="ml-2 mt-0.5 border-l-2 border-orange-300 pl-1">
              {branches.map(branch => (
                <BranchLine
                  key={branch.id}
                  startNode={branch}
                  currentNode={currentNode}
                  onSelect={onSelect}
                  depth={depth + 1}
                  scrollToSelected={scrollToSelected}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {mainContinuation && (
        <MoveItem
          node={mainContinuation}
          currentNode={currentNode}
          onSelect={onSelect}
          depth={depth}
          scrollToSelected={scrollToSelected}
        />
      )}
    </div>
  );
}

function BranchLine({ startNode, currentNode, onSelect, depth, scrollToSelected }: {
  startNode: GameNode;
  currentNode: GameNode;
  onSelect: (node: GameNode) => void;
  depth: number;
  scrollToSelected: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="mb-1">
      <button
        className="text-xs text-orange-600 hover:underline mb-0.5"
        onClick={() => setCollapsed(v => !v)}
      >
        {collapsed ? '▶ 分岐を展開' : '▼ 分岐'}
      </button>
      {!collapsed && (
        <MoveItem
          node={startNode}
          currentNode={currentNode}
          onSelect={onSelect}
          depth={depth}
          scrollToSelected={scrollToSelected}
        />
      )}
    </div>
  );
}

export default function MoveTree({ root, currentNode, onSelect, scrollToSelected }: Props) {
  return (
    <div className="overflow-y-auto h-full text-sm">
      {root.children.length === 0 ? (
        <p className="text-gray-400 text-xs p-2">棋譜がありません</p>
      ) : (
        root.children.map(child => (
          <MoveItem
            key={child.id}
            node={child}
            currentNode={currentNode}
            onSelect={onSelect}
            depth={0}
            scrollToSelected={scrollToSelected}
          />
        ))
      )}
    </div>
  );
}
