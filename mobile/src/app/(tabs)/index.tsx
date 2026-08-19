import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { daysDiff } from '@shared/dates.js';
import { STAGE_LABELS, progressLevel } from '@shared/labels.js';
import { Chip } from '@/components/chip';
import { Dot } from '@/components/indicators';
import { MoreMenu } from '@/components/more-menu';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { Empty, GroupLabel, Section } from '@/components/section';
import type { Todo } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useReportedMutate, useTodos } from '@/lib/todos-context';
import { colors, fontSize, progressColors, progressTrack } from '@/constants/tokens';

/**
 * 오늘 화면 — 수행날짜가 오늘인 항목과 오늘이 복습일인 항목.
 *
 * 웹 `TodaySection.jsx`와 같은 구성이다. 다만 두 가지는 아직 없다:
 * **타임라인 보기**(계산은 shared/timeline.js에 이미 있고 그리는 부분만 없다)와
 * **진행률 슬라이더**(웹은 `<input type=range>`인데 앱에는 그런 기본 부품이 없다).
 * 진행률은 지금 읽기만 된다.
 *
 * 드래그해서 오늘로 옮기는 자리도 두지 않는다 — 웹에서도 넓은 화면 전용이고,
 * 드래그로만 되는 기능은 만들지 않기로 한 약속이 있다. 목록 탭의 "오늘로"가 그 일을 한다.
 */
export default function TodayScreen() {
  const { todos, today } = useTodos();
  const { api } = useAuth();
  const run = useReportedMutate();

  const { perform, reviews } = useMemo(() => ({
    perform: todos.filter(t => !t.completed && t.perform_date === today),
    reviews: todos.filter(t => t.activeReview && t.activeReview.due_date <= today),
  }), [todos, today]);

  const total = perform.length + reviews.length;

  return (
    <Screen>
      <Section title="오늘 할 일" count={total}>
        {total === 0 && <Empty>오늘 할 일이 없습니다</Empty>}

        {perform.length > 0 && (
          <View style={styles.group}>
            <GroupLabel tone="accent">오늘 수행 ({perform.length})</GroupLabel>
            {perform.map((t, i) => (
              <PerformRow
                key={t.id}
                todo={t}
                first={i === 0}
                today={today}
                onComplete={() => run('완료 처리 실패', () => api.completeTodo(t.id, true))}
                onRemove={() => run('변경 실패', () => api.setPerformDate(t.id, null))}
              />
            ))}
          </View>
        )}

        {reviews.length > 0 && (
          <View style={styles.group}>
            <GroupLabel tone="warn">오늘 복습 ({reviews.length})</GroupLabel>
            {reviews.map((t, i) => (
              <ReviewRow
                key={t.id}
                todo={t}
                first={i === 0}
                today={today}
                onComplete={() => run('복습 완료 실패', () => api.completeReview(t.activeReview!.id))}
              />
            ))}
          </View>
        )}
      </Section>
    </Screen>
  );
}

/** 오늘 수행할 항목 한 줄. 웹 `.today-row` + `TodayTodoRow`. */
function PerformRow({ todo, first, today, onComplete, onRemove }: {
  todo: Todo;
  first: boolean;
  today: string;
  onComplete: () => void;
  onRemove: () => void;
}) {
  const diff = todo.deadline ? daysDiff(todo.deadline, today) : null;
  const pct = todo.progress ?? 0;
  const progressColor = progressColors[progressLevel(pct)];

  return (
    <View style={[styles.row, !first && styles.divided]}>
      <Dot importance={todo.importance} />

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{todo.text}</Text>

        <View style={styles.metaRow}>
          {todo.start_time && (
            <Chip
              label={`${todo.start_time}${todo.end_time ? `–${todo.end_time}` : ''}`}
              tone="accent"
            />
          )}
          {diff !== null && (
            <Text style={[styles.sub, diff < 0 && styles.danger, diff === 0 && styles.warn]}>
              마감 {diff < 0 ? `${Math.abs(diff)}일 지남` : diff === 0 ? '오늘' : `D-${diff}`}
            </Text>
          )}
        </View>

        {todo.progress !== null && (
          <View style={styles.progressRow}>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: progressColor }]} />
            </View>
            <Text style={[styles.pct, { color: progressColor }]}>{pct}%</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <PillButton label="완료" onPress={onComplete} />
        <MoreMenu
          label={`${todo.text} 항목 메뉴`}
          items={[{ label: '오늘 목록에서 제거', onSelect: onRemove }]}
        />
      </View>
    </View>
  );
}

/** 오늘이 복습일인 항목 한 줄. 지난 복습은 붉게 읽힌다. */
function ReviewRow({ todo, first, today, onComplete }: {
  todo: Todo;
  first: boolean;
  today: string;
  onComplete: () => void;
}) {
  const review = todo.activeReview!;
  const overdue = review.due_date < today;

  return (
    <View style={[styles.row, !first && styles.divided]}>
      <Dot importance={todo.importance} />

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{todo.text}</Text>
        <Text style={[styles.sub, overdue ? styles.danger : styles.warn]}>
          {STAGE_LABELS[review.stage]} 복습
          {overdue ? ` — ${Math.abs(daysDiff(review.due_date, today))}일 지남` : ' — 오늘'}
        </Text>
      </View>

      <View style={styles.actions}>
        <PillButton label="완료" onPress={onComplete} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 0 },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 12 },
  divided: { borderTopWidth: 1, borderTopColor: colors.lineSoft },

  body: { flex: 1, gap: 4 },
  title: { fontSize: fontSize.title, fontWeight: '600', letterSpacing: -0.1, color: colors.text },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  sub: { fontSize: fontSize.meta, color: colors.muted },
  danger: { color: colors.danger },
  warn: { color: colors.warn },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  barTrack: { flex: 1, height: 6, borderRadius: 99, backgroundColor: progressTrack, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  pct: { fontSize: 12, fontWeight: '700', minWidth: 34, textAlign: 'right' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
