import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { daysDiff } from '@shared/dates.js';
import { STAGE_LABELS } from '@shared/labels.js';
import { Dot, StageBar } from '@/components/indicators';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { Empty, GroupLabel, Section } from '@/components/section';
import { useAuth } from '@/lib/auth-context';
import { useReportedMutate, useTodos } from '@/lib/todos-context';
import { colors, fontFamily, fontSize } from '@/constants/tokens';

type Item = {
  id: string;
  stage: number;
  todoText: string;
  importance: 1 | 2 | 3;
  diff: number;
};

/**
 * 복습 화면 — 1·3·7·16·30일 중 아직 남은 복습이 있는 항목.
 * 웹 `ReviewSection.jsx`와 같이 급한 순서로 세 묶음이다.
 *
 * 날짜순으로만 두면 이미 지난 복습이 목록 한가운데 묻힌다.
 * 앞으로 올 복습에는 완료 버튼을 주지 않는다 — 아직 할 일이 아니다.
 */
export default function ReviewScreen() {
  const { todos, today } = useTodos();
  const { api } = useAuth();
  const run = useReportedMutate();

  const items = useMemo<Item[]>(
    () => todos
      .filter(t => t.activeReview)
      .map(t => ({
        id: t.activeReview!.id,
        stage: t.activeReview!.stage,
        todoText: t.text,
        importance: t.importance,
        diff: daysDiff(t.activeReview!.due_date, today),
      }))
      .sort((a, b) => a.diff - b.diff),
    [todos, today]
  );

  const overdue = items.filter(r => r.diff < 0);
  const dueToday = items.filter(r => r.diff === 0);
  const upcoming = items.filter(r => r.diff > 0);

  const complete = (id: string) => run('복습 완료 실패', () => api.completeReview(id));

  return (
    <Screen>
      <Section title="복습 예정" count={items.length}>
        {items.length === 0 && <Empty>복습 일정이 없습니다</Empty>}

        {overdue.length > 0 && (
          <Group label="지남" tone="danger" items={overdue} onComplete={complete} />
        )}
        {dueToday.length > 0 && (
          <Group label="오늘" tone="warn" items={dueToday} onComplete={complete} />
        )}
        {upcoming.length > 0 && (
          <Group label="예정" tone="accent" items={upcoming} />
        )}
      </Section>
    </Screen>
  );
}

function Group({ label, tone, items, onComplete }: {
  label: string;
  tone: 'danger' | 'warn' | 'accent';
  items: Item[];
  /** 주지 않으면 완료 버튼이 빠진다 — 앞으로 올 복습이 그렇다. */
  onComplete?: (reviewId: string) => void;
}) {
  return (
    <View>
      <GroupLabel tone={tone}>{label} ({items.length})</GroupLabel>

      {items.map((item, i) => (
        <View key={item.id} style={[styles.row, i > 0 && styles.divided]}>
          <Dot importance={item.importance} />

          <View style={styles.body}>
            <Text style={styles.text} numberOfLines={1}>{item.todoText}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>
                {STAGE_LABELS[item.stage]}
                {item.diff < 0
                  ? ` · ${Math.abs(item.diff)}일 지남`
                  : item.diff === 0
                    ? ' · 오늘'
                    : ` · D-${item.diff}`}
              </Text>
              <StageBar stage={item.stage} />
            </View>
          </View>

          {onComplete && <PillButton label="완료" onPress={() => onComplete(item.id)} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 },
  divided: { borderTopWidth: 1, borderTopColor: colors.lineSoft },

  body: { flex: 1, gap: 4 },
  text: { fontFamily: fontFamily.body, fontSize: fontSize.title, fontWeight: '600', letterSpacing: -0.1, color: colors.text },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontFamily: fontFamily.body, fontSize: fontSize.meta, color: colors.muted },
});
