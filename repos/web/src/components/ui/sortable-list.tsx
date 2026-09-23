"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

export function SortableList<T extends { id: string }>({
  disabled = false,
  items,
  label,
  onReorder,
  renderItem,
}: {
  disabled?: boolean;
  items: T[];
  label: string;
  onReorder: (items: T[]) => void | Promise<void>;
  renderItem: (item: T, handle: ReactNode, isDragging: boolean) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function endDrag(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = items.findIndex((item) => item.id === event.active.id);
    const newIndex = items.findIndex((item) => item.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    void onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return <DndContext collisionDetection={closestCenter} onDragEnd={endDrag} sensors={sensors}>
    <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
      <div aria-label={label} className="settings-sortable-list">{items.map((item) => <SortableRow disabled={disabled} item={item} key={item.id} renderItem={renderItem} />)}</div>
    </SortableContext>
  </DndContext>;
}

function SortableRow<T extends { id: string }>({ disabled, item, renderItem }: { disabled: boolean; item: T; renderItem: (item: T, handle: ReactNode, isDragging: boolean) => ReactNode }) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({ disabled, id: item.id });
  const handle = <button aria-label="Drag to reorder" className="settings-drag-handle" disabled={disabled} ref={setActivatorNodeRef} title="Drag to reorder" type="button" {...attributes} {...listeners}><GripVertical aria-hidden="true" size={18} /></button>;
  return <div className={`settings-sortable-item${isDragging ? " dragging" : ""}`} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>{renderItem(item, handle, isDragging)}</div>;
}
