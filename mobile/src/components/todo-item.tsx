import { StyleSheet, Text, View } from 'react-native';

import { daysDiff } from '@shared/dates.js';
import { IMP_LABELS, STAGE_LABELS, progressLevel } from '@shared/labels.js';
import { Checkbox } from './checkbox';
import { Chip, ChipButton, type ChipTone } from './chip';
import { MoreMenu, type MenuItem } from './more-menu';
import { PillButton } from './pill-button';
import type { Review, Todo } from '@/lib/api';
import { useTodos } from '@/lib/todos-context';
import {
  categoryColors, colors, fontFamily, fontSize, importanceChip, progressColors, progressTrack,
} from '@/constants/tokens';

type Tagged = { label: string; tone: ChipTone };

/**
 * 마감 칩. 지난 것은 붉게, 오늘과 사흘 안쪽은 황토색으로.
 * D-3까지와 그 뒤는 **글자가 같고 색만 다르다** — 급한 것이 눈에 먼저 들어와야 한다.
 */
function deadlineTag(deadline: string, today: string): Tagged {
  const diff = daysDiff(deadline, today);
  if (diff < 0) return { label: `마감 ${Math.abs(diff)}일 지남`, tone: 'danger' };
  if (diff === 0) return { label: '오늘 마감', tone: 'warn' };
  return { label: `마감 D-${diff}`, tone: diff <= 3 ? 'warn' : 'neutral' };
}

function performTag(performDate: string, today: string): Tagged {
  const diff = daysDiff(performDate, today);
  if (diff < 0) return { label: `${Math.abs(diff)}일 전 수행`, tone: 'danger' };
  if (diff === 0) return { label: '오늘 수행', tone: 'warn' };
  return { label: `D-${diff} 수행`, tone: 'neutral' };
}

/** 복습 배지. 아직 할 복습이면 **배지 안에** 완료 버튼을 품는다(웹과 같다). */
function ReviewBadge({ review, today, onComplete }: {
  review: Review;
  today: string;
  onComplete: (reviewId: string) => void;
}) {
  const diff = daysDiff(review.due_date, today);
  const stage = STAGE_LABELS[review.stage];

  if (diff > 0) return <Chip label={`${stage} 복습 — D-${diff}`} tone="accent" />;

  const tone: ChipTone = diff < 0 ? 'danger' : 'warn';
  const label = diff < 0
    ? `${stage} 복습 — ${Math.abs(diff)}일 지남`
    : `${stage} 복습 — 오늘`;

  return (
    <Chip
      label={label}
      tone={tone}
      action={
        <ChipButton
          label="완료"
          color={tone === 'danger' ? colors.danger : colors.warn}
          onPress={() => onComplete(review.id)}
        />
      }
    />
  );
}

/**
 * 목록의 할 일 한 줄. 웹 `TodoItem.jsx`의 좁은 화면(compact) 모습과 같은 구성이다.
 *
 * 항목마다 카드를 두르지 않는다 — 한 카드(Section) 안에서 **구분선**으로만 나눈다.
 * 넓은 화면의 아이콘 버튼 세 개 대신 주된 행동 하나와 ⋯ 메뉴를 둔다.
 * 드래그 핸들은 넣지 않는다 — 웹에서도 넓은 화면 전용이고, 드래그로만 되는 기능은
 * 만들지 않기로 한 약속이 있다.
 */
export function TodoItem({
  todo, first, onComplete, onDelete, onCompleteReview, onAddToToday, onEdit,
}: {
  todo: Todo;
  /** 첫 줄에는 위 구분선을 두지 않는다. */
  first?: boolean;
  onComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onCompleteReview: (reviewId: string) => void;
  /** 오늘 수행으로 올리기. 줄 수 없는 화면에서는 넘기지 않는다 — 버튼이 빠진다. */
  onAddToToday?: (id: string) => void;
  /** 수정 폼이 붙기 전에는 넘기지 않는다 — ⋯ 메뉴에서 그 줄이 빠진다. */
  onEdit?: (todo: Todo) => void;
}) {
  const { today, categoryById } = useTodos();

  const done = !!todo.completed;
  const needsReview = !!todo.needs_review;

  // 없는 성격을 가리키고 있으면(방금 지워졌다면) 조용히 칩을 그리지 않는다.
  // 서버도 지울 때 할 일을 비우지만 트랜잭션이 없어 그 사이가 있고,
  // 화면이 그것을 견디는 쪽이 맞다.
  const category = todo.category_id ? categoryById.get(String(todo.category_id)) : null;
  const catColor = category ? categoryColors[category.color as keyof typeof categoryColors] : null;

  const imp = importanceChip[todo.importance];
  const pct = todo.progress ?? 0;

  // 복습 배지는 **완료한 항목에만** 붙는다. 아직 안 끝난 항목은 위쪽 "복습 예정" 칩이 맡는다.
  const showReview = done && needsReview;
  const allDone = showReview && !todo.activeReview;

  const canPin = !done && todo.perform_date !== today && !!onAddToToday;

  const menu: MenuItem[] = [
    ...(!done && onEdit ? [{ label: '수정', onSelect: () => onEdit(todo) }] : []),
    { label: '삭제', danger: true, onSelect: () => onDelete(todo.id) },
  ];

  const hasMeta = (!done && (todo.deadline || todo.perform_date)) || showReview;

  return (
    <View style={[styles.row, !first && styles.divided, done && styles.rowDone]}>
      <Checkbox checked={done} label={todo.text} onChange={next => onComplete(todo.id, next)} />

      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={[styles.text, done && styles.struck]}>{todo.text}</Text>
          <Chip label={IMP_LABELS[todo.importance]} bg={imp.bg} fg={imp.fg} />
          {category && catColor && <Chip label={category.name} bg={catColor.bg} fg={catColor.fg} />}
          {needsReview && !done && <Chip label="복습 예정" tone="accent" />}
          {todo.start_time && (
            <Chip
              label={`${todo.start_time}${todo.end_time ? `–${todo.end_time}` : ''}`}
              tone="accent"
            />
          )}
        </View>

        {hasMeta && (
          <View style={styles.meta}>
            {!done && todo.deadline && <Chip {...deadlineTag(todo.deadline, today)} />}
            {!done && todo.perform_date && <Chip {...performTag(todo.perform_date, today)} />}
            {showReview && !allDone && todo.activeReview && (
              <ReviewBadge review={todo.activeReview} today={today} onComplete={onCompleteReview} />
            )}
            {allDone && <Chip label="복습 전부 완료" tone="accent" />}
          </View>
        )}

        {!done && todo.progress !== null && (
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${pct}%`, backgroundColor: progressColors[progressLevel(pct)] },
              ]}
            />
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {canPin && <PillButton label="오늘로" onPress={() => onAddToToday!(todo.id)} />}
        <MoreMenu label={`${todo.text} 항목 메뉴`} items={menu} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 12 },
  divided: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  rowDone: { opacity: 0.6 },

  body: { flex: 1, gap: 5 },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },

  text: {
    fontSize: fontSize.title,
    fontFamily: fontFamily.body,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: colors.text,
    flexShrink: 1,
  },
  struck: { textDecorationLine: 'line-through', color: colors.muted },

  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },

  barTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: progressTrack,
    overflow: 'hidden',
    marginTop: 3,
  },
  barFill: { height: '100%', borderRadius: 99 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
